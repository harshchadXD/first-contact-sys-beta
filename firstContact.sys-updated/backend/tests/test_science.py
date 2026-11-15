from __future__ import annotations

import json
import struct
import zlib

from backend.science.metrics import angular_difference_deg, longest_false_run, slope_suitability_score, weighted_suitability_score
from backend.tools.generate_mock_dem import build_mock, png_gray16


def test_mock_site_has_contract_arrays_and_25_dispersion_cells() -> None:
    site, pixels = build_mock()
    assert len(site["horizon_mask_360"]["h0_deg"]) == 360
    assert len(site["horizon_mask_360"]["d_crit_m"]) == 360
    assert len(site["dispersion_grid_5x5"]) == 25
    assert len(pixels) == 100 and all(len(row) == 100 for row in pixels)
    assert site["provenance"]["mode"] == "synthetic_mock"


def test_mock_heightmap_is_valid_grayscale_16_png() -> None:
    _, pixels = build_mock(10, 8)
    png = png_gray16(pixels)
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    length = struct.unpack(">I", png[8:12])[0]
    assert png[12:16] == b"IHDR"
    width, height, depth, color_type = struct.unpack(">IIBB", png[16:26])
    assert (width, height, depth, color_type) == (10, 8, 16, 0)
    assert zlib.crc32(png[12:29]) & 0xFFFFFFFF == struct.unpack(">I", png[29:33])[0]
    assert length == 13


def test_json_contract_serializes_without_special_types() -> None:
    site, _ = build_mock()
    encoded = json.dumps({"sites": [site]})
    assert '"sites"' in encoded
    assert "SYNTHETIC" in encoded


def test_metrics_and_angular_wraparound() -> None:
    assert slope_suitability_score(4) == 80
    assert weighted_suitability_score(80, 60, 100, (0.5, 0.3, 0.2)) == 78
    assert longest_false_run([False, False, True, False]) == 2
    assert round(angular_difference_deg(359.9, 0.1), 1) == 0.2
