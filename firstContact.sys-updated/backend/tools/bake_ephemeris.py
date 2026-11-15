#!/usr/bin/env python3
"""Bake DE421 baseline directions and inputs for a DE421-seeded GM what-if run."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

import spiceypy as spice

LUNAR_RADIUS_KM = 1737.4
KERNEL_NAMES = ("naif0012.tls", "de421.bsp", "moon_pa_de421_1900-2050.bpc", "moon_080317.tf", "pck00010.tpc")


def topocentric_angles(position_km: tuple[float, float, float], latitude_deg: float, east_longitude_deg: float) -> tuple[float, float]:
    x, y, z = position_km
    lat, lon = math.radians(latitude_deg), math.radians(east_longitude_deg)
    slat, clat, slon, clon = math.sin(lat), math.cos(lat), math.sin(lon), math.cos(lon)
    east = -slon * x + clon * y
    north = -slat * clon * x - slat * slon * y + clat * z
    up = clat * clon * x + clat * slon * y + slat * z
    az = math.degrees(math.atan2(east, north)) % 360.0
    el = math.degrees(math.atan2(up, math.hypot(east, north)))
    return az, el


def kernel_manifest(kernel_dir: Path) -> list[dict[str, str | int]]:
    manifest = []
    for name in KERNEL_NAMES:
        path = kernel_dir / name
        if not path.is_file():
            raise FileNotFoundError(f"Missing required DE421 kernel: {path}")
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        manifest.append({"name": name, "bytes": path.stat().st_size, "sha256": digest.hexdigest()})
    return manifest


def bake(start_utc: datetime, end_utc: datetime, latitude_deg: float, east_longitude_deg: float,
         elevation_m: float, output_csv: Path, kernel_dir: Path, step_hours: int = 1,
         scenario_output: Path | None = None) -> int:
    if start_utc.tzinfo is None or end_utc.tzinfo is None or end_utc < start_utc:
        raise ValueError("start/end must be timezone-aware UTC datetimes, with end >= start")
    if not -90 <= latitude_deg <= 90 or not -360 <= east_longitude_deg <= 360 or elevation_m < -10000:
        raise ValueError("site coordinates or elevation are outside valid bounds")
    if step_hours < 1:
        raise ValueError("step_hours must be at least 1")
    kernels = kernel_manifest(kernel_dir)
    lat, lon = math.radians(latitude_deg), math.radians(east_longitude_deg)
    radius = LUNAR_RADIUS_KM + elevation_m / 1000.0
    observer = (radius * math.cos(lat) * math.cos(lon), radius * math.cos(lat) * math.sin(lon), radius * math.sin(lat))
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    sample_times: list[float] = []
    moon_offsets: list[list[float]] = []
    earth_offsets: list[list[float]] = []
    rotations: list[list[float]] = []
    # State order matches wasm-science::gravity: Sun, Mercury, Venus, EMB,
    # Mars, Jupiter, Saturn, Uranus, Neptune and Pluto, all relative to SSB.
    state_targets = ("10", "1", "2", "3", "4", "5", "6", "7", "8", "9")
    initial_state: list[float] = []
    try:
        for kernel in kernels:
            spice.furnsh(str(kernel_dir / kernel["name"]))
        current = start_utc.astimezone(timezone.utc)
        end = end_utc.astimezone(timezone.utc)
        step = timedelta(hours=step_hours)
        et0 = spice.str2et(current.strftime("%Y-%m-%dT%H:%M:%S"))
        for target in state_targets:
            state, _ = spice.spkezr(target, et0, "J2000", "NONE", "SSB")
            initial_state.extend(float(v) for v in state)
        while current <= end:
            time_string = current.strftime("%Y-%m-%dT%H:%M:%S")
            et = spice.str2et(time_string)
            sample_times.append(et)
            record: dict[str, float | str] = {"timestamp_utc": current.strftime("%Y-%m-%dT%H:%M:%SZ")}
            for body in ("SUN", "EARTH"):
                # Geometric directions keep the DE421 baseline and reduced
                # Newtonian GM scenario on the same reception-time convention.
                state, _light_time = spice.spkcpo(body, et, "MOON_ME", "OBSERVER", "NONE", observer, "MOON", "MOON_ME")
                az, el = topocentric_angles((float(state[0]), float(state[1]), float(state[2])), latitude_deg, east_longitude_deg)
                record[f"{body.lower()}_az_deg"] = az
                record[f"{body.lower()}_el_deg"] = el
            moon_state, _ = spice.spkezr("MOON", et, "J2000", "NONE", "3")
            earth_state, _ = spice.spkezr("EARTH", et, "J2000", "NONE", "3")
            moon_offsets.append([float(v) for v in moon_state[:3]])
            earth_offsets.append([float(v) for v in earth_state[:3]])
            rotations.append([float(v) for row in spice.pxform("MOON_ME", "J2000", et) for v in row])
            rows.append(record)
            current += step
    finally:
        spice.kclear()

    with output_csv.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=("timestamp_utc", "sun_az_deg", "sun_el_deg", "earth_az_deg", "earth_el_deg"))
        writer.writeheader()
        writer.writerows(rows)
    metadata = {
        "source": "JPL DE421 SPK with NAIF lunar PA PCK/FK and generic PCK",
        "reference_frame": "MOON_ME_DE421",
        "observer_model": "fixed spherical site; geometric directions (SPICE NONE correction)",
        "site": {"latitude_deg": latitude_deg, "east_longitude_deg": east_longitude_deg, "elevation_m": elevation_m},
        "time_scale_input": "UTC converted to TDB ET by SPICE",
        "start_utc": start_utc.isoformat(), "end_utc": end_utc.isoformat(), "step_hours": step_hours,
        "rows": len(rows), "kernels": kernels,
    }
    output_csv.with_suffix(output_csv.suffix + ".meta.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    if scenario_output is None:
        scenario_output = output_csv.with_name(output_csv.stem + "_gm_scenario.json")
    scenario = {
        "schema": "firstcontact-gm-scenario-input-v1",
        "source": "JPL DE421 SPK with NAIF lunar PA PCK/FK and generic PCK",
        "baseline_model": "DE421 geometric site directions (SPICE NONE correction)",
        "scenario_model": "Newtonian point-mass KDK sensitivity integration initialized from DE421 at start_utc",
        "scenario_caveats": ["Does not reproduce DE421 PPN terms, asteroid perturbations, solar J2, or the evolving lunar orbit/orientation under modified GMs.", "Use as a sensitivity scenario; do not label scenario output as DE421."],
        "initial_epoch_utc": rows[0]["timestamp_utc"], "initial_epoch_et_tdb_seconds": et0,
        "sample_step_seconds_nominal": step_hours * 3600,
        "state_body_order": ["Sun", "Mercury", "Venus", "Earth-Moon barycenter", "Mars", "Jupiter barycenter", "Saturn barycenter", "Uranus barycenter", "Neptune barycenter", "Pluto barycenter"],
        "state_units": {"position": "km", "velocity": "km/s", "frame": "J2000/ICRF", "origin": "Solar System Barycenter"},
        "gm_input_order": ["Sun", "Mercury", "Venus", "Earth", "Moon", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"],
        "geometry_units": {"offsets": "km relative to Earth-Moon barycenter in J2000", "rotation": "row-major MOON_ME to J2000 matrix"},
        "site": {"latitude_deg": latitude_deg, "east_longitude_deg": east_longitude_deg, "elevation_m": elevation_m},
        "sample_times_et_tdb_seconds": sample_times,
        "initial_state_km_km_s": initial_state,
        "moon_offsets_km": moon_offsets, "earth_offsets_km": earth_offsets,
        "moon_to_j2000_row_major": rotations,
        "baseline_csv": output_csv.name, "kernels": kernels,
    }
    scenario_output.parent.mkdir(parents=True, exist_ok=True)
    scenario_output.write_text(json.dumps(scenario, separators=(",", ":")) + "\n", encoding="utf-8")
    return len(rows)


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kernel-dir", type=Path, default=Path("data/kernels/de421"))
    parser.add_argument("--latitude", type=float, required=True)
    parser.add_argument("--longitude", type=float, required=True, help="east longitude in degrees")
    parser.add_argument("--elevation-m", type=float, default=0.0)
    parser.add_argument("--start-utc", required=True, help="ISO-8601 UTC, e.g. 2026-01-01T00:00:00Z")
    parser.add_argument("--end-utc", required=True, help="ISO-8601 UTC")
    parser.add_argument("--step-hours", type=int, default=1)
    parser.add_argument("--output", type=Path, required=True, help="output CSV path")
    parser.add_argument("--scenario-output", type=Path, help="scenario input JSON (defaults beside the CSV)")
    args = parser.parse_args()
    count = bake(parse_utc(args.start_utc), parse_utc(args.end_utc), args.latitude,
                 args.longitude, args.elevation_m, args.output, args.kernel_dir, args.step_hours, args.scenario_output)
    print(f"Wrote {count} DE421 observer records to {args.output}")
    print(f"Wrote DE421-seeded GM scenario inputs to {args.scenario_output or args.output.with_name(args.output.stem + '_gm_scenario.json')}")


if __name__ == "__main__":
    main()
