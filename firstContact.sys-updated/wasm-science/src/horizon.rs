//! Terrain horizon clearance and finite solar-disk illumination.

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct HorizonSample {
    pub elevation_deg: f64,
    pub critical_distance_m: f64,
}

/// Approximate terrain silhouette after raising the sensor by `mast_m`.
pub fn mast_adjusted_horizon(sample: HorizonSample, mast_m: f64) -> Option<f64> {
    if !sample.elevation_deg.is_finite()
        || !sample.critical_distance_m.is_finite()
        || !mast_m.is_finite()
        || sample.critical_distance_m <= 0.0
        || mast_m < 0.0
    { return None; }
    Some((sample.elevation_deg.to_radians().tan() - mast_m / sample.critical_distance_m).atan().to_degrees())
}

/// Fraction of the solar disk above the terrain silhouette (linear limb model).
pub fn solar_disk_fraction(sun_elevation_deg: f64, horizon_elevation_deg: f64, solar_radius_deg: f64) -> f64 {
    if !sun_elevation_deg.is_finite() || !horizon_elevation_deg.is_finite() || !solar_radius_deg.is_finite() || solar_radius_deg <= 0.0 { return 0.0; }
    ((sun_elevation_deg + solar_radius_deg - horizon_elevation_deg) / (2.0 * solar_radius_deg)).clamp(0.0, 1.0)
}

pub const SUN_ANGULAR_RADIUS_DEG: f64 = 0.266;

/// Interpolate a 360-bin horizon mask at a fractional azimuth, wrapping north.
pub fn horizon_at_azimuth(mask: &[f32], azimuth_deg: f64) -> Option<f64> {
    if mask.len() != 360 || !azimuth_deg.is_finite() || !mask.iter().all(|v| v.is_finite()) { return None; }
    let az = azimuth_deg.rem_euclid(360.0);
    let lo = az.floor() as usize;
    let hi = (lo + 1) % 360;
    let t = az - lo as f64;
    Some(mask[lo] as f64 * (1.0 - t) + mask[hi] as f64 * t)
}

/// Solar incidence factor for a flat panel tilted by `tilt_deg` toward the sun.
pub fn panel_incidence_factor(sun_elevation_deg: f64, tilt_deg: f64) -> f64 {
    if !sun_elevation_deg.is_finite() || !tilt_deg.is_finite() { return 0.0; }
    let angle = (90.0 - sun_elevation_deg - tilt_deg).to_radians();
    angle.cos().clamp(0.0, 1.0)
}
