//! Battery and radiative-equilibrium models. Hardware values are configurable;
//! only nominal hotel loads are populated from the project brief.

use crate::{horizon::panel_incidence_factor, thermal::equilibrium_temperature_k};

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct HardwareProfile {
    pub name: &'static str,
    pub nominal_hotel_w: f64,
    pub battery_capacity_wh: f64,
    pub solar_array_w: f64,
    pub communication_load_w: f64,
    pub panel_tilt_deg: f64,
}

// Battery/array/communications values are placeholders pending mission-specific
// datasheets; the nominal hotel loads are the values specified in the brief.
pub const HARDWARE_PROFILES: [HardwareProfile; 4] = [
    HardwareProfile { name: "Nova-C", nominal_hotel_w: 120.0, battery_capacity_wh: 1200.0, solar_array_w: 500.0, communication_load_w: 80.0, panel_tilt_deg: 0.0 },
    HardwareProfile { name: "Griffin", nominal_hotel_w: 280.0, battery_capacity_wh: 2400.0, solar_array_w: 900.0, communication_load_w: 120.0, panel_tilt_deg: 0.0 },
    HardwareProfile { name: "Blue Ghost", nominal_hotel_w: 160.0, battery_capacity_wh: 1800.0, solar_array_w: 600.0, communication_load_w: 100.0, panel_tilt_deg: 0.0 },
    HardwareProfile { name: "Vikram", nominal_hotel_w: 100.0, battery_capacity_wh: 1000.0, solar_array_w: 450.0, communication_load_w: 70.0, panel_tilt_deg: 0.0 },
];

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SurvivalInput {
    pub sun_elevation_deg: f64,
    pub solar_fraction: f64,
    pub earth_visible: bool,
    pub duration_hours: f64,
    pub hotel_load_w: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SurvivalState {
    pub soc_fraction: f64,
    pub solar_generation_w: f64,
    pub net_power_w: f64,
    pub surface_temperature_k: f64,
}

/// One-step battery integrator. SoC is clamped to [0,1], with no charging above full.
pub fn step_survival(
    soc_fraction: f64,
    input: SurvivalInput,
    profile: HardwareProfile,
    albedo: f64,
    emissivity: f64,
    internal_heat_w_m2: f64,
) -> SurvivalState {
    let sun_fraction = input.solar_fraction.clamp(0.0, 1.0);
    let incidence = panel_incidence_factor(input.sun_elevation_deg, profile.panel_tilt_deg);
    let solar_generation = profile.solar_array_w.max(0.0) * sun_fraction * incidence;
    let transmit = if input.earth_visible { profile.communication_load_w.max(0.0) } else { 0.0 };
    let net_power = solar_generation - input.hotel_load_w.max(0.0) - transmit;
    let capacity = profile.battery_capacity_wh.max(1e-9);
    let next_soc = (soc_fraction.clamp(0.0, 1.0) + net_power * input.duration_hours.max(0.0) / capacity).clamp(0.0, 1.0);

    let temperature = equilibrium_temperature_k(sun_fraction, input.sun_elevation_deg, albedo, emissivity, internal_heat_w_m2);
    SurvivalState { soc_fraction: next_soc, solar_generation_w: solar_generation, net_power_w: net_power, surface_temperature_k: temperature }
}
