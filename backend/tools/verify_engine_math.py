"""
Independent Python Reference Calculation & Cross-Validation for First Contact.sys
Verifies analytic horizon cases, hardened ISO parser, and interval metrics independently.
"""

import math
from datetime import datetime, timezone

def interpolate_horizon_elevation(azimuth_deg: float, horizon_az: list[float], horizon_el: list[float]) -> float:
    if not math.isfinite(azimuth_deg):
        raise ValueError(f"Non-finite azimuth: {azimuth_deg}")
    az = azimuth_deg % 360.0
    n = len(horizon_az)
    if n == 1:
        return horizon_el[0]

    first_az = horizon_az[0]
    last_az = horizon_az[-1]

    if az < first_az or az >= last_az:
        wrap_span = (360.0 - last_az) + first_az
        delta = (az - last_az) if az >= last_az else ((360.0 - last_az) + az)
        t = delta / wrap_span
        return horizon_el[-1] + t * (horizon_el[0] - horizon_el[-1])

    for i in range(n - 1):
        a0, a1 = horizon_az[i], horizon_az[i + 1]
        if a0 <= az <= a1:
            t = (az - a0) / (a1 - a0)
            return horizon_el[i] + t * (horizon_el[i + 1] - horizon_el[i])

    raise ValueError(f"Could not bracket azimuth: {az}")

def parse_iso_utc_hardened(s: str) -> float:
    s_clean = s.strip()
    if not s_clean.endswith("Z"):
        raise ValueError(f"Missing 'Z' designator: '{s}'")
    without_z = s_clean[:-1]
    if "T" not in without_z:
        raise ValueError(f"Missing 'T': '{s}'")
    date_part, time_part = without_z.split("T", 1)

    y_str, m_str, d_str = date_part.split("-")
    year, month, day = int(y_str), int(m_str), int(d_str)

    if not (1970 <= year <= 2100):
        raise ValueError(f"Year {year} out of range [1970, 2100]")

    is_leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
    max_days = {
        1: 31, 2: 29 if is_leap else 28, 3: 31, 4: 30,
        5: 31, 6: 30, 7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31
    }.get(month, 0)

    if day < 1 or day > max_days:
        raise ValueError(f"Invalid day {day} for month {month} in year {year}")

    time_parts = time_part.split(":")
    if len(time_parts) != 3:
        raise ValueError(f"Malformed time format: '{time_part}'")
    hour, minute = int(time_parts[0]), int(time_parts[1])
    second = float(time_parts[2])

    if hour > 23 or minute > 59 or not math.isfinite(second) or second < 0.0 or second >= 60.0:
        raise ValueError("Invalid time component values")

    dt = datetime(year, month, day, hour, minute, int(second), int((second % 1.0) * 1_000_000), tzinfo=timezone.utc)
    return dt.timestamp()

