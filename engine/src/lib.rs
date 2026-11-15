use serde::{Deserialize, Serialize};
pub mod energy;
use std::collections::HashSet;

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------------------
// JSON Data Transfer Objects (Schema Version 1)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HorizonProfileInput {
    pub azimuthDeg: Vec<f64>,
    pub horizonElevationDeg: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionInput {
    pub positionId: String,
    pub horizon: HorizonProfileInput,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisRequest {
    #[serde(default)]
    pub energy: Option<energy::EnergyParameters>,
    pub schemaVersion: u32,
    pub timestampsUtc: Vec<String>,
    pub windowEndUtc: String,
    pub sunAzimuthDeg: Vec<f64>,
    pub sunElevationDeg: Vec<f64>,
    pub earthAzimuthDeg: Vec<f64>,
    pub earthElevationDeg: Vec<f64>,
    pub positions: Vec<PositionInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PositionAnalysisResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub energy: Option<energy::EnergyResult>,
    pub positionId: String,
    pub sunVisible: Vec<bool>,
    pub earthVisible: Vec<bool>,
    pub sunVisibleFraction: f64,
    pub earthVisibleFraction: f64,
    pub longestDarknessHours: f64,
    pub longestEarthBlackoutHours: f64,
    pub longestEarthVisibleHours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResponse {
    pub schemaVersion: u32,
    pub positions: Vec<PositionAnalysisResult>,
    pub assumptions: Vec<String>,
}

// ---------------------------------------------------------------------------
// Core Computational Logic & Validation
// ---------------------------------------------------------------------------

const ASSUMPTIONS: &[&str] = &[
    "Geometric centre line-of-sight: celestial bodies are evaluated as dimensionless points at their geometric centres.",
    "Equality rule: an elevation exactly equal to the terrain horizon elevation is treated as blocked (strictly requires elevation > horizon for visibility).",
    "Periodic horizon interpolation: sampled terrain elevations are linearly interpolated across azimuth, with circular wrap-around connecting the last and first azimuth samples.",
    "Sampled interval model: sample index i represents the persistent visibility state over the time interval [t_i, t_{i+1}), with interval N-1 ending at windowEndUtc.",
    "Partial solar disk penumbral illumination and atmospheric refraction (0.0° in lunar vacuum) are distinct models and separate from this geometric centre boundary.",
];

/// Linearly interpolates the terrain horizon elevation angle at a target azimuth,
/// wrapping periodically over [0, 360) degrees.
pub fn interpolate_horizon_elevation(
    azimuth_deg: f64,
    horizon_az: &[f64],
    horizon_el: &[f64],
) -> Result<f64, String> {
    if !azimuth_deg.is_finite() {
        return Err(format!("Target azimuth is not finite: {}", azimuth_deg));
    }
    if horizon_az.is_empty() {
        return Err("Horizon azimuth array is empty".to_string());
    }
    if horizon_az.len() != horizon_el.len() {
        return Err(format!(
            "Horizon azimuth length ({}) does not match elevation length ({})",
            horizon_az.len(),
            horizon_el.len()
        ));
    }

    // Normalize target azimuth into [0, 360)
    let az = azimuth_deg.rem_euclid(360.0);

    let n = horizon_az.len();

    // Single-sample edge case: horizon is uniform omnidirectional elevation
    if n == 1 {
        let el = horizon_el[0];
        if !el.is_finite() {
            return Err("Horizon elevation contains non-finite value".to_string());
        }
        return Ok(el);
    }

    // Check if target is before the first azimuth sample or after the last
    let first_az = horizon_az[0];
    let last_az = horizon_az[n - 1];

    if az < first_az || az >= last_az {
        // Periodic wrap-around between last_az and first_az
        // Span across 360 boundary: (360.0 - last_az) + first_az
        let wrap_span = (360.0 - last_az) + first_az;
        if wrap_span <= 0.0 || !wrap_span.is_finite() {
            return Err("Invalid horizon wrap span across 360 boundary".to_string());
        }

        let delta = if az >= last_az {
            az - last_az
        } else {
            (360.0 - last_az) + az
        };

        let t = delta / wrap_span;
        let el_last = horizon_el[n - 1];
        let el_first = horizon_el[0];
        if !el_last.is_finite() || !el_first.is_finite() {
            return Err("Non-finite horizon elevation in wrap interval".to_string());
        }
        return Ok(el_last + t * (el_first - el_last));
    }

    // Bracket search within [first_az, last_az]
    for i in 0..(n - 1) {
        let a0 = horizon_az[i];
        let a1 = horizon_az[i + 1];

        if az >= a0 && az <= a1 {
            let span = a1 - a0;
            if span <= 0.0 {
                return Err(format!("Horizon azimuths are not strictly increasing at index {}: {} >= {}", i, a0, a1));
            }
            let t = (az - a0) / span;
            let e0 = horizon_el[i];
            let e1 = horizon_el[i + 1];
            if !e0.is_finite() || !e1.is_finite() {
                return Err(format!("Non-finite horizon elevation between indices {} and {}", i, i + 1));
            }
            return Ok(e0 + t * (e1 - e0));
        }
    }

    Err(format!("Could not locate bracket for azimuth {}", az))
}

/// Helper: count of leap years up to and including year `y`.
#[inline]
fn leap_years_before(y: i64) -> i64 {
    (y / 4) - (y / 100) + (y / 400)
}

/// Hardened ISO 8601 UTC timestamp parser.
/// Enforces:
/// - Format: YYYY-MM-DDTHH:MM:SSZ or YYYY-MM-DDTHH:MM:SS.sssZ
/// - Must end strictly with 'Z' (no trailing text, no absent timezone)
/// - Bounded years: 1970 to 2100 inclusive
/// - Month 1..=12
/// - Exact day limits per month, respecting leap years (e.g., rejects 2026-02-31, 2026-02-29, 2026-04-31)
/// - Hours 0..=23, Minutes 0..=59, Seconds 0.0..60.0 (finite, non-NaN, non-Inf)
/// - Closed-form O(1) epoch seconds calculation (no unbounded year loops)
pub fn parse_iso_utc_seconds(s: &str) -> Result<f64, String> {
    let s_clean = s.trim();

    // Must end strictly with uppercase 'Z'
    if !s_clean.ends_with('Z') {
        return Err(format!("Timestamp must end with 'Z' UTC designator: '{}'", s));
    }

    let without_z = &s_clean[..s_clean.len() - 1];

    let parts: Vec<&str> = without_z.split('T').collect();
    if parts.len() != 2 {
        return Err(format!("Malformed ISO 8601 timestamp (missing 'T'): '{}'", s));
    }

    let date_str = parts[0];
    let time_str = parts[1];

    let date_parts: Vec<&str> = date_str.split('-').collect();
    if date_parts.len() != 3 || date_parts[0].len() != 4 || date_parts[1].len() != 2 || date_parts[2].len() != 2 {
        return Err(format!("Malformed ISO 8601 date format (YYYY-MM-DD expected): '{}'", date_str));
    }

    let year: i64 = date_parts[0].parse().map_err(|_| format!("Invalid year: '{}'", date_parts[0]))?;
    let month: u32 = date_parts[1].parse().map_err(|_| format!("Invalid month: '{}'", date_parts[1]))?;
    let day: u32 = date_parts[2].parse().map_err(|_| format!("Invalid day: '{}'", date_parts[2]))?;

    // Bounded year range check
    if year < 1970 || year > 2100 {
        return Err(format!("Year {} outside supported range [1970, 2100]", year));
    }

    if month < 1 || month > 12 {
        return Err(format!("Month {} outside valid range [1, 12]", month));
    }

    let is_leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
    let max_days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => if is_leap { 29 } else { 28 },
        _ => unreachable!(),
    };

    if day < 1 || day > max_days {
        return Err(format!(
            "Day {} invalid for month {} in year {} (max is {})",
            day, month, year, max_days
        ));
    }

    let time_parts: Vec<&str> = time_str.split(':').collect();
    if time_parts.len() != 3 || time_parts[0].len() != 2 || time_parts[1].len() != 2 {
        return Err(format!("Malformed ISO 8601 time format (HH:MM:SS expected): '{}'", time_str));
    }

    let hour: u32 = time_parts[0].parse().map_err(|_| format!("Invalid hour: '{}'", time_parts[0]))?;
    let minute: u32 = time_parts[1].parse().map_err(|_| format!("Invalid minute: '{}'", time_parts[1]))?;
    let second_str = time_parts[2];

    if hour > 23 {
        return Err(format!("Hour {} invalid (expected 0..=23)", hour));
    }
    if minute > 59 {
        return Err(format!("Minute {} invalid (expected 0..=59)", minute));
    }

    let second: f64 = second_str.parse().map_err(|_| format!("Invalid second: '{}'", second_str))?;
    if !second.is_finite() || second < 0.0 || second >= 60.0 {
        return Err(format!("Second {} invalid or non-finite (expected 0.0..60.0)", second));
    }

    // Closed-form days calculation since Unix epoch (1970-01-01)
    // Leaps before 1970: 1969 / 4 - 1969 / 100 + 1969 / 400 = 492 - 19 + 4 = 477
    const LEAPS_BEFORE_1970: i64 = 477;
    let days_from_years = (year - 1970) * 365 + (leap_years_before(year - 1) - LEAPS_BEFORE_1970);

    let days_before_month = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let mut days_in_cur_year = days_before_month[(month - 1) as usize];
    if month > 2 && is_leap {
        days_in_cur_year += 1;
    }
    days_in_cur_year += (day - 1) as i64;

    let total_days = days_from_years + days_in_cur_year;
    let total_seconds = (total_days as f64) * 86400.0 + (hour as f64) * 3600.0 + (minute as f64) * 60.0 + second;

    Ok(total_seconds)
}

/// Validates the input analysis request, checking array shapes, non-finite values,
/// timestamp monotonicity, azimuth monotonicity, and unique position IDs.
pub fn validate_request(req: &AnalysisRequest) -> Result<Vec<f64>, String> {
    if req.schemaVersion != 1 {
        return Err(format!("Unsupported schemaVersion: expected 1, got {}", req.schemaVersion));
    }

    let n = req.timestampsUtc.len();
    if n == 0 {
        return Err("timestampsUtc cannot be empty".to_string());
    }

    // Array length consistency
    if req.sunAzimuthDeg.len() != n {
        return Err(format!("sunAzimuthDeg length ({}) does not match timestampsUtc length ({})", req.sunAzimuthDeg.len(), n));
    }
    if req.sunElevationDeg.len() != n {
        return Err(format!("sunElevationDeg length ({}) does not match timestampsUtc length ({})", req.sunElevationDeg.len(), n));
    }
    if req.earthAzimuthDeg.len() != n {
        return Err(format!("earthAzimuthDeg length ({}) does not match timestampsUtc length ({})", req.earthAzimuthDeg.len(), n));
    }
    if req.earthElevationDeg.len() != n {
        return Err(format!("earthElevationDeg length ({}) does not match timestampsUtc length ({})", req.earthElevationDeg.len(), n));
    }

    // Validate ephemeris values are finite and within reasonable bounds
    for i in 0..n {
        let s_az = req.sunAzimuthDeg[i];
        let s_el = req.sunElevationDeg[i];
        let e_az = req.earthAzimuthDeg[i];
        let e_el = req.earthElevationDeg[i];

        if !s_az.is_finite() || s_az < 0.0 || s_az >= 360.0 {
            return Err(format!("sunAzimuthDeg[{}] ({}) is not a finite value in [0, 360)", i, s_az));
        }
        if !s_el.is_finite() || s_el < -90.0 || s_el > 90.0 {
            return Err(format!("sunElevationDeg[{}] ({}) is not a finite value in [-90, 90]", i, s_el));
        }
        if !e_az.is_finite() || e_az < 0.0 || e_az >= 360.0 {
            return Err(format!("earthAzimuthDeg[{}] ({}) is not a finite value in [0, 360)", i, e_az));
        }
        if !e_el.is_finite() || e_el < -90.0 || e_el > 90.0 {
            return Err(format!("earthElevationDeg[{}] ({}) is not a finite value in [-90, 90]", i, e_el));
        }
    }

    // Parse and validate strictly increasing timestamps
    let mut epoch_seconds = Vec::with_capacity(n + 1);
    let mut prev_epoch = f64::NEG_INFINITY;
    for (i, ts) in req.timestampsUtc.iter().enumerate() {
        let ep = parse_iso_utc_seconds(ts)?;
        if ep <= prev_epoch {
            return Err(format!("timestampsUtc[{}] ('{}') is not strictly greater than previous timestamp", i, ts));
        }
        prev_epoch = ep;
        epoch_seconds.push(ep);
    }

    // Window end must be strictly after the final timestamp
    let window_end_epoch = parse_iso_utc_seconds(&req.windowEndUtc)?;
    if window_end_epoch <= prev_epoch {
        return Err(format!(
            "windowEndUtc ('{}') must be strictly greater than final timestampUtc ('{}')",
            req.windowEndUtc,
            req.timestampsUtc.last().unwrap()
        ));
    }
    epoch_seconds.push(window_end_epoch);

    // Validate positions: must be non-empty and unique IDs
    if req.positions.is_empty() {
        return Err("positions list cannot be empty".to_string());
    }

    let mut seen_ids = HashSet::with_capacity(req.positions.len());

    for pos in &req.positions {
        let id_clean = pos.positionId.trim();
        if id_clean.is_empty() {
            return Err("positionId cannot be empty or whitespace".to_string());
        }
        if !seen_ids.insert(id_clean.to_string()) {
            return Err(format!("Duplicate positionId rejected: '{}'", id_clean));
        }

        let h_az = &pos.horizon.azimuthDeg;
        let h_el = &pos.horizon.horizonElevationDeg;

        if h_az.is_empty() {
            return Err(format!("Position '{}' has empty horizon azimuth array", pos.positionId));
        }
        if h_az.len() != h_el.len() {
            return Err(format!(
                "Position '{}' horizon azimuth length ({}) does not match elevation length ({})",
                pos.positionId,
                h_az.len(),
                h_el.len()
            ));
        }

        // Horizon azimuths must be finite, in [0, 360), and strictly increasing
        let mut prev_az = -1.0;
        for (i, &az) in h_az.iter().enumerate() {
            if !az.is_finite() || az < 0.0 || az >= 360.0 {
                return Err(format!("Position '{}' horizon azimuth[{}] ({}) is not finite in [0, 360)", pos.positionId, i, az));
            }
            if az <= prev_az {
                return Err(format!(
                    "Position '{}' horizon azimuths must be strictly increasing: index {} ({}) <= previous ({})",
                    pos.positionId, i, az, prev_az
                ));
            }
            prev_az = az;
        }

        // Horizon elevations must be finite in [-90, 90]
        for (i, &el) in h_el.iter().enumerate() {
            if !el.is_finite() || el < -90.0 || el > 90.0 {
                return Err(format!("Position '{}' horizon elevation[{}] ({}) is not finite in [-90, 90]", pos.positionId, i, el));
            }
        }
    }

    Ok(epoch_seconds)
}

/// Executes the core analysis across all positions, calculating geometric visibility
/// and duration-weighted interval statistics.
pub fn analyze_mission(req: &AnalysisRequest) -> Result<AnalysisResponse, String> {
    let epoch_seconds = validate_request(req)?;
    let n_samples = req.timestampsUtc.len();

    // Compute interval durations in hours: interval i spans [epoch_seconds[i], epoch_seconds[i+1])
    let mut interval_hours = Vec::with_capacity(n_samples);
    let mut total_duration_hours = 0.0;
    for i in 0..n_samples {
        let dt_sec = epoch_seconds[i + 1] - epoch_seconds[i];
        let dt_hrs = dt_sec / 3600.0;
        interval_hours.push(dt_hrs);
        total_duration_hours += dt_hrs;
    }

    if total_duration_hours <= 0.0 {
        return Err("Total evaluation window duration must be greater than zero".to_string());
    }

    let mut position_results = Vec::with_capacity(req.positions.len());

    for pos in &req.positions {
        let h_az = &pos.horizon.azimuthDeg;
        let h_el = &pos.horizon.horizonElevationDeg;

        let mut sun_horizons = Vec::with_capacity(n_samples);
        let mut sun_visible = Vec::with_capacity(n_samples);
        let mut earth_visible = Vec::with_capacity(n_samples);

        let mut sun_vis_weighted_hours = 0.0;
        let mut earth_vis_weighted_hours = 0.0;

        let mut longest_darkness_hours = 0.0;
        let mut current_darkness_hours = 0.0;

        let mut longest_earth_blackout_hours = 0.0;
        let mut current_earth_blackout_hours = 0.0;

        let mut longest_earth_visible_hours = 0.0;
        let mut current_earth_visible_hours = 0.0;

        for i in 0..n_samples {
            let dt = interval_hours[i];

            // 1. Sun visibility check: strictly el > horizon (equality is blocked)
            let s_az = req.sunAzimuthDeg[i];
            let s_el = req.sunElevationDeg[i];
            let s_horiz = interpolate_horizon_elevation(s_az, h_az, h_el)?;
            sun_horizons.push(s_horiz);
            let s_vis = s_el > s_horiz;
            sun_visible.push(s_vis);

            if s_vis {
                sun_vis_weighted_hours += dt;
                current_darkness_hours = 0.0;
            } else {
                current_darkness_hours += dt;
                if current_darkness_hours > longest_darkness_hours {
                    longest_darkness_hours = current_darkness_hours;
                }
            }

            // 2. Earth visibility check: strictly el > horizon (equality is blocked)
            let e_az = req.earthAzimuthDeg[i];
            let e_el = req.earthElevationDeg[i];
            let e_horiz = interpolate_horizon_elevation(e_az, h_az, h_el)?;
            let e_vis = e_el > e_horiz;
            earth_visible.push(e_vis);

            if e_vis {
                earth_vis_weighted_hours += dt;
                current_earth_visible_hours += dt;
                if current_earth_visible_hours > longest_earth_visible_hours {
                    longest_earth_visible_hours = current_earth_visible_hours;
                }
                current_earth_blackout_hours = 0.0;
            } else {
                current_earth_blackout_hours += dt;
                if current_earth_blackout_hours > longest_earth_blackout_hours {
                    longest_earth_blackout_hours = current_earth_blackout_hours;
                }
                current_earth_visible_hours = 0.0;
            }
        }

        let sun_visible_fraction = sun_vis_weighted_hours / total_duration_hours;
        let earth_visible_fraction = earth_vis_weighted_hours / total_duration_hours;

        let energy = req.energy.as_ref().map(|parameters| energy::simulate_energy(parameters, &req.sunAzimuthDeg, &req.sunElevationDeg, &sun_horizons, &earth_visible, &interval_hours)).transpose()?;
        position_results.push(PositionAnalysisResult {
            energy,
            positionId: pos.positionId.clone(),
            sunVisible: sun_visible,
            earthVisible: earth_visible,
            sunVisibleFraction: sun_visible_fraction,
            earthVisibleFraction: earth_visible_fraction,
            longestDarknessHours: longest_darkness_hours,
            longestEarthBlackoutHours: longest_earth_blackout_hours,
            longestEarthVisibleHours: longest_earth_visible_hours,
        });
    }

    Ok(AnalysisResponse {
        schemaVersion: 1,
        positions: position_results,
        assumptions: ASSUMPTIONS.iter().map(|s| s.to_string()).collect(),
    })
}

// ---------------------------------------------------------------------------
// Single JSON Browser Boundary
// ---------------------------------------------------------------------------

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn analyze_json(request_json: &str) -> Result<String, JsValue> {
    let req: AnalysisRequest = serde_json::from_str(request_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid JSON request: {}", e)))?;

    let res = analyze_mission(&req).map_err(|e| JsValue::from_str(&e))?;

    serde_json::to_string(&res)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

/// Native fallback wrapper for non-wasm environments
pub fn analyze_json_native(request_json: &str) -> Result<String, String> {
    let req: AnalysisRequest = serde_json::from_str(request_json)
        .map_err(|e| format!("Invalid JSON request: {}", e))?;

    let res = analyze_mission(&req)?;

    serde_json::to_string(&res)
        .map_err(|e| format!("Serialization error: {}", e))
}

// ---------------------------------------------------------------------------
// Focused Native Unit Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_horizon() -> HorizonProfileInput {
        HorizonProfileInput {
            azimuthDeg: vec![0.0, 90.0, 180.0, 270.0, 350.0],
            horizonElevationDeg: vec![1.0, 2.0, 3.0, 2.0, 1.5],
        }
    }

    #[test]
    fn test_wrap_interpolation() {
        let h = make_test_horizon();
        let el_wrap = interpolate_horizon_elevation(355.0, &h.azimuthDeg, &h.horizonElevationDeg).unwrap();
        assert!((el_wrap - 1.25).abs() < 1e-6, "Expected 1.25, got {}", el_wrap);

        let el_zero = interpolate_horizon_elevation(0.0, &h.azimuthDeg, &h.horizonElevationDeg).unwrap();
        assert!((el_zero - 1.0).abs() < 1e-6);

        let el_350 = interpolate_horizon_elevation(350.0, &h.azimuthDeg, &h.horizonElevationDeg).unwrap();
        assert!((el_350 - 1.5).abs() < 1e-6);

        let el_mid = interpolate_horizon_elevation(135.0, &h.azimuthDeg, &h.horizonElevationDeg).unwrap();
        assert!((el_mid - 2.5).abs() < 1e-6);
    }

    #[test]
    fn test_tangent_equal_horizon_is_strictly_blocked() {
        let req = AnalysisRequest {
            energy: None,
            schemaVersion: 1,
            timestampsUtc: vec!["2026-10-01T00:00:00Z".to_string()],
            windowEndUtc: "2026-10-01T01:00:00Z".to_string(),
            sunAzimuthDeg: vec![0.0],
            sunElevationDeg: vec![1.0], // Exactly equals horizon el at az=0.0 (1.0)
            earthAzimuthDeg: vec![90.0],
            earthElevationDeg: vec![2.0001], // Strictly above horizon el at az=90.0 (2.0)
            positions: vec![PositionInput {
                positionId: "pos_tangent".to_string(),
                horizon: make_test_horizon(),
            }],
        };

        let res = analyze_mission(&req).unwrap();
        assert_eq!(res.positions[0].sunVisible[0], false, "Equal elevation must be blocked");
        assert_eq!(res.positions[0].earthVisible[0], true, "Strictly greater elevation must be visible");
    }

    #[test]
    fn test_all_visible_and_all_blocked() {
        let req = AnalysisRequest {
            energy: None,
            schemaVersion: 1,
            timestampsUtc: vec![
                "2026-10-01T00:00:00Z".to_string(),
                "2026-10-01T01:00:00Z".to_string(),
            ],
            windowEndUtc: "2026-10-01T02:00:00Z".to_string(),
            sunAzimuthDeg: vec![45.0, 45.0],
            sunElevationDeg: vec![10.0, 10.0],
            earthAzimuthDeg: vec![45.0, 45.0],
            earthElevationDeg: vec![-5.0, -5.0],
            positions: vec![PositionInput {
                positionId: "pos_test".to_string(),
                horizon: make_test_horizon(),
            }],
        };

        let res = analyze_mission(&req).unwrap();
        let p = &res.positions[0];

        assert_eq!(p.sunVisible, vec![true, true]);
        assert_eq!(p.earthVisible, vec![false, false]);
        assert!((p.sunVisibleFraction - 1.0).abs() < 1e-6);
        assert!((p.earthVisibleFraction - 0.0).abs() < 1e-6);
        assert_eq!(p.longestDarknessHours, 0.0);
        assert_eq!(p.longestEarthBlackoutHours, 2.0);
        assert_eq!(p.longestEarthVisibleHours, 0.0);
    }

    #[test]
    fn test_alternating_hourly_earth_visibility_never_duration_minus_blackout() {
        let req = AnalysisRequest {
            energy: None,
            schemaVersion: 1,
            timestampsUtc: vec![
                "2026-10-01T00:00:00Z".to_string(),
                "2026-10-01T01:00:00Z".to_string(),
                "2026-10-01T02:00:00Z".to_string(),
                "2026-10-01T03:00:00Z".to_string(),
            ],
            windowEndUtc: "2026-10-01T04:00:00Z".to_string(),
            sunAzimuthDeg: vec![0.0, 0.0, 0.0, 0.0],
            sunElevationDeg: vec![5.0, 5.0, 5.0, 5.0],
            earthAzimuthDeg: vec![0.0, 0.0, 0.0, 0.0],
            earthElevationDeg: vec![5.0, 0.0, 5.0, 0.0],
            positions: vec![PositionInput {
                positionId: "pos_alternating".to_string(),
                horizon: make_test_horizon(),
            }],
        };

        let res = analyze_mission(&req).unwrap();
        let p = &res.positions[0];

        assert_eq!(p.earthVisible, vec![true, false, true, false]);
        assert_eq!(p.longestEarthVisibleHours, 1.0);
        assert_eq!(p.longestEarthBlackoutHours, 1.0);
        assert!((p.earthVisibleFraction - 0.5).abs() < 1e-6);
    }

    #[test]
    fn test_duplicate_position_ids_rejected() {
        let req = AnalysisRequest {
            energy: None,
            schemaVersion: 1,
            timestampsUtc: vec!["2026-10-01T00:00:00Z".to_string()],
            windowEndUtc: "2026-10-01T01:00:00Z".to_string(),
            sunAzimuthDeg: vec![0.0],
            sunElevationDeg: vec![1.0],
            earthAzimuthDeg: vec![0.0],
            earthElevationDeg: vec![2.0],
            positions: vec![
                PositionInput {
                    positionId: "pos_duplicate".to_string(),
                    horizon: make_test_horizon(),
                },
                PositionInput {
                    positionId: "pos_duplicate".to_string(), // duplicate ID
                    horizon: make_test_horizon(),
                },
            ],
        };

        let err = analyze_mission(&req).unwrap_err();
        assert!(err.contains("Duplicate positionId rejected"), "Expected duplicate ID error, got: {}", err);
    }

    #[test]
    fn test_hardened_iso_parser_edge_cases() {
        // Valid timestamps
        assert!(parse_iso_utc_seconds("2026-10-01T00:00:00Z").is_ok());
        assert!(parse_iso_utc_seconds("2026-10-01T14:30:15.500Z").is_ok());
        assert!(parse_iso_utc_seconds("2024-02-29T12:00:00Z").is_ok()); // 2024 is leap year

        // Rejection cases
        assert!(parse_iso_utc_seconds("2026-02-31T00:00:00Z").is_err(), "Impossible day Feb 31 must be rejected");
        assert!(parse_iso_utc_seconds("2026-02-29T00:00:00Z").is_err(), "2026 is non-leap year; Feb 29 must be rejected");
        assert!(parse_iso_utc_seconds("2026-04-31T00:00:00Z").is_err(), "April has 30 days; 31 must be rejected");
        assert!(parse_iso_utc_seconds("2026-10-01T00:00:00").is_err(), "Missing 'Z' must be rejected");
        assert!(parse_iso_utc_seconds("2026-10-01T00:00:00Zextra").is_err(), "Trailing text must be rejected");
        assert!(parse_iso_utc_seconds("2026-10-01T00:00:NaNZ").is_err(), "NaN seconds must be rejected");
        assert!(parse_iso_utc_seconds("1965-01-01T00:00:00Z").is_err(), "Year before 1970 must be rejected");
        assert!(parse_iso_utc_seconds("2150-01-01T00:00:00Z").is_err(), "Year after 2100 must be rejected");
    }
}
