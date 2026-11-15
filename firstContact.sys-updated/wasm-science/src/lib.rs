//! First Contact.sys lunar science kernel.
//!
//! The mission timeline consumes local topocentric azimuth/elevation arrays.
//! The offline SPICE baker provides direct DE421 baseline samples and the
//! frame/state inputs used by the separate reduced GM-sensitivity propagator.

pub mod ephemeris;
pub mod gravity;
pub mod horizon;
pub mod solver;
pub mod survival;
pub mod thermal;

#[cfg(test)]
mod tests;

pub use ephemeris::{topocentric_alt_az, Body, Site, Topocentric};
use solver::{evaluate_timeline, solve_launch_slips, MissionInput};
use survival::{HardwareProfile, HARDWARE_PROFILES};

/// Mission engine retaining its result buffers in Rust/WASM linear memory.
/// A JavaScript Float32Array view over `get_results_ptr/len` avoids JSON copies.
pub struct MissionEngine {
    profiles: [HardwareProfile; 4],
    horizon_deg: Vec<f32>,
    critical_distance_m: Vec<f32>,
    sun_azimuth_deg: Vec<f32>,
    sun_elevation_deg: Vec<f32>,
    earth_azimuth_deg: Vec<f32>,
    earth_elevation_deg: Vec<f32>,
    baseline_sun_azimuth_deg: Vec<f32>,
    baseline_sun_elevation_deg: Vec<f32>,
    baseline_earth_azimuth_deg: Vec<f32>,
    baseline_earth_elevation_deg: Vec<f32>,
    gm_scenario_output: Vec<f32>,
    gm_scenario_delta: Vec<f32>,
    results: Vec<f32>,
    launch_results: Vec<f32>,
    metrics: solver::MissionMetrics,
}

impl Default for MissionEngine {
    fn default() -> Self {
        Self { profiles: HARDWARE_PROFILES, horizon_deg: Vec::new(), critical_distance_m: Vec::new(), sun_azimuth_deg: Vec::new(),
            sun_elevation_deg: Vec::new(), earth_azimuth_deg: Vec::new(), earth_elevation_deg: Vec::new(),
            baseline_sun_azimuth_deg: Vec::new(), baseline_sun_elevation_deg: Vec::new(), baseline_earth_azimuth_deg: Vec::new(), baseline_earth_elevation_deg: Vec::new(),
            gm_scenario_output: Vec::new(), gm_scenario_delta: Vec::new(),
            results: Vec::new(), launch_results: Vec::new(), metrics: solver::MissionMetrics::default() }
    }
}

impl MissionEngine {
    pub fn new() -> Self { Self::default() }

