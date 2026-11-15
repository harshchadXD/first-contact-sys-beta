//! Timeline evaluation and 30-day launch-slip search.

use crate::horizon::{horizon_at_azimuth, mast_adjusted_horizon, HorizonSample, SUN_ANGULAR_RADIUS_DEG};
use crate::survival::{step_survival, HardwareProfile, SurvivalInput};

pub const HOURS_PER_DAY: usize = 24;
pub const SLIP_DAYS: usize = 30;
pub const RECORD_WIDTH: usize = 10;

/// Per-hour input vectors. Every vector must have the same nonzero length;
/// horizon masks contain exactly 360 samples.
#[derive(Clone, Debug)]
pub struct MissionInput<'a> {
    pub horizon_deg: &'a [f32],
    pub critical_distance_m: &'a [f32],
    pub sun_azimuth_deg: &'a [f32],
    pub sun_elevation_deg: &'a [f32],
    pub earth_azimuth_deg: &'a [f32],
    pub earth_elevation_deg: &'a [f32],
    pub hotel_load_w: f64,
    pub mast_m: f64,
    pub initial_soc: f64,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct MissionMetrics {
    pub sun_percent: f64,
    pub earth_percent: f64,
    pub simultaneous_percent: f64,
    pub longest_darkness_hours: f64,
    pub longest_comms_gap_hours: f64,
    pub minimum_soc_percent: f64,
    pub minimum_temperature_k: f64,
    pub mission_survives: bool,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum SolverError { InvalidInput }

fn validate(input: &MissionInput<'_>) -> bool {
    let n = input.sun_azimuth_deg.len();
    n > 0 && input.horizon_deg.len() == 360 && input.critical_distance_m.len() == 360
        && [input.sun_elevation_deg.len(), input.earth_azimuth_deg.len(), input.earth_elevation_deg.len()].iter().all(|&m| m == n)
        && input.horizon_deg.iter().chain(input.critical_distance_m).chain(input.sun_azimuth_deg)
            .chain(input.sun_elevation_deg).chain(input.earth_azimuth_deg).chain(input.earth_elevation_deg).all(|x| x.is_finite())
        && input.critical_distance_m.iter().all(|&x| x > 0.0)
        && input.hotel_load_w.is_finite() && input.mast_m.is_finite() && input.mast_m >= 0.0
        && input.initial_soc.is_finite()
}

/// Evaluate one hourly timeline. Output records are f32 tuples:
/// [sunAz, sunEl, sunFraction, earthAz, earthEl, earthVisible, SoC%, tempK, solarW, netW].
pub fn evaluate_timeline(input: &MissionInput<'_>, profile: HardwareProfile, output: &mut Vec<f32>) -> Result<MissionMetrics, SolverError> {
    if !validate(input) { return Err(SolverError::InvalidInput); }
    let n = input.sun_azimuth_deg.len();
    output.clear(); output.reserve(n * RECORD_WIDTH);
    let mut soc = input.initial_soc.clamp(0.0, 1.0);
    let mut illuminated = 0usize; let mut earth_count = 0usize; let mut both_count = 0usize;
    let (mut dark, mut max_dark, mut comm_gap, mut max_comm_gap) = (0usize, 0usize, 0usize, 0usize);
    let mut min_soc = soc; let mut min_temp = f64::INFINITY;
    for i in 0..n {
        let sun_az = input.sun_azimuth_deg[i] as f64;
        let earth_az = input.earth_azimuth_deg[i] as f64;
        let sun_h0 = horizon_at_azimuth(input.horizon_deg, sun_az).ok_or(SolverError::InvalidInput)?;
        let earth_h0 = horizon_at_azimuth(input.horizon_deg, earth_az).ok_or(SolverError::InvalidInput)?;
        let sun_d = horizon_at_azimuth(input.critical_distance_m, sun_az).ok_or(SolverError::InvalidInput)?;
        let earth_d = horizon_at_azimuth(input.critical_distance_m, earth_az).ok_or(SolverError::InvalidInput)?;
        let sun_h = mast_adjusted_horizon(HorizonSample { elevation_deg: sun_h0, critical_distance_m: sun_d }, input.mast_m).ok_or(SolverError::InvalidInput)?;
        let earth_h = mast_adjusted_horizon(HorizonSample { elevation_deg: earth_h0, critical_distance_m: earth_d }, input.mast_m).ok_or(SolverError::InvalidInput)?;
        let sun_fraction = ((input.sun_elevation_deg[i] as f64 + SUN_ANGULAR_RADIUS_DEG - sun_h) / (2.0 * SUN_ANGULAR_RADIUS_DEG)).clamp(0.0, 1.0);
        let earth_visible = input.earth_elevation_deg[i] as f64 > earth_h;
        let sun_visible = sun_fraction > 0.0;
        illuminated += if sun_visible { 1 } else { 0 };
        earth_count += if earth_visible { 1 } else { 0 };
        both_count += if sun_visible && earth_visible { 1 } else { 0 };
        if sun_visible { max_dark = max_dark.max(dark); dark = 0; } else { dark += 1; }
        if earth_visible { max_comm_gap = max_comm_gap.max(comm_gap); comm_gap = 0; } else { comm_gap += 1; }
        let state = step_survival(soc, SurvivalInput {
            sun_elevation_deg: input.sun_elevation_deg[i] as f64,
            solar_fraction: sun_fraction, earth_visible, duration_hours: 1.0, hotel_load_w: input.hotel_load_w,
        }, profile, 0.12, 0.95, 0.02);
        soc = state.soc_fraction; min_soc = min_soc.min(soc); min_temp = min_temp.min(state.surface_temperature_k);
        output.extend_from_slice(&[sun_az as f32, input.sun_elevation_deg[i], sun_fraction as f32,
            earth_az as f32, input.earth_elevation_deg[i], if earth_visible { 1.0 } else { 0.0 },
            (soc * 100.0) as f32, state.surface_temperature_k as f32,
            state.solar_generation_w as f32, state.net_power_w as f32]);
    }
    max_dark = max_dark.max(dark); max_comm_gap = max_comm_gap.max(comm_gap);
    Ok(MissionMetrics {
        sun_percent: 100.0 * illuminated as f64 / n as f64,
        earth_percent: 100.0 * earth_count as f64 / n as f64,
        simultaneous_percent: 100.0 * both_count as f64 / n as f64,
        longest_darkness_hours: max_dark as f64,
        longest_comms_gap_hours: max_comm_gap as f64,
        minimum_soc_percent: min_soc * 100.0,
        minimum_temperature_k: min_temp,
        mission_survives: min_soc > 0.0,
    })
}

/// Evaluate each 24-hour start offset across a 30-day source timeline. The
/// caller supplies at least 59 days of hourly input so all 30 windows cover
/// 30 days. Results hold
/// [slipDay, sunPct, earthPct, maxDarkHrs, maxCommsGapHrs, minSocPct, survives].
pub fn solve_launch_slips(input: &MissionInput<'_>, profile: HardwareProfile, output: &mut Vec<f32>) -> Result<(), SolverError> {
    if !validate(input) || input.sun_azimuth_deg.len() < (2 * SLIP_DAYS - 1) * HOURS_PER_DAY { return Err(SolverError::InvalidInput); }
    output.clear(); output.reserve(SLIP_DAYS * 7);
    let mut tmp = Vec::with_capacity(SLIP_DAYS * HOURS_PER_DAY * RECORD_WIDTH);
    for day in 0..SLIP_DAYS {
        let start = day * HOURS_PER_DAY; let end = start + SLIP_DAYS * HOURS_PER_DAY;
        let shifted = MissionInput {
            horizon_deg: input.horizon_deg, critical_distance_m: input.critical_distance_m,
            sun_azimuth_deg: &input.sun_azimuth_deg[start..end], sun_elevation_deg: &input.sun_elevation_deg[start..end],
            earth_azimuth_deg: &input.earth_azimuth_deg[start..end], earth_elevation_deg: &input.earth_elevation_deg[start..end],
            hotel_load_w: input.hotel_load_w, mast_m: input.mast_m, initial_soc: input.initial_soc,
        };
        let m = evaluate_timeline(&shifted, profile, &mut tmp)?;
        output.extend_from_slice(&[day as f32, m.sun_percent as f32, m.earth_percent as f32,
            m.longest_darkness_hours as f32, m.longest_comms_gap_hours as f32,
            m.minimum_soc_percent as f32, if m.mission_survives { 1.0 } else { 0.0 }]);
    }
    Ok(())
}