def analyze_reference(request: dict) -> dict:
    if request.get("schemaVersion") != 1:
        raise ValueError(f"Unsupported schemaVersion: {request.get('schemaVersion')}")

    # Check unique position IDs
    seen_ids = set()
    for pos in request.get("positions", []):
        pid = pos.get("positionId", "").strip()
        if not pid:
            raise ValueError("Empty positionId")
        if pid in seen_ids:
            raise ValueError(f"Duplicate positionId: '{pid}'")
        seen_ids.add(pid)

    timestamps = [parse_iso_utc_hardened(ts) for ts in request["timestampsUtc"]]
    window_end = parse_iso_utc_hardened(request["windowEndUtc"])
    all_times = timestamps + [window_end]

    durations = [(all_times[i+1] - all_times[i]) / 3600.0 for i in range(len(timestamps))]
    total_hours = sum(durations)

    positions_result = []

    for pos in request["positions"]:
        h_az = pos["horizon"]["azimuthDeg"]
        h_el = pos["horizon"]["horizonElevationDeg"]

        sun_vis = []
        earth_vis = []

        sun_vis_hours = 0.0
        earth_vis_hours = 0.0

        longest_darkness = 0.0
        cur_darkness = 0.0

        longest_earth_blackout = 0.0
        cur_earth_blackout = 0.0

        longest_earth_visible = 0.0
        cur_earth_visible = 0.0

        for i, dt in enumerate(durations):
            s_az = request["sunAzimuthDeg"][i]
            s_el = request["sunElevationDeg"][i]
            s_horiz = interpolate_horizon_elevation(s_az, h_az, h_el)
            s_v = (s_el > s_horiz)  # Strictly > (equality is blocked)
            sun_vis.append(s_v)

            if s_v:
                sun_vis_hours += dt
                cur_darkness = 0.0
            else:
                cur_darkness += dt
                longest_darkness = max(longest_darkness, cur_darkness)

            e_az = request["earthAzimuthDeg"][i]
            e_el = request["earthElevationDeg"][i]
            e_horiz = interpolate_horizon_elevation(e_az, h_az, h_el)
            e_v = (e_el > e_horiz)  # Strictly > (equality is blocked)
            earth_vis.append(e_v)

            if e_v:
                earth_vis_hours += dt
                cur_earth_visible += dt
                longest_earth_visible = max(longest_earth_visible, cur_earth_visible)
                cur_earth_blackout = 0.0
            else:
                cur_earth_blackout += dt
                longest_earth_blackout = max(longest_earth_blackout, cur_earth_blackout)
                cur_earth_visible = 0.0

        positions_result.append({
            "positionId": pos["positionId"],
            "sunVisible": sun_vis,
            "earthVisible": earth_vis,
            "sunVisibleFraction": sun_vis_hours / total_hours,
            "earthVisibleFraction": earth_vis_hours / total_hours,
            "longestDarknessHours": longest_darkness,
            "longestEarthBlackoutHours": longest_earth_blackout,
            "longestEarthVisibleHours": longest_earth_visible,
        })

    return {
        "schemaVersion": 1,
        "positions": positions_result
    }

if __name__ == "__main__":
    print("Testing Hardened Python reference implementation against test cases...")

    # Test 1: Wrap interpolation
    h_az = [0.0, 90.0, 180.0, 270.0, 350.0]
    h_el = [1.0, 2.0, 3.0, 2.0, 1.5]
    el_wrap = interpolate_horizon_elevation(355.0, h_az, h_el)
    assert abs(el_wrap - 1.25) < 1e-6, f"Expected 1.25, got {el_wrap}"
    print("✓ Wrap interpolation verified: 355° -> 1.25°")

    # Test 2: Tangent equality is strictly blocked
    el_0 = interpolate_horizon_elevation(0.0, h_az, h_el)
    assert (1.0 > el_0) is False, "Equality must be blocked"
    print("✓ Equality rule verified: 1.0 > 1.0 is False")

    # Test 3: Hardened parser impossible date checks
    bad_dates = [
        "2026-02-31T00:00:00Z",  # Impossible day Feb 31
        "2026-02-29T00:00:00Z",  # 2026 non-leap
        "2026-04-31T00:00:00Z",  # April has 30 days
        "2026-10-01T00:00:00",   # Missing Z
        "2026-10-01T00:00:00Ztrailing", # Trailing text
        "1960-01-01T00:00:00Z",  # Pre-1970
    ]
    for bd in bad_dates:
        try:
            parse_iso_utc_hardened(bd)
            assert False, f"Date '{bd}' should have been rejected!"
        except ValueError:
            pass
    print("✓ Hardened ISO parser correctly rejected all impossible dates and formats.")

    # Test 4: Duplicate position IDs rejection
    dup_req = {
        "schemaVersion": 1,
        "timestampsUtc": ["2026-10-01T00:00:00Z"],
        "windowEndUtc": "2026-10-01T01:00:00Z",
        "sunAzimuthDeg": [0.0],
        "sunElevationDeg": [5.0],
        "earthAzimuthDeg": [0.0],
        "earthElevationDeg": [5.0],
        "positions": [
            {"positionId": "pos_dup", "horizon": {"azimuthDeg": h_az, "horizonElevationDeg": h_el}},
            {"positionId": "pos_dup", "horizon": {"azimuthDeg": h_az, "horizonElevationDeg": h_el}}
        ]
    }
    try:
        analyze_reference(dup_req)
        assert False, "Duplicate positionId should have been rejected!"
    except ValueError as e:
        assert "Duplicate positionId" in str(e)
    print("✓ Duplicate position ID rejected successfully.")

    print("\nAll independent Python reference checks passed successfully!")