    /// Copy baked site horizon and ephemeris samples into engine memory.
    pub fn set_data(&mut self, horizon_deg: &[f32], critical_distance_m: &[f32], sun_azimuth_deg: &[f32],
        sun_elevation_deg: &[f32], earth_azimuth_deg: &[f32], earth_elevation_deg: &[f32]) -> Result<(), &'static str> {
        let n = sun_azimuth_deg.len();
        if horizon_deg.len() != 360 || critical_distance_m.len() != 360 || n == 0
            || [sun_elevation_deg.len(), earth_azimuth_deg.len(), earth_elevation_deg.len()].iter().any(|&m| m != n)
            || horizon_deg.iter().chain(critical_distance_m).chain(sun_azimuth_deg).chain(sun_elevation_deg)
                .chain(earth_azimuth_deg).chain(earth_elevation_deg).any(|x| !x.is_finite())
            || critical_distance_m.iter().any(|&x| x <= 0.0) { return Err("invalid horizon or ephemeris arrays"); }
        self.horizon_deg.clear(); self.horizon_deg.extend_from_slice(horizon_deg);
        self.critical_distance_m.clear(); self.critical_distance_m.extend_from_slice(critical_distance_m);
        self.sun_azimuth_deg.clear(); self.sun_azimuth_deg.extend_from_slice(sun_azimuth_deg);
        self.sun_elevation_deg.clear(); self.sun_elevation_deg.extend_from_slice(sun_elevation_deg);
        self.earth_azimuth_deg.clear(); self.earth_azimuth_deg.extend_from_slice(earth_azimuth_deg);
        self.earth_elevation_deg.clear(); self.earth_elevation_deg.extend_from_slice(earth_elevation_deg);
        self.baseline_sun_azimuth_deg.clear(); self.baseline_sun_azimuth_deg.extend_from_slice(sun_azimuth_deg);
        self.baseline_sun_elevation_deg.clear(); self.baseline_sun_elevation_deg.extend_from_slice(sun_elevation_deg);
        self.baseline_earth_azimuth_deg.clear(); self.baseline_earth_azimuth_deg.extend_from_slice(earth_azimuth_deg);
        self.baseline_earth_elevation_deg.clear(); self.baseline_earth_elevation_deg.extend_from_slice(earth_elevation_deg);
        self.gm_scenario_output.clear(); self.gm_scenario_delta.clear();
        Ok(())
    }

    /// Propagate user-supplied GMs from a DE421 starting state, replace the
    /// active Sun/Earth pointing series, and preserve the baked DE421 series
    /// for repeatable comparisons. `scenario_ephemeris` stores four values per
    /// sample: Sun az/el then Earth az/el. `scenario_delta` stores shortest
    /// signed azimuth and elevation deltas for Sun then Earth, in degrees.
    pub fn apply_gm_scenario(&mut self, initial_states: &[f64], gm: &[f64], sample_times_et: &[f64],
        moon_offsets_km: &[f64], earth_offsets_km: &[f64], moon_to_j2000: &[f64],
        latitude_deg: f64, east_longitude_deg: f64, elevation_m: f64) -> Result<(), &'static str> {
        if self.baseline_sun_azimuth_deg.is_empty() { return Err("load the DE421 baseline before applying a GM scenario"); }
        let count = self.baseline_sun_azimuth_deg.len();
        if moon_offsets_km.len() != count * 3 || earth_offsets_km.len() != count * 3 || moon_to_j2000.len() != count * 9 {
            return Err("GM geometry sample count must match the loaded DE421 baseline");
        }
        gravity::propagate_site_ephemeris(initial_states, gm, sample_times_et, moon_offsets_km, earth_offsets_km,
            moon_to_j2000, latitude_deg, east_longitude_deg, elevation_m, &mut self.gm_scenario_output)
            .map_err(|_| "invalid or singular GM propagation input")?;
        if self.gm_scenario_output.len() != count * 4 { return Err("GM propagation output length mismatch"); }
        self.gm_scenario_delta.clear();
        self.gm_scenario_delta.reserve(count * 4);
        for i in 0..count {
            let j = i * 4;
            let wrapped = |a: f32, b: f32| (a - b + 180.0).rem_euclid(360.0) - 180.0;
            self.gm_scenario_delta.extend_from_slice(&[
                wrapped(self.gm_scenario_output[j], self.baseline_sun_azimuth_deg[i]),
                self.gm_scenario_output[j + 1] - self.baseline_sun_elevation_deg[i],
                wrapped(self.gm_scenario_output[j + 2], self.baseline_earth_azimuth_deg[i]),
                self.gm_scenario_output[j + 3] - self.baseline_earth_elevation_deg[i],
            ]);
        }
        self.sun_azimuth_deg.clear(); self.sun_elevation_deg.clear();
        self.earth_azimuth_deg.clear(); self.earth_elevation_deg.clear();
        for values in self.gm_scenario_output.chunks_exact(4) {
            self.sun_azimuth_deg.push(values[0]); self.sun_elevation_deg.push(values[1]);
            self.earth_azimuth_deg.push(values[2]); self.earth_elevation_deg.push(values[3]);
        }
        Ok(())
    }

    pub fn set_hardware_profile(&mut self, index: usize, battery_capacity_wh: f64, solar_array_w: f64,
        communication_load_w: f64, panel_tilt_deg: f64) -> Result<(), &'static str> {
        let profile = self.profiles.get_mut(index).ok_or("unknown hardware profile")?;
        if ![battery_capacity_wh, solar_array_w, communication_load_w, panel_tilt_deg].iter().all(|x| x.is_finite())
            || battery_capacity_wh <= 0.0 || solar_array_w < 0.0 || communication_load_w < 0.0
            || !(-90.0..=90.0).contains(&panel_tilt_deg) { return Err("invalid hardware profile parameters"); }
        profile.battery_capacity_wh = battery_capacity_wh;
        profile.solar_array_w = solar_array_w;
        profile.communication_load_w = communication_load_w;
        profile.panel_tilt_deg = panel_tilt_deg;
        Ok(())
    }

    fn profile(&self, index: usize, hotel_load_w: f64) -> Result<HardwareProfile, &'static str> {
        let mut profile = *self.profiles.get(index).ok_or("unknown hardware profile")?;
        if !hotel_load_w.is_finite() || hotel_load_w < 0.0 { return Err("hotel load must be finite and nonnegative"); }
        profile.nominal_hotel_w = hotel_load_w;
        Ok(profile)
    }

    pub fn evaluate(&mut self, profile_index: usize, mast_m: f64, hotel_load_w: f64, initial_soc: f64) -> Result<(), &'static str> {
        let profile = self.profile(profile_index, hotel_load_w)?;
        if !mast_m.is_finite() || mast_m < 0.0 || !initial_soc.is_finite() { return Err("mast and initial charge must be finite; mast cannot be negative"); }
        let input = MissionInput { horizon_deg: &self.horizon_deg, critical_distance_m: &self.critical_distance_m,
            sun_azimuth_deg: &self.sun_azimuth_deg, sun_elevation_deg: &self.sun_elevation_deg,
            earth_azimuth_deg: &self.earth_azimuth_deg, earth_elevation_deg: &self.earth_elevation_deg,
            hotel_load_w, mast_m, initial_soc };
        self.metrics = evaluate_timeline(&input, profile, &mut self.results).map_err(|_| "invalid simulation input")?;
        Ok(())
    }

    pub fn solve_launch_slips(&mut self, profile_index: usize, mast_m: f64, hotel_load_w: f64, initial_soc: f64) -> Result<(), &'static str> {
        let profile = self.profile(profile_index, hotel_load_w)?;
        if !mast_m.is_finite() || mast_m < 0.0 || !initial_soc.is_finite() { return Err("mast and initial charge must be finite; mast cannot be negative"); }
        let input = MissionInput { horizon_deg: &self.horizon_deg, critical_distance_m: &self.critical_distance_m,
            sun_azimuth_deg: &self.sun_azimuth_deg, sun_elevation_deg: &self.sun_elevation_deg,
            earth_azimuth_deg: &self.earth_azimuth_deg, earth_elevation_deg: &self.earth_elevation_deg,
            hotel_load_w, mast_m, initial_soc };
        solve_launch_slips(&input, profile, &mut self.launch_results).map_err(|_| "launch solver requires at least 30 days of valid hourly input")
    }

    pub fn results_ptr(&self) -> *const f32 { self.results.as_ptr() }
    pub fn results_len(&self) -> usize { self.results.len() }
    pub fn launch_results_ptr(&self) -> *const f32 { self.launch_results.as_ptr() }
    pub fn launch_results_len(&self) -> usize { self.launch_results.len() }
    pub fn metrics(&self) -> solver::MissionMetrics { self.metrics }
    pub fn gm_scenario_output_ptr(&self) -> *const f32 { self.gm_scenario_output.as_ptr() }
    pub fn gm_scenario_output_len(&self) -> usize { self.gm_scenario_output.len() }
    pub fn gm_scenario_delta_ptr(&self) -> *const f32 { self.gm_scenario_delta.as_ptr() }
    pub fn gm_scenario_delta_len(&self) -> usize { self.gm_scenario_delta.len() }
}

