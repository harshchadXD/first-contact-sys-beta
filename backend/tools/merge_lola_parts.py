#!/usr/bin/env python3
"""Merge the four parallel LOLA/DE421 bake parts into the shipped dataset.

The bake is intentionally parallelised into four processes, each writing a
checkpointed ``partN.json``. This tool verifies every record before publishing
``public/data/baked_lunar_sites.json`` and rebuilds the provenance manifest, so
a partially-written part can never be shipped.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PARTS = [ROOT / "data" / "lola" / "parts" / f"part{index}.json" for index in range(1, 5)]
OUTPUT = ROOT / "public" / "data" / "baked_lunar_sites.json"
MANIFEST = ROOT / "data" / "lola" / "bake_manifest.json"

SITE_ORDER = [
    "PGDA-01",
    "PGDA-20",
    "PGDA-04",
    "ISRO-CY3",
    "PGDA-02",
    "PGDA-06",
    "PGDA-07",
    "PGDA-08",
    "PGDA-11",
    "PGDA-12",
    "PGDA-14",
    "PGDA-16",
    "PGDA-18",
    "PGDA-23",
    "MOCK-01",
]

EXPECTED_SAMPLES = 91 * 24 + 1  # 2026-12-01T00:00Z .. 2027-03-02T00:00Z, hourly


def fail(message: str) -> None:
    raise SystemExit(f"merge refused: {message}")


def load_sites() -> list[dict[str, Any]]:
    sites: list[dict[str, Any]] = []
    for path in PARTS:
        if not path.exists():
            fail(f"missing part file {path.relative_to(ROOT)}")
        payload = json.loads(path.read_text(encoding="utf-8"))
        part_sites = payload.get("sites")
        if not isinstance(part_sites, list) or not part_sites:
            fail(f"{path.name} has no sites")
        sites.extend(part_sites)
    return sites


def validate(sites: list[dict[str, Any]]) -> None:
    identifiers = [site.get("site_metadata", {}).get("site_id") for site in sites]
    if len(identifiers) != len(set(identifiers)):
        fail("duplicate site ids across parts")
    if sorted(identifiers) != sorted(SITE_ORDER):
        missing = sorted(set(SITE_ORDER) - set(identifiers))
        extra = sorted(set(identifiers) - set(SITE_ORDER))
        fail(f"site set mismatch; missing={missing} extra={extra}")

    for site in sites:
        site_id = site["site_metadata"]["site_id"]
        horizon = site.get("horizon_mask_360", {})
        for key in ("h0_deg", "d_crit_m"):
            values = horizon.get(key)
            if not isinstance(values, list) or len(values) != 360:
                fail(f"{site_id}: {key} must contain 360 samples")

        grid = site.get("dem_grid_101", {})
        elevation = grid.get("relative_elevations_m")
        if not isinstance(elevation, list) or len(elevation) != 101 * 101:
            fail(f"{site_id}: dem_grid_101 must contain 101x101 elevations")

        dispersion = site.get("dispersion_grid_5x5")
        if not isinstance(dispersion, list) or len(dispersion) != 25:
            fail(f"{site_id}: dispersion_grid_5x5 must contain 25 cells")
        offsets = {(cell.get("dx_m"), cell.get("dy_m")) for cell in dispersion}
        expected = {(dx * 100 - 200, 200 - dy * 100) for dy in range(5) for dx in range(5)}
        if offsets != expected:
            fail(f"{site_id}: dispersion offsets do not match the 5x5 grid")

        ephemeris = site.get("ephemeris", {})
        series = [ephemeris.get(key) for key in ("sun_az_deg", "sun_el_deg", "earth_az_deg", "earth_el_deg")]
        if any(not isinstance(values, list) or len(values) != EXPECTED_SAMPLES for values in series):
            fail(f"{site_id}: ephemeris series must contain {EXPECTED_SAMPLES} hourly samples")
        if ephemeris.get("step_hours") != 1:
            fail(f"{site_id}: ephemeris step must be 1 hour")

        metadata = site["site_metadata"]
        provenance = site.get("provenance", {})
        if metadata.get("nearest_psr_km") is None and provenance.get("terrain_fidelity") == "synthetic":
            continue
        if metadata.get("nearest_psr_km") is None and site_id != "ISRO-CY3":
            fail(f"{site_id}: expected a PSR distance or an explicit out-of-coverage case")


def manifest_payload(sites: list[dict[str, Any]], previous: dict[str, Any]) -> dict[str, Any]:
    sources = previous.get("terrain_sources", {})
    ephemeris = previous.get("ephemeris", {})
    return {
        "schema": "firstcontact-lola-de421-bake-v2",
        "baked_at_utc": datetime.now(timezone.utc).isoformat(),
        "terrain_sources": sources,
        "ephemeris": ephemeris,
        "sites": [
            {
                "site_id": site["site_metadata"]["site_id"],
                "lat_deg": site["site_metadata"]["lat_deg"],
                "lon_deg": site["site_metadata"]["lon_deg"],
                "elevation_m": site["site_metadata"]["elevation_m"],
                "pixel_size_m": site["site_metadata"]["pixel_size_m"],
                "slope_deg": site["site_metadata"]["slope_deg"],
                "rms_height_uncertainty_m": site["site_metadata"]["rms_height_uncertainty_m"],
                "nearest_psr_km": site["site_metadata"].get("nearest_psr_km"),
                "terrain_fidelity": site["provenance"]["terrain_fidelity"],
            }
            for site in sites
        ],
    }


def write_json(path: Path, payload: dict[str, Any], *, compact: bool) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    if compact:
        text = json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n"
    else:
        text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    temporary.write_text(text, encoding="utf-8")
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate parts without writing outputs")
    args = parser.parse_args()

    sites = load_sites()
    validate(sites)
    ordered = sorted(sites, key=lambda site: SITE_ORDER.index(site["site_metadata"]["site_id"]))

    if args.check:
        print(f"validated {len(ordered)} sites; no files written")
        return

    previous: dict[str, Any] = {}
    if MANIFEST.exists():
        previous = json.loads(MANIFEST.read_text(encoding="utf-8"))

    write_json(OUTPUT, {"sites": ordered}, compact=True)
    write_json(MANIFEST, manifest_payload(ordered, previous), compact=False)

    for site in ordered:
        metadata = site["site_metadata"]
        psr = metadata.get("nearest_psr_km")
        print(
            f"{metadata['site_id']:<10} elev {metadata['elevation_m']:>8.1f} m  "
            f"slope {metadata['slope_deg']:>6.3f} deg  "
            f"PSR {('n/a' if psr is None else f'{psr:.3f} km')}"
        )
    print(f"wrote {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)")
    print(f"wrote {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
