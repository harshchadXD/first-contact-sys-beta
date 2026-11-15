//! Radiative-equilibrium surface temperature model.
//!
//! This is an instantaneous equilibrium model, not a subsurface heat-diffusion
//! simulation. `internal_heat_w_m2` can represent an imposed nighttime floor.

pub const STEFAN_BOLTZMANN_W_M2_K4: f64 = 5.670_374_419e-8;
pub const SOLAR_CONSTANT_W_M2: f64 = 1361.0;

pub fn equilibrium_temperature_k(
    sun_fraction: f64,
    sun_elevation_deg: f64,
    albedo: f64,
    emissivity: f64,
    internal_heat_w_m2: f64,
) -> f64 {
    if ![sun_fraction, sun_elevation_deg, albedo, emissivity, internal_heat_w_m2].iter().all(|x| x.is_finite()) {
        return f64::NAN;
    }
    let absorbed = (1.0 - albedo.clamp(0.0, 1.0)) * SOLAR_CONSTANT_W_M2
        * sun_fraction.clamp(0.0, 1.0) * sun_elevation_deg.to_radians().sin().max(0.0)
        + internal_heat_w_m2.max(0.0);
    (absorbed / (emissivity.clamp(1e-4, 1.0) * STEFAN_BOLTZMANN_W_M2_K4)).max(0.0).powf(0.25)
}
