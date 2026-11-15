use crate::{
    ephemeris::{topocentric_alt_az, Body, Site, MOON_ME_RADIUS_KM},
    gravity::propagate_site_ephemeris,
    horizon::{horizon_at_azimuth, mast_adjusted_horizon, solar_disk_fraction, HorizonSample},
    thermal::equilibrium_temperature_k,
};

#[test]
fn topocentric_cardinal_directions_are_consistent() {
    let site = Site::new(0.0, 0.0, 0.0);
    let overhead = topocentric_alt_az(Body::new(MOON_ME_RADIUS_KM + 1.0, 0.0, 0.0), site).unwrap();
    assert!((overhead.elevation_deg - 90.0).abs() < 1e-10);
    let east = topocentric_alt_az(Body::new(MOON_ME_RADIUS_KM, 1.0, 0.0), site).unwrap();
    assert!((east.azimuth_deg - 90.0).abs() < 1e-8);
    assert!((east.elevation_deg).abs() < 1e-8);
}

#[test]
fn horizon_and_solar_disk_handle_edges() {
    let base = HorizonSample { elevation_deg: 2.0, critical_distance_m: 1000.0 };
    let raised = mast_adjusted_horizon(base, 5.0).unwrap();
    assert!(raised < base.elevation_deg);
    assert_eq!(mast_adjusted_horizon(base, -1.0), None);
    assert_eq!(solar_disk_fraction(-1.0, 0.0, 0.266), 0.0);
    assert_eq!(solar_disk_fraction(1.0, 0.0, 0.266), 1.0);
    let mut mask = vec![0.0; 360]; mask[359] = 10.0; mask[0] = 2.0;
    assert!((horizon_at_azimuth(&mask, 359.5).unwrap() - 6.0).abs() < 1e-6);
}

#[test]
fn equilibrium_thermal_model_has_valid_night_floor() {
    let night = equilibrium_temperature_k(0.0, -5.0, 0.12, 0.95, 0.5);
    assert!(night.is_finite() && night > 0.0 && night < 100.0);
    let day = equilibrium_temperature_k(1.0, 60.0, 0.12, 0.95, 0.5);
    assert!(day > night);
}

#[test]
fn gm_propagator_emits_finite_angles_on_exact_sample_epochs() {
    let xyz = [
        [0.0, 0.0, 0.0], [40_000_000.0, 0.0, 0.0], [80_000_000.0, 0.0, 0.0],
        [150_000_000.0, 0.0, 0.0], [220_000_000.0, 0.0, 0.0], [778_000_000.0, 0.0, 0.0],
        [1_400_000_000.0, 0.0, 0.0], [2_870_000_000.0, 0.0, 0.0], [4_500_000_000.0, 0.0, 0.0],
        [5_900_000_000.0, 0.0, 0.0],
    ];
    let states: Vec<f64> = xyz.into_iter().flat_map(|p| [p[0], p[1], p[2], 0.0, 0.0, 0.0]).collect();
    let gm = [132_712_440_040.944, 22_032.09, 324_858.592, 398_600.436233, 4_902.800076,
        42_828.375214, 126_712_764.8, 37_940_585.2, 5_794_548.6, 6_836_535.0, 977.0];
    let times = [0.0, 3600.0];
    let moon = [0.0; 6]; let earth = [-4670.0, 0.0, 0.0, -4670.0, 0.0, 0.0];
    let rotations = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0,
                     1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];
    let mut output = Vec::new();
    propagate_site_ephemeris(&states, &gm, &times, &moon, &earth, &rotations, 0.0, 0.0, 0.0, &mut output).unwrap();
    assert_eq!(output.len(), 8);
    assert!(output.iter().all(|v| v.is_finite()));
    let bad_times = [0.0, 0.0];
    assert!(propagate_site_ephemeris(&states, &gm, &bad_times, &moon, &earth, &rotations, 0.0, 0.0, 0.0, &mut output).is_err());
}
