#!/usr/bin/env python3
"""Bake one LOLA GeoTIFF site into compact JSON and a 16-bit heightmap PNG.

Only rasterio and numpy are required. The DEM is read in bounded windows; this
script never loads the complete source GeoTIFF into memory.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import struct
import zlib
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.windows import Window

MOON_RADIUS_M = 1_737_400.0
PATCH_SIZE = 100
DISPERSION_OFFSETS_M = (-200, -100, 0, 100, 200)
RAY_CHUNK_POINTS = 128


def safe_id(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "-", value).strip("-")
    if not cleaned:
        raise ValueError("site id must contain at least one letter or digit")
    return cleaned


def write_gray16_png(path: Path, values: np.ndarray) -> tuple[float, float]:
    valid = np.isfinite(values)
    if not valid.any():
        raise ValueError("heightmap crop contains no valid elevation pixels")
    low = float(values[valid].min())
    high = float(values[valid].max())
    scale = (high - low) / 65535.0 if high > low else 1.0
    codes = np.zeros(values.shape, dtype=np.uint16)
    codes[valid] = np.clip(np.rint((values[valid] - low) / scale), 0, 65535).astype(np.uint16)
    h, w = codes.shape
    raw = b"".join(b"\0" + codes[row].astype(">u2", copy=False).tobytes() for row in range(h))

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", w, h, 16, 0, 0, 0, 0)
    payload = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(payload)
    return low, scale


def read_scalar(ds: rasterio.io.DatasetReader, row: int, col: int) -> float | None:
    if row < 0 or col < 0 or row >= ds.height or col >= ds.width:
        return None
    value = float(ds.read(1, window=Window(col, row, 1, 1), masked=True)[0, 0])
    return value if math.isfinite(value) else None


def local_slope_deg(ds: rasterio.io.DatasetReader, row: int, col: int, pixel_m: float) -> float | None:
    if row < 1 or col < 1 or row + 1 >= ds.height or col + 1 >= ds.width:
        return None
    win = Window(col - 1, row - 1, 3, 3)
    z = ds.read(1, window=win, masked=True).astype("float64").filled(np.nan)
    if not np.isfinite(z).all():
        return None
    dz_dx = (z[1, 2] - z[1, 0]) / (2 * pixel_m)
    dz_dy = (z[0, 1] - z[2, 1]) / (2 * pixel_m)
    return math.degrees(math.atan(math.hypot(dz_dx, dz_dy)))


def ensure_compatible(base: rasterio.io.DatasetReader, other: rasterio.io.DatasetReader, label: str) -> None:
    if (base.width, base.height) != (other.width, other.height) or base.transform != other.transform:
        raise ValueError(f"{label} raster must match DEM dimensions and pixel transform")
    if base.crs != other.crs:
        raise ValueError(f"{label} raster CRS must match DEM CRS")


def read_ephemeris_csv(path: Path | None) -> dict[str, list] | None:
    if path is None:
        return None
    fields = ("timestamp_utc", "sun_az_deg", "sun_el_deg", "earth_az_deg", "earth_el_deg")
    series: dict[str, list] = {"timestamps_utc": [], "sun_az_deg": [], "sun_el_deg": [], "earth_az_deg": [], "earth_el_deg": []}
    with path.open(newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        missing = set(fields) - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"ephemeris CSV is missing columns: {', '.join(sorted(missing))}")
        for row in reader:
            series["timestamps_utc"].append(row["timestamp_utc"])
            for body, angle in (("sun", "az"), ("sun", "el"), ("earth", "az"), ("earth", "el")):
                value = float(row[f"{body}_{angle}_deg"])
                if not math.isfinite(value):
                    raise ValueError("ephemeris CSV contains a non-finite angle")
                series[f"{body}_{angle}_deg"].append(round(value, 5))
    if not series["timestamps_utc"]:
        raise ValueError("ephemeris CSV contains no data rows")
    if any(len(v) != len(series["timestamps_utc"]) for v in series.values()):
        raise ValueError("ephemeris arrays have inconsistent lengths")
    return series


def _sample_window(ds: rasterio.io.DatasetReader, rows: np.ndarray, cols: np.ndarray, selected: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    indexes = np.flatnonzero(selected)
    values = np.full(len(rows), np.nan, dtype=np.float64)
    valid = np.zeros(len(rows), dtype=bool)
    if not len(indexes):
        return values, valid
    rr, cc = rows[indexes], cols[indexes]
    win = Window(int(cc.min()), int(rr.min()), int(cc.max() - cc.min() + 1), int(rr.max() - rr.min() + 1))
    block = ds.read(1, window=win, masked=True).astype("float64").filled(np.nan)
    sampled = block[rr - int(rr.min()), cc - int(cc.min())]
    ok = np.isfinite(sampled)
    values[indexes[ok]] = sampled[ok]
    valid[indexes[ok]] = True
    return values, valid


def horizon_profile(ds: rasterio.io.DatasetReader, center_row: int, center_col: int, center_z: float,
                    pixel_m: float, radius_m: float, regional_ds: rasterio.io.DatasetReader | None = None) -> tuple[list[float], list[float], list[float]]:
    step_m = max(pixel_m, 25.0)
    distances = np.arange(step_m, radius_m + step_m * 0.5, step_m, dtype=np.float64)
    h0: list[float] = []
    critical: list[float] = []
    coverage: list[float] = []
    x0, y0 = ds.xy(center_row, center_col)
    if regional_ds is not None:
        regional_pixel = abs(regional_ds.transform.a)
        if abs(regional_pixel - abs(regional_ds.transform.e)) > 1e-5 or regional_pixel <= 0:
            raise ValueError("regional DEM must have square pixels")
        if abs(regional_ds.transform.b) > 1e-9 or abs(regional_ds.transform.d) > 1e-9 or regional_ds.transform.e >= 0:
            raise ValueError("regional DEM must be north-up")
        from rasterio.warp import transform as transform_coords
        regional_x, regional_y = transform_coords(ds.crs, regional_ds.crs, [x0], [y0])
        if math.hypot(regional_x[0] - x0, regional_y[0] - y0) > 1.0:
            raise ValueError("regional DEM must use the same MOON_ME projected coordinates as the local DEM")
        regional_center_row, regional_center_col = regional_ds.index(regional_x[0], regional_y[0])
    for az in range(360):
        theta = math.radians(az)
        # South-polar stereographic axes: +X east, +Y north; raster rows grow south.
        cols = center_col + distances * math.sin(theta) / pixel_m
        rows = center_row - distances * math.cos(theta) / pixel_m
        best_angle = -90.0
        best_distance = step_m
        farthest_valid = 0.0
        for start in range(0, len(distances), RAY_CHUNK_POINTS):
            dslice = distances[start:start + RAY_CHUNK_POINTS]
            rslice = np.rint(rows[start:start + RAY_CHUNK_POINTS]).astype(np.int64)
            cslice = np.rint(cols[start:start + RAY_CHUNK_POINTS]).astype(np.int64)
            inside = (rslice >= 0) & (cslice >= 0) & (rslice < ds.height) & (cslice < ds.width)
            z, valid = _sample_window(ds, rslice, cslice, inside)
            if regional_ds is not None and not valid.all():
                regional_rs = np.rint(regional_center_row - dslice * math.cos(theta) / regional_pixel).astype(np.int64)
                regional_cs = np.rint(regional_center_col + dslice * math.sin(theta) / regional_pixel).astype(np.int64)
                regional_inside = (~valid) & (regional_rs >= 0) & (regional_cs >= 0) & (regional_rs < regional_ds.height) & (regional_cs < regional_ds.width)
                regional_z, regional_valid = _sample_window(regional_ds, regional_rs, regional_cs, regional_inside)
                z[regional_valid] = regional_z[regional_valid]
                valid |= regional_valid
            if not valid.any():
                continue
            valid_d = dslice[valid]
            farthest_valid = max(farthest_valid, float(valid_d.max()))
            angles = np.degrees(np.arctan((z[valid] - center_z - valid_d**2 / (2.0 * MOON_RADIUS_M)) / valid_d))
            idx = int(np.argmax(angles))
            if float(angles[idx]) > best_angle:
                best_angle = float(angles[idx])
                best_distance = float(valid_d[idx])
        h0.append(round(best_angle, 5))
        critical.append(round(best_distance, 2))
        coverage.append(round(farthest_valid, 1))
    return h0, critical, coverage


def dispersion_grid(dem: rasterio.io.DatasetReader, slope_ds: rasterio.io.DatasetReader | None,
                    uncertainty_ds: rasterio.io.DatasetReader | None, center_row: int, center_col: int,
                    pixel_m: float) -> list[dict[str, Any]]:
    grid = []
    for dy in reversed(DISPERSION_OFFSETS_M):
        for dx in DISPERSION_OFFSETS_M:
            col = round(center_col + dx / pixel_m)
            row = round(center_row - dy / pixel_m)
            z = read_scalar(dem, row, col)
            slope = read_scalar(slope_ds, row, col) if slope_ds else local_slope_deg(dem, row, col, pixel_m)
            uncertainty = read_scalar(uncertainty_ds, row, col) if uncertainty_ds else None
            status = "OUTSIDE_DATA" if z is None else ("MISSION_LOSS_TRAP" if slope is not None and slope >= 12.0 else ("CAUTION" if slope is not None and slope >= 8.0 else "SAFE"))
            grid.append({"dx_m": dx, "dy_m": dy,
                "elevation_m": round(z, 3) if z is not None else None,
                "slope_deg": round(slope, 3) if slope is not None else None,
                "rms_height_uncertainty_m": round(uncertainty, 3) if uncertainty is not None else None,
                "status": status})
    return grid


def bake(args: argparse.Namespace) -> dict[str, Any]:
    sid = safe_id(args.site_id)
    with rasterio.open(args.dem) as dem:
        if dem.count < 1 or dem.crs is None or not dem.crs.is_projected:
            raise ValueError("DEM must have at least one band and a defined CRS")
        if getattr(dem.crs, "linear_units", "metre").lower() not in ("metre", "meter", "metres", "meters"):
            raise ValueError("DEM projected CRS units must be metres")
        tr = dem.transform
        if abs(tr.b) > 1e-9 or abs(tr.d) > 1e-9 or tr.a <= 0 or tr.e >= 0:
            raise ValueError("expected north-up raster with +X east and +Y north")
        pixel_x, pixel_y = abs(tr.a), abs(tr.e)
        if abs(pixel_x - pixel_y) > 1e-5:
            raise ValueError("expected square pixels in projected metres")
        pixel_m = pixel_x
        if abs(pixel_m - 5.0) > 0.05:
            raise ValueError(f"source pixel size is {pixel_m:g} m; this baker expects 5 m/pixel so its 100x100 patch is 500 m square")
        row, col = args.center_row, args.center_col
        if not (0 <= row < dem.height and 0 <= col < dem.width):
            raise ValueError("center row/column lies outside the DEM")
        center_z = read_scalar(dem, row, col)
        if center_z is None:
            raise ValueError("center pixel is NoData")
        crop_col, crop_row = col - PATCH_SIZE // 2, row - PATCH_SIZE // 2
        if crop_col < 0 or crop_row < 0 or crop_col + PATCH_SIZE > dem.width or crop_row + PATCH_SIZE > dem.height:
            raise ValueError("100x100 patch around center extends beyond DEM bounds")
        crop = dem.read(1, window=Window(crop_col, crop_row, PATCH_SIZE, PATCH_SIZE), masked=True).astype("float32").filled(np.nan)
        regional_ds = rasterio.open(args.regional_dem) if args.regional_dem else None
        slope_ds = rasterio.open(args.slope) if args.slope else None
        uncertainty_ds = rasterio.open(args.uncertainty) if args.uncertainty else None
        try:
            if slope_ds:
                ensure_compatible(dem, slope_ds, "slope")
            if uncertainty_ds:
                ensure_compatible(dem, uncertainty_ds, "uncertainty")
            center_slope = read_scalar(slope_ds, row, col) if slope_ds else local_slope_deg(dem, row, col, pixel_m)
            center_uncertainty = read_scalar(uncertainty_ds, row, col) if uncertainty_ds else None
            grid = dispersion_grid(dem, slope_ds, uncertainty_ds, row, col, pixel_m)
            h0, dcrit, coverage = horizon_profile(dem, row, col, center_z, pixel_m, args.radius_m, regional_ds)
        finally:
            if regional_ds:
                regional_ds.close()
            if slope_ds:
                slope_ds.close()
            if uncertainty_ds:
                uncertainty_ds.close()
        if min(coverage) < args.radius_m * 0.95:
            print(f"WARNING: minimum ray coverage is {min(coverage):.0f} m, less than requested {args.radius_m:.0f} m")

        args.output_dir.mkdir(parents=True, exist_ok=True)
        png_name = f"{sid}_heightmap.png"
        min_z, z_scale = write_gray16_png(args.output_dir / png_name, crop)
        mask = dem.dataset_mask(window=Window(crop_col, crop_row, PATCH_SIZE, PATCH_SIZE))
        site = {
            "site_metadata": {"site_id": sid, "name": args.name, "lat_deg": args.latitude,
                "lon_deg": args.longitude, "elevation_m": round(center_z, 3),
                "slope_deg": round(center_slope, 3) if center_slope is not None else None,
                "rms_height_uncertainty_m": round(center_uncertainty, 3) if center_uncertainty is not None else None,
                "reference_frame": args.reference_frame},
            "provenance": {"mode": "validated_computed", "dem_source": str(Path(args.dem)),
                "slope_source": str(Path(args.slope)) if args.slope else None,
                "uncertainty_source": str(Path(args.uncertainty)) if args.uncertainty else None,
                "pixel_size_m": pixel_m, "center_pixel": {"row": row, "col": col},
                "source_crs": dem.crs.to_string(),
                "ray_step_m": max(pixel_m, 25.0), "ray_radius_requested_m": args.radius_m,
                "ray_coverage_min_m": min(coverage), "regional_dem_source": args.regional_dem,
                "curvature_radius_m": MOON_RADIUS_M,
                "heightmap_png": png_name, "heightmap_mask_valid_pixels": int(np.count_nonzero(mask))},
            "heightmap": {"width": PATCH_SIZE, "height": PATCH_SIZE, "bit_depth": 16,
                "minimum_elevation_m": round(min_z, 3), "meters_per_code": z_scale},
            "horizon_mask_360": {"h0_deg": h0, "d_crit_m": dcrit},
            "dispersion_grid_5x5": grid,
        }
        ephemeris = read_ephemeris_csv(args.ephemeris_csv)
        if ephemeris is not None:
            site["time_series"] = ephemeris
            site["provenance"]["ephemeris_source"] = str(Path(args.ephemeris_csv))

    output_file = args.output_dir / "baked_lunar_sites.json"
    existing: dict[str, Any] = {"sites": []}
    if output_file.exists():
        existing = json.loads(output_file.read_text(encoding="utf-8"))
        if not isinstance(existing.get("sites"), list):
            raise ValueError("existing output JSON must contain a sites array")
    sites = [s for s in existing["sites"] if s.get("site_metadata", {}).get("site_id") != sid]
    sites.append(site)
    existing["sites"] = sites
    output_file.write_text(json.dumps(existing, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {sid}; JSON size {output_file.stat().st_size:,} bytes; patch PNG {args.output_dir / png_name}")
    return site


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dem", type=Path, required=True, help="5 m/pixel surface elevation GeoTIFF")
    parser.add_argument("--regional-dem", help="optional broader, coarser DEM, local path or GDAL /vsicurl URL, for rays outside the high-resolution raster")
    parser.add_argument("--slope", type=Path, help="optional matching slope GeoTIFF (degrees)")
    parser.add_argument("--uncertainty", type=Path, help="optional matching total-Z RMS uncertainty GeoTIFF (metres)")
    parser.add_argument("--ephemeris-csv", type=Path, help="optional hourly CSV with timestamp_utc and Sun/Earth az/el columns")
    parser.add_argument("--site-id", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--latitude", type=float, required=True, help="site latitude, degrees")
    parser.add_argument("--longitude", type=float, required=True, help="east longitude, degrees")
    parser.add_argument("--reference-frame", default="unknown", help="declared raster frame, e.g. MOON_ME (verify from source metadata)")
    parser.add_argument("--center-row", type=int, required=True, help="selected landing point row in input DEM")
    parser.add_argument("--center-col", type=int, required=True, help="selected landing point column in input DEM")
    parser.add_argument("--radius-m", type=float, default=30_000.0)
    parser.add_argument("--output-dir", type=Path, default=Path("frontend/public/data"))
    args = parser.parse_args()
    if not -90 <= args.latitude <= 90 or not -360 <= args.longitude <= 360 or args.radius_m <= 0:
        parser.error("latitude, longitude, or radius is outside supported bounds")
    bake(args)


if __name__ == "__main__":
    main()
