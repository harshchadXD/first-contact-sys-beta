#!/usr/bin/env python3
"""Compare computed hourly local azimuth/elevation CSV against a reference CSV.

Both CSV files must have UTC timestamp and Sun/Earth azimuth/elevation columns.
The NASA SVS 5587 table contains geocentric subsolar/subearth coordinates, not
site-local azimuth/elevation; convert those coordinates to local directions
before using this comparator. For direct validation of local angles, use JPL
Horizons observer tables at the lunar site coordinates.
"""

from __future__ import annotations

import argparse
import csv
import math
from pathlib import Path

from backend.science.metrics import angular_difference_deg


def compare(computed_csv: Path, reference_csv: Path, tolerance_deg: float = 0.05) -> dict[str, float | int | bool]:
    with computed_csv.open(newline="", encoding="utf-8-sig") as f:
        computed = {row["timestamp_utc"]: row for row in csv.DictReader(f)}
    with reference_csv.open(newline="", encoding="utf-8-sig") as f:
        reference = {row["timestamp_utc"]: row for row in csv.DictReader(f)}
    common = sorted(computed.keys() & reference.keys())
    if not common:
        raise ValueError("CSV files have no matching timestamp_utc values")
    az_errors: list[float] = []
    el_errors: list[float] = []
    for stamp in common:
        for body in ("sun", "earth"):
            c, r = computed[stamp], reference[stamp]
            az_errors.append(angular_difference_deg(float(c[f"{body}_az_deg"]), float(r[f"{body}_az_deg"])))
            el_errors.append(abs(float(c[f"{body}_el_deg"]) - float(r[f"{body}_el_deg"])))
    max_error = max(*az_errors, *el_errors)
    return {"matched_hours": len(common), "max_az_error_deg": max(az_errors),
            "max_el_error_deg": max(el_errors), "max_error_deg": max_error,
            "tolerance_deg": tolerance_deg, "passed": max_error <= tolerance_deg}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("computed_csv", type=Path)
    parser.add_argument("reference_csv", type=Path)
    parser.add_argument("--tolerance-deg", type=float, default=0.05)
    args = parser.parse_args()
    if not math.isfinite(args.tolerance_deg) or args.tolerance_deg < 0:
        parser.error("tolerance must be a finite nonnegative number")
    result = compare(args.computed_csv, args.reference_csv, args.tolerance_deg)
    for key, value in result.items():
        print(f"{key}: {value}")
    if not result["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