#[cfg(target_arch = "wasm32")]
mod wasm_api {
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    pub struct WasmMissionEngine { inner: super::MissionEngine }

    #[wasm_bindgen]
    impl WasmMissionEngine {
        #[wasm_bindgen(constructor)]
        pub fn new() -> Self { Self { inner: super::MissionEngine::new() } }

        pub fn set_data(&mut self, horizon_deg: &[f32], critical_distance_m: &[f32], sun_azimuth_deg: &[f32],
            sun_elevation_deg: &[f32], earth_azimuth_deg: &[f32], earth_elevation_deg: &[f32]) -> Result<(), JsValue> {
            self.inner.set_data(horizon_deg, critical_distance_m, sun_azimuth_deg, sun_elevation_deg, earth_azimuth_deg, earth_elevation_deg)
                .map_err(JsValue::from_str)
        }

        pub fn apply_gm_scenario(&mut self, initial_states: &[f64], gm: &[f64], sample_times_et: &[f64],
            moon_offsets_km: &[f64], earth_offsets_km: &[f64], moon_to_j2000: &[f64],
            latitude_deg: f64, east_longitude_deg: f64, elevation_m: f64) -> Result<(), JsValue> {
            self.inner.apply_gm_scenario(initial_states, gm, sample_times_et, moon_offsets_km, earth_offsets_km,
                moon_to_j2000, latitude_deg, east_longitude_deg, elevation_m).map_err(JsValue::from_str)
        }

