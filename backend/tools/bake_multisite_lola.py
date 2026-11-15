#!/usr/bin/env python3
"""Bake the real LOLA terrain and JPL DE421 sky for every FIRST CONTACT site.

The script reads bounded windows from the public NASA GSFC PGDA cloud-optimized
GeoTIFFs, so it never downloads the multi-gigabyte source rasters.  Each site
gets:

  * a 101x101 local elevation grid at 5 m spacing (bilinear from the source DEM),
  * a 360-degree ray-cast terrain horizon and critical-obstacle distance,
  * a 5x5 landing-dispersion grid with real elevation, slope and height error,
  * a nearest-PSR / PSR-area metric from the published LOLA PSR map,
  * hourly DE421 topocentric Sun and Earth angles for the 2026-12-01 through
    2027-03-02 operations envelope.

Outputs:
  public/data/baked_lunar_sites.json
  public/data/<site-id>_heightmap.png
  data/lola/bake_manifest.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import sys
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.warp import transform as transform_coords
from rasterio.windows import Window

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import spiceypy as spice  # noqa: E402
from bake_ephemeris import kernel_manifest, topocentric_angles  # noqa: E402

MOON_RADIUS_M = 1_737_400.0
MOON_RADIUS_KM = 1_737.4
PATCH_SIZE = 100
GRID_SIZE = 101
GRID_SPACING_M = 5.0
DISPERSION_OFFSETS_M = (-200, -100, 0, 100, 200)
HORIZON_RADIUS_M = 30_000.0
HORIZON_STEP_M = 25.0
EPHEMERIS_START = datetime(2026, 12, 1, tzinfo=timezone.utc)
EPHEMERIS_END = datetime(2027, 3, 2, tzinfo=timezone.utc)
EPHEMERIS_STEP_HOURS = 1

GEO_CRS = CRS.from_proj4("+proj=longlat +R=1737400 +no_defs")

PRODUCT_20M = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp"
PRODUCT_60M = PRODUCT_20M
SITE04_5M = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04"

SOURCE_80S20 = {
    "id": "ldem_80s_20mpp_adj",
    "label": "NASA GSFC PGDA LOLA 20 m/px south-polar DEM (LDEM_80S_20MPP_ADJ; Barker et al. 2023)",
    "dem_url": f"{PRODUCT_20M}/LDEM_80S_20MPP_ADJ.TIF",
    "slope_url": f"{PRODUCT_20M}/LDSM_80S_20MPP_ADJ.TIF",
    "error_url": f"{PRODUCT_20M}/LDEM_80S_20MPP_ADJ_ERR.TIF",
    "slope_error_url": f"{PRODUCT_20M}/LDSM_80S_20MPP_ADJ_ERR.TIF",
    "psr_url": f"{PRODUCT_20M}/LPSR_80S_20MPP_ADJ.TIF",
    "pixel_m": 20.0,
    "regional_pixel_m": 20.0,
    "coverage": "80S-90S",
}

SOURCE_CY3_60M = {
    "id": "ldem_60s_60mpp_adj",
    "label": "NASA GSFC PGDA LOLA 60 m/px south-polar DEM (LDEM_60S_60MPP_ADJ; Barker et al. 2023)",
    "dem_url": f"{PRODUCT_60M}/LDEM_60S_60MPP_ADJ.TIF",
    "slope_url": f"{PRODUCT_60M}/LDSM_60S_60MPP_ADJ.TIF",
    "error_url": f"{PRODUCT_60M}/LDEM_60S_60MPP_ADJ_ERR.TIF",
    "slope_error_url": f"{PRODUCT_60M}/LDSM_60S_60MPP_ADJ_ERR.TIF",
    "psr_url": None,
    "pixel_m": 60.0,
    "regional_pixel_m": 60.0,
    "coverage": "60S-90S",
}

SOURCE_SITE04_5M = {
    "id": "site04_final_adj_5mpp",
    "label": "NASA GSFC PGDA Site04 LOLA 5 m/px DEM + 20 m/px regional DEM",
    "dem_url": f"{SITE04_5M}/Site04_final_adj_5mpp_surf.tif",
    "slope_url": f"{SITE04_5M}/Site04_final_adj_5mpp_slp.tif",
    "error_url": f"{SITE04_5M}/Site04_final_adj_5mpp_toterr.tif",
    "slope_error_url": f"{SITE04_5M}/Site04_final_adj_5mpp_slperr.tif",
    "regional_dem_url": f"{PRODUCT_20M}/LDEM_80S_20MPP_ADJ.TIF",
    "psr_url": f"{PRODUCT_20M}/LPSR_80S_20MPP_ADJ.TIF",
    "pixel_m": 5.0,
    "regional_pixel_m": 20.0,
    "coverage": "Site04 5 m local + 80S-90S regional",
}

# The first 14 entries are real LOLA sites. MOCK-01 is explicitly synthetic and
# exists only as a flat mathematical calibration case.
SITES: list[dict[str, Any]] = [
    {
        "id": "PGDA-01",
        "name": "Connecting Ridge (Artemis III)",
        "short": "Connecting Ridge",
        "lat": -89.4632,
        "lon": -137.49,
        "context": "Artemis III candidate ridge bridging Shackleton and de Gerlache craters",
        "source": SOURCE_80S20,
    },
    {
        "id": "PGDA-02",
        "name": "Faustini Rim A (Artemis III)",
        "short": "Faustini Rim",
        "lat": -87.1245,
        "lon": 67.0412,
        "context": "High-illumination crest bordering volatile-rich cold traps inside Faustini Crater",
        "source": SOURCE_80S20,
    },
    {
        "id": "PGDA-04",
        "name": "Shackleton Crater Rim",
        "short": "Shackleton Rim",
        # Published Site04 ROI center (row 1600, col 1600 in the 5 m product).
        "lat": -89.7667415,
        "lon": -171.8928091,
        "context": "High-illumination polar crest adjacent to a deep permanently shadowed crater",
        "source": SOURCE_SITE04_5M,
    },
    {
        "id": "PGDA-06",
        "name": "Nobile Rim 1 (VIPER Zone)",
        "short": "Nobile Rim 1",
        "lat": -85.4381,
        "lon": 37.3667,
        "context": "Astrobotic Griffin / NASA VIPER volatile prospecting baseline region",
        "source": SOURCE_80S20,
    },
    {
        "id": "PGDA-07",
        "name": "Peak Near Shackleton",
        "short": "Shackleton Peak",
        "lat": -88.811,
        "lon": 123.6901,
        "context": "High-elevation polar peak with long horizon lines of sight",
        "source": SOURCE_80S20,
    },
    {
        "id": "PGDA-08",
        "name": "Haworth Crater Rim (Artemis III)",
        "short": "Haworth Rim",
        "lat": -87.4215,
        "lon": -5.1324,
        "context": "Rim adjacent to the Haworth permanent-shadow region",
        "source": SOURCE_80S20,
    },
    {
        "id": "PGDA-11",
        "name": "de Gerlache Rim 1",
        "short": "de Gerlache",
        "lat": -88.6834,
        "lon": -67.9321,
        "context": "High solar persistence crest overlooking volatile-rich cold traps",
        "source": SOURCE_80S20,
    },
    {
        "id": "PGDA-12",
        "name": "de Gerlache Rim 2 (Artemis III)",
        "short": "de Gerlache 2",
        "lat": -88.3418,
        "lon": -75.1235,
        "context": "Elevated western ridge with a long continuous solar line of sight",
        "source": SOURCE_80S20,
    },
    {
        "id": "PGDA-14",
        "name": "Amundsen Crater Rim (Artemis III)",
        "short": "Amundsen Rim",
        "lat": -84.5218,
        "lon": 82.8142,
        "context": "Broad landing plateau with high solar persistence and direct-to-Earth geometry",
        "source": SOURCE_80S20,
    },
    {
        "id": "PGDA-16",
        "name": "Nobile Rim 2 (Artemis III)",
        "short": "Nobile Rim 2",
        "lat": -85.1241,
        "lon": 43.1518,
        "context": "Nobile eastern ridge with low-slope terrain near volatile-bearing micro-cold traps",
        "source": SOURCE_80S20,
    },
    {
        "id": "PGDA-18",
        "name": "Leibnitz Beta Plateau (Artemis III)",
        "short": "Leibnitz Beta",
        "lat": -85.7812,
        "lon": 31.4219,
        "context": "Near-polar highland plateau with high elevation and wide Earth visibility",
        "source": SOURCE_80S20,
    },
    {
        "id": "PGDA-20",
        "name": "Mons Mouton Plateau (IM-2)",
        "short": "Mons Mouton",
        "lat": -84.7906,
        "lon": 29.1957,
        "context": "Intuitive Machines IM-2 Athena target plateau beside a 300 m crater loss zone",
        "source": SOURCE_80S20,
    },
    {
        "id": "PGDA-23",
        "name": "Malapert Massif (IM-1 Region)",
        "short": "Malapert Massif",
        "lat": -85.9948,
        "lon": -0.2358,
        "context": "Near-side polar massif with direct-to-Earth visibility",
        "source": SOURCE_80S20,
    },
    {
        "id": "ISRO-CY3",
        "name": "Shiv Shakti Point (Chandrayaan-3)",
        "short": "Shiv Shakti",
        "lat": -69.3676,
        "lon": 32.3481,
        "context": "Successful ISRO Vikram landing benchmark at 69.37 degrees south",
        "source": SOURCE_CY3_60M,
    },
    {
        "id": "MOCK-01",
        "name": "Synthetic Flat Calibration Benchmark",
        "short": "Calibration MOCK",
        "lat": -84.79,
        "lon": 29.2,
        "context": "Explicitly synthetic zero-slope plane used only for numerical sanity checks",
        "source": None,
    },
]


def safe_id(value: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in value).strip("-")
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


def open_remote(url: str) -> rasterio.io.DatasetReader:
    return rasterio.open(url)


def read_box(ds: rasterio.io.DatasetReader, x: float, y: float, half_extent_m: float) -> tuple[np.ndarray, float, float, float]:
    """Read a square window and return (array, west, north, pixel_size_m)."""
    pixel = abs(ds.transform.a)
    half_px = int(math.ceil(half_extent_m / pixel))
    row, col = ds.index(x, y)
    row0 = max(0, row - half_px)
    col0 = max(0, col - half_px)
    row1 = min(ds.height, row + half_px + 1)
    col1 = min(ds.width, col + half_px + 1)
    if row1 <= row0 or col1 <= col0:
        raise ValueError("requested window lies outside raster")
    data = ds.read(1, window=Window(col0, row0, col1 - col0, row1 - row0), masked=True)
    arr = data.astype("float64").filled(np.nan)
    west, north = ds.xy(row0, col0, offset="ul")
    return arr, west, north, pixel


def bilinear(arr: np.ndarray, west: float, north: float, pixel: float, x: np.ndarray | float, y: np.ndarray | float) -> np.ndarray:
    """Bilinearly sample an array whose upper-left pixel corner is (west, north)."""
    x_arr = np.asarray(x, dtype="float64")
    y_arr = np.asarray(y, dtype="float64")
    col = (x_arr - west) / pixel - 0.5
    row = (north - y_arr) / pixel - 0.5
    r0 = np.floor(row).astype(np.int64)
    c0 = np.floor(col).astype(np.int64)
    wr = row - r0
    wc = col - c0
    out = np.full(x_arr.shape, np.nan, dtype="float64")
    valid = (r0 >= 0) & (c0 >= 0) & (r0 + 1 < arr.shape[0]) & (c0 + 1 < arr.shape[1])
    if valid.any():
        rr, cc = r0[valid], c0[valid]
        v00 = arr[rr, cc]
        v10 = arr[rr, cc + 1]
        v01 = arr[rr + 1, cc]
        v11 = arr[rr + 1, cc + 1]
        wrv, wcv = wr[valid], wc[valid]
        top = v00 * (1 - wcv) + v10 * wcv
        bottom = v01 * (1 - wcv) + v11 * wcv
        out[valid] = top * (1 - wrv) + bottom * wrv
        # Fall back to the nearest valid neighbour when one corner is NoData.
        nearest = np.where(wrv < 0.5, np.where(wcv < 0.5, v00, v10), np.where(wcv < 0.5, v01, v11))
        out[valid] = np.where(np.isfinite(out[valid]), out[valid], nearest)
    return out


def scalar_at(ds: rasterio.io.DatasetReader, x: float, y: float) -> float | None:
    row, col = ds.index(x, y)
    if not (0 <= row < ds.height and 0 <= col < ds.width):
        return None
    value = float(ds.read(1, window=Window(col, row, 1, 1), masked=True)[0, 0])
    return value if math.isfinite(value) else None


def local_dem_grid(ds: rasterio.io.DatasetReader, x: float, y: float, center_z: float) -> list[float]:
    axis = np.arange(GRID_SIZE, dtype="float64") * GRID_SPACING_M - (GRID_SIZE - 1) * GRID_SPACING_M / 2
    xx, yy = np.meshgrid(axis, -axis)
    # Read a single surrounding window so we do not issue 10k remote reads.
    needed = max(abs(axis[0]), abs(axis[-1])) + 2 * abs(ds.transform.a)
    row, col = ds.index(x, y)
    half_px = int(math.ceil(needed / abs(ds.transform.a)))
    row0, col0 = max(0, row - half_px), max(0, col - half_px)
    row1, col1 = min(ds.height, row + half_px + 1), min(ds.width, col + half_px + 1)
    block = ds.read(1, window=Window(col0, row0, col1 - col0, row1 - row0), masked=True).astype("float64").filled(np.nan)
    west, north = ds.xy(row0, col0, offset="ul")
    sampled = bilinear(block, west, north, abs(ds.transform.a), x + xx, y + yy)
    if not np.isfinite(sampled).all():
        raise ValueError("local DEM grid contains NoData")
    return [round(float(v - center_z), 2) for v in sampled.ravel()]


def horizon_profile(
    dem: np.ndarray,
    west: float,
    north: float,
    pixel: float,
    center_x: float,
    center_y: float,
    center_z: float,
    local: tuple[np.ndarray, float, float, float] | None = None,
) -> tuple[list[float], list[float], list[float]]:
    azimuths = np.arange(360, dtype="float64")
    theta = np.radians(azimuths)
    distances = np.arange(HORIZON_STEP_M, HORIZON_RADIUS_M + HORIZON_STEP_M * 0.5, HORIZON_STEP_M)
    h0: list[float] = []
    dcrit: list[float] = []
    coverage: list[float] = []
    for az in range(360):
        dx = distances * math.sin(theta[az])
        dy = distances * math.cos(theta[az])
        z = bilinear(dem, west, north, pixel, center_x + dx, center_y + dy)
        valid = np.isfinite(z)
        local_valid = np.zeros_like(valid)
        local_z = np.full_like(distances, np.nan)
        if local is not None:
            larr, lwest, lnorth, lpixel = local
            local_z = bilinear(larr, lwest, lnorth, lpixel, center_x + dx, center_y + dy)
            local_valid = np.isfinite(local_z)
        combined = z.copy()
        combined[local_valid] = np.where(
            np.isfinite(combined[local_valid]),
            np.maximum(combined[local_valid], local_z[local_valid]),
            local_z[local_valid],
        )
        valid |= local_valid
        if not valid.any():
            h0.append(-90.0)
            dcrit.append(HORIZON_STEP_M)
            coverage.append(0.0)
            continue
        d = distances[valid]
        zz = combined[valid]
        angles = np.degrees(np.arctan((zz - center_z - d**2 / (2.0 * MOON_RADIUS_M)) / d))
        idx = int(np.argmax(angles))
        h0.append(round(float(angles[idx]), 4))
        dcrit.append(round(float(d[idx]), 2))
        coverage.append(round(float(d.max()), 1))
    return h0, dcrit, coverage


def psr_metrics(ds: rasterio.io.DatasetReader, x: float, y: float) -> dict[str, Any] | None:
    if ds is None:
        return None
    pixel = abs(ds.transform.a)
    block, west, north, _ = read_box(ds, x, y, 20_000.0)
    rr, cc = np.nonzero(block > 0.5)
    if not len(rr):
        return {
            "nearest_psr_km": None,
            "psr_fraction_1km_pct": 0.0,
            "psr_fraction_5km_pct": 0.0,
            "psr_fraction_10km_pct": 0.0,
            "psr_search_radius_km": 20.0,
            "psr_source": "NASA GSFC PGDA LPSR_80S_20MPP_ADJ (no PSR pixel within 20 km)",
        }
    center_row = (north - y) / pixel - 0.5
    center_col = (x - west) / pixel - 0.5
    distances_m = np.hypot((rr - center_row) * pixel, (cc - center_col) * pixel)
    nearest = float(distances_m.min()) / 1000.0
    result: dict[str, Any] = {
        "nearest_psr_km": round(nearest, 3),
        "psr_search_radius_km": 20.0,
        "psr_source": "NASA GSFC PGDA LPSR_80S_20MPP_ADJ (published 20 m/px PSR map)",
    }
    h, w = block.shape
    yy, xx = np.mgrid[0:h, 0:w]
    radial_m = np.hypot((yy - center_row) * pixel, (xx - center_col) * pixel)
    finite = np.isfinite(block)
    for radius_km in (1, 5, 10):
        mask = finite & (radial_m <= radius_km * 1000.0)
        if mask.any():
            result[f"psr_fraction_{radius_km}km_pct"] = round(100.0 * np.count_nonzero(block[mask] > 0.5) / np.count_nonzero(mask), 3)
        else:
            result[f"psr_fraction_{radius_km}km_pct"] = None
    return result


def dispersion_grid(
    source: dict[str, Any],
    x: float,
    y: float,
    center_z: float,
    dem_ds: rasterio.io.DatasetReader | None,
    slope_ds: rasterio.io.DatasetReader | None,
    error_ds: rasterio.io.DatasetReader | None,
) -> list[dict[str, Any]]:
    grid: list[dict[str, Any]] = []
    pixel = source["pixel_m"]
    for dy in reversed(DISPERSION_OFFSETS_M):
        for dx in DISPERSION_OFFSETS_M:
            px, py = x + dx, y + dy
            z = None
            slope = None
            error = None
            if dem_ds is not None:
                z = scalar_at(dem_ds, px, py)
            if slope_ds is not None:
                slope = scalar_at(slope_ds, px, py)
            if error_ds is not None:
                error = scalar_at(error_ds, px, py)
            if z is None:
                status = "OUTSIDE_DATA"
            elif slope is not None and slope >= 12.0:
                status = "MISSION_LOSS_TRAP"
            elif slope is not None and slope >= 8.0:
                status = "CAUTION"
            else:
                status = "SAFE"
            grid.append({
                "dx_m": dx,
                "dy_m": dy,
                "elevation_m": round(z, 3) if z is not None else None,
                "relative_z_m": round(z - center_z, 3) if z is not None else None,
                "slope_deg": round(slope, 3) if slope is not None else None,
                "rms_height_uncertainty_m": round(error, 3) if error is not None else None,
                # The published slope map is the closest available local slope
                # error; it is reported separately instead of inventing a value.
                "slope_source": "LOLA published slope map" if slope is not None else None,
                "status": status,
            })
    return grid


def synthetic_site(site: dict[str, Any], elevation_m: float = 0.0) -> dict[str, Any]:
    axis = np.arange(GRID_SIZE, dtype="float64") * GRID_SPACING_M - (GRID_SIZE - 1) * GRID_SPACING_M / 2
    xx, yy = np.meshgrid(axis, -axis)
    relative = np.zeros_like(xx)
    grid = [round(float(v), 2) for v in relative.ravel()]
    h0 = [0.0] * 360
    dcrit = [HORIZON_RADIUS_M] * 360
    dispersion = []
    for dy in reversed(DISPERSION_OFFSETS_M):
        for dx in DISPERSION_OFFSETS_M:
            dispersion.append({
                "dx_m": dx, "dy_m": dy, "elevation_m": elevation_m, "relative_z_m": 0.0,
                "slope_deg": 0.0, "rms_height_uncertainty_m": None,
                "slope_source": "synthetic flat plane", "status": "SAFE",
            })
    return {
        "site_metadata": {
            "site_id": site["id"], "name": site["name"], "short_name": site["short"],
            "lat_deg": site["lat"], "lon_deg": site["lon"], "elevation_m": elevation_m,
            "slope_deg": 0.0, "rms_height_uncertainty_m": None, "rms_slope_error_deg": None,
            "reference_frame": "synthetic plane / MOON_ME coordinates",
            "pixel_size_m": None, "mission_context": site["context"],
        },
        "provenance": {
            "mode": "synthetic_terrain_real_ephemeris",
            "dem_source": "Synthetic flat plane (not LOLA)",
            "dem_source_label": "Synthetic zero-elevation calibration plane; no terrain data",
            "terrain_fidelity": "synthetic",
            "pixel_size_m": None,
            "horizontal_datum": "MOON_ME / DE421",
            "ray_step_m": HORIZON_STEP_M,
            "ray_radius_m": HORIZON_RADIUS_M,
            "curvature_radius_m": MOON_RADIUS_M,
        },
        "heightmap": {"width": PATCH_SIZE, "height": PATCH_SIZE, "bit_depth": 16,
                       "minimum_elevation_m": elevation_m, "meters_per_code": 1.0},
        "horizon_mask_360": {"h0_deg": h0, "d_crit_m": dcrit},
        "dem_grid_101": {"spacing_m": GRID_SPACING_M, "center_elevation_m": elevation_m,
                          "relative_elevations_m": grid},
        "dispersion_grid_5x5": dispersion,
    }


def build_site(site: dict[str, Any], include_ephemeris: bool = True) -> dict[str, Any]:
    sid = safe_id(site["id"])
    source = site.get("source")
    if source is None:
        baked = synthetic_site(site, 0.0)
        baked["ephemeris"] = bake_ephemeris(site["lat"], site["lon"], 0.0) if include_ephemeris else None
        write_heightmap(baked, sid, np.zeros((PATCH_SIZE, PATCH_SIZE)))
        return baked

    with open_remote(source["dem_url"]) as dem_ds:
        x, y = transform_coords(GEO_CRS, dem_ds.crs, [site["lon"]], [site["lat"]])
        x, y = float(x[0]), float(y[0])
        pixel = abs(dem_ds.transform.a)
        if abs(pixel - source["pixel_m"]) > 1e-3:
            raise ValueError(f"{sid}: source pixel {pixel} does not match manifest {source['pixel_m']}")
        center_z = scalar_at(dem_ds, x, y)
        if center_z is None:
            raise ValueError(f"{sid}: center pixel is NoData")
        source_crs = dem_ds.crs.to_string()
        center_row, center_col = (int(v) for v in dem_ds.index(x, y))

        slope_ds = open_remote(source["slope_url"]) if source.get("slope_url") else None
        error_ds = open_remote(source["error_url"]) if source.get("error_url") else None
        slope_error_ds = open_remote(source["slope_error_url"]) if source.get("slope_error_url") else None
        psr_ds = open_remote(source["psr_url"]) if source.get("psr_url") else None
        regional_ds = open_remote(source["regional_dem_url"]) if source.get("regional_dem_url") else None
        try:
            center_slope = scalar_at(slope_ds, x, y) if slope_ds else None
            center_error = scalar_at(error_ds, x, y) if error_ds else None
            center_slope_error = scalar_at(slope_error_ds, x, y) if slope_error_ds else None

            dem_grid = local_dem_grid(dem_ds, x, y, center_z)

            # Regional horizon from the 30 km DEM box. For Site04 the 5 m local
            # DEM is overlaid so the near-field crater rim is not lost to the
            # coarser 20 m regional product.
            if regional_ds is not None:
                reg_dem, reg_west, reg_north, reg_pixel = read_box(regional_ds, x, y, HORIZON_RADIUS_M + 2000)
                local = None
                # The 5 m Site04 tile is 16 km wide but stored in strips; a
                # 2 km window is enough to capture the near-field crater rim
                # while the 20 m regional DEM carries the 30 km horizon.
                local_dem, local_west, local_north, local_pixel = read_box(dem_ds, x, y, 2000)
                local = (local_dem, local_west, local_north, local_pixel)
                h0, dcrit, coverage = horizon_profile(reg_dem, reg_west, reg_north, reg_pixel, x, y, center_z, local)
            else:
                dem, west, north, px = read_box(dem_ds, x, y, HORIZON_RADIUS_M + 2000)
                h0, dcrit, coverage = horizon_profile(dem, west, north, px, x, y, center_z)

            dispersion = dispersion_grid(source, x, y, center_z, dem_ds, slope_ds, error_ds)
            psr = psr_metrics(psr_ds, x, y) if psr_ds else None
        finally:
            for ds in (slope_ds, error_ds, slope_error_ds, psr_ds, regional_ds):
                if ds is not None:
                    ds.close()

    provenance = {
        "mode": "validated_computed",
        "dem_source": source["dem_url"],
        "dem_source_label": source["label"],
        "terrain_fidelity": "lola_published",
        "dem_product": source["id"],
        "slope_source": source["slope_url"],
        "height_error_source": source["error_url"],
        "slope_error_source": source["slope_error_url"],
        "pixel_size_m": source["pixel_m"],
        "regional_pixel_size_m": source.get("regional_pixel_m"),
        "regional_dem_source": source.get("regional_dem_url"),
        "horizontal_datum": "MOON_ME / DE421",
        "source_crs": source_crs,
        "center_projected_m": {"x": round(x, 3), "y": round(y, 3)},
        "center_pixel": {"row": center_row, "col": center_col},
        "ray_step_m": HORIZON_STEP_M,
        "ray_radius_m": HORIZON_RADIUS_M,
        "ray_coverage_min_m": min(coverage),
        "curvature_radius_m": MOON_RADIUS_M,
        "heightmap_png": f"{sid}_heightmap.png",
        "accessed_utc": datetime.now(timezone.utc).isoformat(),
    }
    if source.get("dem_url", "").startswith("https://pgda.gsfc.nasa.gov"):
        provenance["citation"] = "Barker et al. 2023, Planet. Sci. J. 4, 183; doi:10.3847/PSJ/acf3e1"

    heightmap_source = np.array(dem_grid, dtype="float64").reshape(GRID_SIZE, GRID_SIZE)[:PATCH_SIZE, :PATCH_SIZE]
    heightmap_min, heightmap_scale = write_gray16_png(Path("public/data") / f"{sid}_heightmap.png", heightmap_source)
    metadata = {
        "site_id": sid,
        "name": site["name"],
        "short_name": site["short"],
        "lat_deg": site["lat"],
        "lon_deg": site["lon"],
        "elevation_m": round(center_z, 3),
        "slope_deg": round(center_slope, 3) if center_slope is not None else None,
        "rms_height_uncertainty_m": round(center_error, 3) if center_error is not None else None,
        "rms_slope_error_deg": round(center_slope_error, 3) if center_slope_error is not None else None,
        "reference_frame": "MOON_ME / DE421",
        "pixel_size_m": source["pixel_m"],
        "mission_context": site["context"],
    }
    if psr:
        metadata.update(psr)
    else:
        metadata.update({
            "nearest_psr_km": None,
            "psr_fraction_1km_pct": None,
            "psr_fraction_5km_pct": None,
            "psr_fraction_10km_pct": None,
            "psr_source": "Not available outside the published 80S PSR product",
        })
    baked = {
        "site_metadata": metadata,
        "provenance": provenance,
        "heightmap": {
            "width": PATCH_SIZE, "height": PATCH_SIZE, "bit_depth": 16,
            "minimum_elevation_m": round(float(center_z + heightmap_min), 3),
            "meters_per_code": heightmap_scale,
        },
        "horizon_mask_360": {"h0_deg": h0, "d_crit_m": dcrit},
        "dem_grid_101": {
            "spacing_m": GRID_SPACING_M,
            "center_elevation_m": round(center_z, 3),
            "relative_elevations_m": dem_grid,
        },
        "dispersion_grid_5x5": dispersion,
    }
    if include_ephemeris:
        baked["ephemeris"] = bake_ephemeris(site["lat"], site["lon"], center_z)
    return baked


def write_heightmap(baked: dict[str, Any], sid: str, values: np.ndarray) -> None:
    low, scale = write_gray16_png(Path("public/data") / f"{sid}_heightmap.png", values)
    baked["heightmap"]["minimum_elevation_m"] = round(low, 3)
    baked["heightmap"]["meters_per_code"] = scale


def bake_ephemeris(lat: float, lon: float, elevation_m: float) -> dict[str, Any]:
    lat_rad, lon_rad = math.radians(lat), math.radians(lon)
    radius = (MOON_RADIUS_KM + elevation_m / 1000.0)
    observer = (
        radius * math.cos(lat_rad) * math.cos(lon_rad),
        radius * math.cos(lat_rad) * math.sin(lon_rad),
        radius * math.sin(lat_rad),
    )
    et0 = spice.str2et(EPHEMERIS_START.strftime("%Y-%m-%dT%H:%M:%S"))
    total_hours = int((EPHEMERIS_END - EPHEMERIS_START).total_seconds() // 3600)
    sun_az, sun_el, earth_az, earth_el = [], [], [], []
    for hour in range(total_hours + 1):
        et = et0 + hour * 3600.0
        for body, az_list, el_list in (("SUN", sun_az, sun_el), ("EARTH", earth_az, earth_el)):
            state, _ = spice.spkcpo(body, et, "MOON_ME", "OBSERVER", "NONE", observer, "MOON", "MOON_ME")
            az, el = topocentric_angles((float(state[0]), float(state[1]), float(state[2])), lat, lon)
            az_list.append(round(az, 3))
            el_list.append(round(el, 4))
    return {
        "start_utc": EPHEMERIS_START.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "step_hours": EPHEMERIS_STEP_HOURS,
        "sun_az_deg": sun_az,
        "sun_el_deg": sun_el,
        "earth_az_deg": earth_az,
        "earth_el_deg": earth_el,
    }


def kernel_bundle() -> list[dict[str, Any]]:
    return kernel_manifest(Path("data/kernels/de421"))


def manifest_payload(sites: list[dict[str, Any]], kernels: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "schema": "firstcontact-lola-de421-bake-v2",
        "baked_at_utc": datetime.now(timezone.utc).isoformat(),
        "terrain_sources": {
            "south_pole_20m": SOURCE_80S20["dem_url"],
            "site04_5m": SOURCE_SITE04_5M["dem_url"],
            "chandrayaan3_60m": SOURCE_CY3_60M["dem_url"],
            "psr_20m": SOURCE_80S20["psr_url"],
        },
        "ephemeris": {
            "source": "JPL DE421 SPK + NAIF MOON_ME orientation",
            "start_utc": EPHEMERIS_START.isoformat(),
            "end_utc": EPHEMERIS_END.isoformat(),
            "step_hours": EPHEMERIS_STEP_HOURS,
            "kernel_files": kernels,
        },
        "sites": [
            {
                "site_id": s["site_metadata"]["site_id"],
                "lat_deg": s["site_metadata"]["lat_deg"],
                "lon_deg": s["site_metadata"]["lon_deg"],
                "elevation_m": s["site_metadata"]["elevation_m"],
                "pixel_size_m": s["site_metadata"]["pixel_size_m"],
                "slope_deg": s["site_metadata"]["slope_deg"],
                "rms_height_uncertainty_m": s["site_metadata"]["rms_height_uncertainty_m"],
                "nearest_psr_km": s["site_metadata"].get("nearest_psr_km"),
                "terrain_fidelity": s["provenance"]["terrain_fidelity"],
            }
            for s in sites
        ],
    }


def write_checkpoint(output: Path, sites: list[dict[str, Any]], kernels: list[dict[str, Any]]) -> None:
    """Persist after every site so a long bake is never all-or-nothing."""
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_text(
        json.dumps({"sites": sites}, separators=(",", ":"), ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    temporary.replace(output)
    manifest_path = Path("data/lola/bake_manifest.json")
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest_payload(sites, kernels), indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", nargs="*", help="optional subset of site ids")
    parser.add_argument("--no-ephemeris", action="store_true")
    parser.add_argument("--output", type=Path, default=Path("public/data/baked_lunar_sites.json"))
    args = parser.parse_args()

    selected = [s for s in SITES if not args.only or s["id"] in set(args.only)]
    if not selected:
        raise SystemExit("No matching sites")

    kernels = kernel_bundle()
    for kernel in kernels:
        spice.furnsh(str(Path("data/kernels/de421") / kernel["name"]))
    try:
        sites = []
        for site in selected:
            print(f"Baking {site['id']} ...", flush=True)
            baked = build_site(site, include_ephemeris=not args.no_ephemeris)
            sites.append(baked)
            h0 = baked["horizon_mask_360"]["h0_deg"]
            print(
                f"  elevation {baked['site_metadata']['elevation_m']:.1f} m, "
                f"slope {baked['site_metadata']['slope_deg']}, "
                f"horizon {min(h0):.2f}..{max(h0):.2f} deg, "
                f"PSR {baked['site_metadata'].get('nearest_psr_km')} km",
                flush=True,
            )
            write_checkpoint(args.output, sites, kernels)
            print(f"  checkpoint {args.output} ({args.output.stat().st_size:,} bytes)", flush=True)
    finally:
        spice.kclear()

    print(f"Wrote {len(sites)} sites to {args.output} ({args.output.stat().st_size:,} bytes)")
    print("Wrote data/lola/bake_manifest.json")


if __name__ == "__main__":
    main()
