use first_contact_engine::energy::{disk_fraction, simulate_energy, EnergyParameters};

fn parameters() -> EnergyParameters {
    EnergyParameters { usable_battery_wh: 100.0, initial_soc_fraction: 1.0, solar_rated_w: 0.0,
      hotel_load_w: 25.0, transmitter_load_w: 0.0, panel_tilt_deg: 90.0, panel_azimuth_deg: 90.0,
      track_sun_azimuth: true, albedo: 0.12, emissivity: 0.95, background_heat_flux_w_m2: 0.02 }
}

#[test]
fn finite_solar_disk_area_has_half_at_the_limb() {
    assert!((disk_fraction(0.0, 0.0) - 0.5).abs() < 1e-12);
    assert_eq!(disk_fraction(-1.0, 0.0), 0.0);
    assert_eq!(disk_fraction(1.0, 0.0), 1.0);
}

#[test]
fn battery_conserves_energy_and_reports_sub_interval_depletion() {
    let r = simulate_energy(&parameters(), &[0.0,0.0], &[-5.0,-5.0], &[0.0,0.0], &[false,false], &[1.0,4.0]).unwrap();
    assert!((r.battery_soc_pct[0] - 75.0).abs() < 1e-12);
    assert_eq!(r.battery_soc_pct[1], 0.0);
    assert!((r.first_depletion_hours.unwrap() - 4.0).abs() < 1e-12);
    assert!(r.surface_temperature_k.iter().all(|v| *v > 0.0 && *v < 50.0));
}

#[test]
fn charge_clips_at_usable_capacity() {
    let mut p = parameters(); p.solar_rated_w = 500.0; p.hotel_load_w = 0.0;
    let r = simulate_energy(&p, &[90.0], &[10.0], &[0.0], &[true], &[1.0]).unwrap();
    assert_eq!(r.battery_soc_pct[0], 100.0);
    assert!(r.solar_power_w[0] > 400.0);
}

#[test]
fn rejects_invalid_parameters_shapes_and_durations() {
    let mut p = parameters(); p.usable_battery_wh = 0.0;
    assert!(simulate_energy(&p, &[0.0], &[0.0], &[0.0], &[false], &[1.0]).is_err());
    assert!(simulate_energy(&parameters(), &[0.0], &[], &[0.0], &[false], &[1.0]).is_err());
    assert!(simulate_energy(&parameters(), &[0.0], &[0.0], &[0.0], &[false], &[f64::NAN]).is_err());
}