        pub fn set_hardware_profile(&mut self, index: usize, battery_capacity_wh: f64, solar_array_w: f64,
            communication_load_w: f64, panel_tilt_deg: f64) -> Result<(), JsValue> {
            self.inner.set_hardware_profile(index, battery_capacity_wh, solar_array_w, communication_load_w, panel_tilt_deg)
                .map_err(JsValue::from_str)
        }

        pub fn evaluate(&mut self, profile_index: usize, mast_m: f64, hotel_load_w: f64, initial_soc: f64) -> Result<(), JsValue> {
            self.inner.evaluate(profile_index, mast_m, hotel_load_w, initial_soc).map_err(JsValue::from_str)
        }

        pub fn solve_launch_slips(&mut self, profile_index: usize, mast_m: f64, hotel_load_w: f64, initial_soc: f64) -> Result<(), JsValue> {
            self.inner.solve_launch_slips(profile_index, mast_m, hotel_load_w, initial_soc).map_err(JsValue::from_str)
        }

        pub fn get_results_ptr(&self) -> usize { self.inner.results_ptr() as usize }
        pub fn get_results_len(&self) -> usize { self.inner.results_len() }
        pub fn get_launch_results_ptr(&self) -> usize { self.inner.launch_results_ptr() as usize }
        pub fn get_launch_results_len(&self) -> usize { self.inner.launch_results_len() }
        pub fn get_gm_scenario_ephemeris_ptr(&self) -> usize { self.inner.gm_scenario_output_ptr() as usize }
        pub fn get_gm_scenario_ephemeris_len(&self) -> usize { self.inner.gm_scenario_output_len() }
        pub fn get_gm_scenario_delta_ptr(&self) -> usize { self.inner.gm_scenario_delta_ptr() as usize }
        pub fn get_gm_scenario_delta_len(&self) -> usize { self.inner.gm_scenario_delta_len() }
        pub fn get_metrics(&self) -> Vec<f64> {
            let m = self.inner.metrics(); vec![m.sun_percent, m.earth_percent, m.simultaneous_percent,
                m.longest_darkness_hours, m.longest_comms_gap_hours, m.minimum_soc_percent, m.minimum_temperature_k,
                if m.mission_survives { 1.0 } else { 0.0 }]
        }
    }
}
