use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnergyParameters {
    pub usable_battery_wh: f64,
    pub initial_soc_fraction: f64,
    pub solar_rated_w: f64,
    pub hotel_load_w: f64,
    pub transmitter_load_w: f64,
    pub panel_tilt_deg: f64,
    pub panel_azimuth_deg: f64,
    pub track_sun_azimuth: bool,
    pub albedo: f64,
    pub emissivity: f64,
    pub background_heat_flux_w_m2: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnergyResult {
    pub battery_soc_pct: Vec<f64>,
    pub solar_power_w: Vec<f64>,
    pub net_power_w: Vec<f64>,
    pub surface_temperature_k: Vec<f64>,
    pub minimum_soc_pct: f64,
    pub first_depletion_hours: Option<f64>,
    pub assumptions: Vec<String>,
}

/// Circular disk area above a locally flat terrain silhouette; not a linear limb model.
pub fn disk_fraction(sun_elevation_deg: f64, horizon_deg: f64) -> f64 {
    let x = ((sun_elevation_deg - horizon_deg) / 0.266).clamp(-1.0, 1.0);
    ((-x).acos() + x * (1.0 - x * x).max(0.0).sqrt()) / std::f64::consts::PI
}

pub fn simulate_energy(p: &EnergyParameters, az: &[f64], el: &[f64], horizon: &[f64], earth: &[bool], dt: &[f64]) -> Result<EnergyResult, String> {
    let n = az.len();
    if n == 0 || [el.len(), horizon.len(), earth.len(), dt.len()].iter().any(|&v| v != n) {
        return Err("Energy model requires synchronized non-empty arrays".into());
    }
    let values = [p.usable_battery_wh, p.initial_soc_fraction, p.solar_rated_w, p.hotel_load_w,
        p.transmitter_load_w, p.panel_tilt_deg, p.panel_azimuth_deg, p.albedo, p.emissivity, p.background_heat_flux_w_m2];
    if !values.iter().all(|v| v.is_finite()) || p.usable_battery_wh <= 0.0 ||
        !(0.0..=1.0).contains(&p.initial_soc_fraction) || p.solar_rated_w < 0.0 ||
        p.hotel_load_w < 0.0 || p.transmitter_load_w < 0.0 ||
        !(0.0..=90.0).contains(&p.panel_tilt_deg) || !(0.0..360.0).contains(&p.panel_azimuth_deg) ||
        !(0.0..=1.0).contains(&p.albedo) || !(0.0..=1.0).contains(&p.emissivity) ||
        p.emissivity == 0.0 || p.background_heat_flux_w_m2 < 0.0 ||
        az.iter().chain(el).chain(horizon).any(|v| !v.is_finite()) || dt.iter().any(|v| !v.is_finite() || *v <= 0.0) {
        return Err("Invalid energy/thermal assumptions or interval durations".into());
    }
    let mut wh = p.usable_battery_wh * p.initial_soc_fraction;
    let mut minimum_soc_pct = p.initial_soc_fraction * 100.0;
    let mut depletion = if wh == 0.0 { Some(0.0) } else { None };
    let mut elapsed = 0.0;
    let mut soc = Vec::with_capacity(n);
    let mut solar_power = Vec::with_capacity(n);
    let mut net_power = Vec::with_capacity(n);
    let mut temperatures = Vec::with_capacity(n);
    for i in 0..n {
        let fraction = disk_fraction(el[i], horizon[i]);
        let elevation = el[i].to_radians();
        let tilt = p.panel_tilt_deg.to_radians();
        let relative_az = if p.track_sun_azimuth { 0.0 } else { (az[i] - p.panel_azimuth_deg).to_radians() };
        let incidence = (elevation.sin() * tilt.cos() + elevation.cos() * tilt.sin() * relative_az.cos()).max(0.0);
        let solar = p.solar_rated_w * fraction * incidence;
        let net = solar - p.hotel_load_w - if earth[i] { p.transmitter_load_w } else { 0.0 };
        if depletion.is_none() && net < 0.0 && wh + net * dt[i] <= 0.0 {
            depletion = Some(elapsed + wh / -net);
        }
        wh = (wh + net * dt[i]).clamp(0.0, p.usable_battery_wh);
        let value = 100.0 * wh / p.usable_battery_wh;
        minimum_soc_pct = minimum_soc_pct.min(value);
        soc.push(value); solar_power.push(solar); net_power.push(net);
        // Instantaneous horizontal-regolith equilibrium, not spacecraft temperature or transient thermal response.
        let flux = (1.0 - p.albedo) * 1361.0 * fraction * elevation.sin().max(0.0) + p.background_heat_flux_w_m2;
        temperatures.push((flux / (p.emissivity * 5.670_374_419e-8)).powf(0.25));
        elapsed += dt[i];
    }
    Ok(EnergyResult {battery_soc_pct: soc, solar_power_w: solar_power, net_power_w: net_power,
        surface_temperature_k: temperatures, minimum_soc_pct, first_depletion_hours: depletion,
        assumptions: vec![
            "Hardware values are user-supplied assumptions, not verified specifications or survival predictions.".into(),
            "Battery integrates piecewise-constant W over hour intervals into usable Wh; charging clips at usable capacity.".into(),
            "Solar generation uses circular disk area above a locally flat horizon and panel centre-ray incidence. Panel azimuth tracking is an explicit assumption.".into(),
            "Transmitter load applies whenever the Earth centre is geometrically visible; no DSN, RF link budget or transmission schedule is modelled.".into(),
            "Temperature is instantaneous horizontal-regolith radiative equilibrium with stated optical/background assumptions; not Diviner-calibrated, thermal inertia, avionics temperature or freeze-out.".into(),
        ]})
}
