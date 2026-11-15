#!/usr/bin/env python3
"""Generate a dependency-free synthetic lunar DEM, JSON site record, and PNG."""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
import math
import struct
import zlib
from pathlib import Path


def png_gray16(rows: list[list[int]]) -> bytes:
    """Encode a rectangular 16-bit grayscale PNG using only Python stdlib."""
    height = len(rows)
    width = len(rows[0]) if height else 0
    if not width or any(len(row) != width for row in rows):
        raise ValueError("heightmap must be a non-empty rectangle")
    raw = bytearray()
    for row in rows:
        raw.append(0)  # PNG filter: None
        for value in row:
            raw.extend(struct.pack(">H", max(0, min(65535, int(value)))))

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 16, 0, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def build_mock(width: int = 100, height: int = 100, pixel_m: float = 5.0) -> tuple[dict, list[list[int]]]:
    if width < 8 or height < 8 or pixel_m <= 0:
        raise ValueError("width and height must be >= 8; pixel size must be positive")
    # Synthetic bowl with asymmetric ridges and a crater-like depression.
    center_x, center_y = width * 0.56, height * 0.48
    elevations: list[list[float]] = []
    for row in range(height):
        line = []
        for col in range(width):
            x, y = (col - center_x) * pixel_m, (center_y - row) * pixel_m
            bowl = -17.0 * math.exp(-((x - 95) ** 2 / 13_000 + (y + 20) ** 2 / 7_000))
            ridge_n = 11.0 * math.exp(-((y - 115) / 48) ** 2) * math.exp(-(x / 290) ** 2)
            ridge_e = 7.0 * math.exp(-((x - 155) / 42) ** 2) * math.exp(-(y / 280) ** 2)
            waviness = 1.2 * math.sin(x / 54) * math.cos(y / 67) + 0.45 * math.sin((x + y) / 21)
            line.append(120.0 + bowl + ridge_n + ridge_e + waviness)
        elevations.append(line)
    lo, hi = min(map(min, elevations)), max(map(max, elevations))
    scale = (hi - lo) / 65535.0 if hi > lo else 1.0
    pixels = [[round((z - lo) / scale) for z in row] for row in elevations]

    horizons: list[float] = []
    distances: list[float] = []
    # A deterministic synthetic 360-degree horizon mask for interface wiring.
    for az in range(360):
        a = math.radians(az)
        h = 1.05 + 0.58 * math.sin(3 * a + 0.4) + 0.32 * math.cos(7 * a - 0.2)
        h += 1.6 * math.exp(-((az - 72 + 180) % 360 - 180) ** 2 / 230)
        h += 2.1 * math.exp(-((az - 248 + 180) % 360 - 180) ** 2 / 150)
        horizons.append(round(h, 3))
        distances.append(round(1800 + 700 * (1 + math.sin(2 * a + 0.7)), 1))

    grid = []
    for dy in (200, 100, 0, -100, -200):
        for dx in (-200, -100, 0, 100, 200):
            dist = math.hypot(dx, dy)
            slope = round(3.1 + 8.0 * math.exp(-((dx - 100) ** 2 + (dy + 100) ** 2) / 40_000) + 0.012 * dist, 1)
            status = "MISSION_LOSS_TRAP" if slope >= 12 else ("CAUTION" if slope >= 8 else "SAFE")
            grid.append({"dx_m": dx, "dy_m": dy, "elevation_m": round(120 - 0.012 * dist, 1),
                         "slope_deg": slope, "rms_height_uncertainty_m": None, "status": status})

    # 59 synthetic days support Lead 1's 30 launch-slip windows of 30 days.
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    timestamps, sun_az, sun_el, earth_az, earth_el = [], [], [], [], []
    hours = 59 * 24
    for hour in range(hours):
        lunar_phase = 2 * math.pi * hour / (29.53 * 24)
        day_angle = 2 * math.pi * (hour % 24) / 24
        timestamps.append((base + timedelta(hours=hour)).strftime("%Y-%m-%dT%H:%M:%SZ"))
        sun_az.append(round((42 + 14 * math.sin(lunar_phase) + 5 * math.sin(day_angle / 2)) % 360, 3))
        sun_el.append(round(-2 + 5 * max(0.0, math.sin(day_angle - 0.8)) + 2 * math.sin(lunar_phase), 3))
        earth_az.append(round((185 + 7 * math.sin(lunar_phase + 0.5)) % 360, 3))
        earth_el.append(round(8 + 4 * math.sin(lunar_phase - 0.2), 3))

    site = {
        "site_metadata": {"site_id": "MOCK-01", "name": "Synthetic Lunar Test Site", "lat_deg": -84.79,
            "lon_deg": 29.20, "elevation_m": 120.0, "slope_deg": 3.1,
            "rms_height_uncertainty_m": None, "reference_frame": "SYNTHETIC (not a lunar observation)"},
        "provenance": {"mode": "synthetic_mock", "dem_source": "Procedural synthetic terrain; not NASA data",
            "pixel_size_m": pixel_m, "heightmap_png": "MOCK-01_heightmap.png"},
        "heightmap": {"width": width, "height": height, "bit_depth": 16,
            "minimum_elevation_m": round(lo, 3), "meters_per_code": scale},
        "horizon_mask_360": {"h0_deg": horizons, "d_crit_m": distances},
        "horizon_profile": {"azimuth_deg": list(range(360)), "elevation_h0_deg": horizons, "d_crit_m": distances},
        "time_series": {"timestamps_utc": timestamps, "sun_az_deg": sun_az, "sun_el_deg": sun_el,
            "earth_az_deg": earth_az, "earth_el_deg": earth_el},
        "dispersion_grid_5x5": grid,
    }
    return site, pixels


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=Path("frontend/public/data"))
    parser.add_argument("--width", type=int, default=100)
    parser.add_argument("--height", type=int, default=100)
    parser.add_argument("--pixel-size-m", type=float, default=5.0)
    args = parser.parse_args()
    site, pixels = build_mock(args.width, args.height, args.pixel_size_m)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    png_name = "MOCK-01_heightmap.png"
    site["provenance"]["heightmap_png"] = png_name
    (args.output_dir / png_name).write_bytes(png_gray16(pixels))
    (args.output_dir / "baked_lunar_sites.json").write_text(
        json.dumps({"sites": [site]}, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"Wrote synthetic test site and heightmap to {args.output_dir.resolve()}")
    print("Synthetic values are for development only and must not be presented as measured lunar data.")


if __name__ == "__main__":
    main()
