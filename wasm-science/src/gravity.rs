//! Reduced Newtonian N-body sensitivity propagator, initialized from DE421.
//!
//! Body order in the 60-value initial state is Sun, Mercury, Venus,
//! Earth-Moon barycenter, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto.
//! Each body contributes [x,y,z,vx,vy,vz], in km and km/s, in J2000/ICRF.
//! GM inputs are [Sun, Mercury, Venus, Earth, Moon, Mars, Jupiter, Saturn,
//! Uranus, Neptune, Pluto] in km^3/s^2. Earth and Moon GMs are summed for the
//! Earth-Moon barycenter's point-mass dynamics.
//!
//! This intentionally reduced point-mass model omits DE421's PPN terms,
//! asteroid perturbations, solar J2, and variations of the Moon's orbit and
//! orientation. It is a what-if sensitivity model; it never replaces DE421.

use std::f64::consts::PI;

pub const DYNAMIC_BODY_COUNT: usize = 10;
pub const GM_INPUT_COUNT: usize = 11;
pub const STATE_WIDTH: usize = 6;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum GravityError {
    InvalidInput,
    SingularState,
}

fn validate(initial_states: &[f64], gm: &[f64], sample_times: &[f64], moon_offsets: &[f64],
            earth_offsets: &[f64], rotations: &[f64]) -> Result<usize, GravityError> {
    if initial_states.len() != DYNAMIC_BODY_COUNT * STATE_WIDTH || gm.len() != GM_INPUT_COUNT
        || sample_times.is_empty()
        || !initial_states.iter().chain(gm).chain(sample_times).chain(moon_offsets).chain(earth_offsets).chain(rotations).all(|x| x.is_finite())
        || gm.iter().any(|&x| x <= 0.0) { return Err(GravityError::InvalidInput); }
    if moon_offsets.len() % 3 != 0 { return Err(GravityError::InvalidInput); }
    let count = moon_offsets.len() / 3;
    if count == 0 || sample_times.len() != count || earth_offsets.len() != count * 3 || rotations.len() != count * 9
        || sample_times.windows(2).any(|w| w[1] <= w[0]) {
        return Err(GravityError::InvalidInput);
    }
    Ok(count)
}

fn body_gms(input: &[f64]) -> [f64; DYNAMIC_BODY_COUNT] {
    [input[0], input[1], input[2], input[3] + input[4], input[5], input[6], input[7], input[8], input[9], input[10]]
}

fn accelerations(positions: &[[f64; 3]; DYNAMIC_BODY_COUNT], gm: &[f64; DYNAMIC_BODY_COUNT])
    -> Result<[[f64; 3]; DYNAMIC_BODY_COUNT], GravityError> {
    let mut acceleration = [[0.0; 3]; DYNAMIC_BODY_COUNT];
    for i in 0..DYNAMIC_BODY_COUNT {
        for j in 0..DYNAMIC_BODY_COUNT {
            if i == j { continue; }
            let dx = positions[j][0] - positions[i][0];
            let dy = positions[j][1] - positions[i][1];
            let dz = positions[j][2] - positions[i][2];
            let r2 = dx * dx + dy * dy + dz * dz;
            if r2 <= 1e-18 || !r2.is_finite() { return Err(GravityError::SingularState); }
            let inverse_r3 = 1.0 / (r2 * r2.sqrt());
            let scale = gm[j] * inverse_r3;
            acceleration[i][0] += scale * dx;
            acceleration[i][1] += scale * dy;
            acceleration[i][2] += scale * dz;
        }
    }
    Ok(acceleration)
}

fn rotate(m: &[f64], v: [f64; 3]) -> [f64; 3] {
    [m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
     m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
     m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]
}

fn dot(a: [f64; 3], b: [f64; 3]) -> f64 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
fn sub(a: [f64; 3], b: [f64; 3]) -> [f64; 3] { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }

fn angles_for_site(state: &[[f64; STATE_WIDTH]; DYNAMIC_BODY_COUNT],
                   moon_offset: [f64; 3], earth_offset: [f64; 3], rotation: &[f64],
                   lat_deg: f64, lon_deg: f64, elevation_m: f64) -> [f64; 4] {
    let emb = [state[3][0], state[3][1], state[3][2]];
    let sun = [state[0][0], state[0][1], state[0][2]];
    let moon = [emb[0] + moon_offset[0], emb[1] + moon_offset[1], emb[2] + moon_offset[2]];
    let earth = [emb[0] + earth_offset[0], emb[1] + earth_offset[1], emb[2] + earth_offset[2]];

    let lat = lat_deg * PI / 180.0;
    let lon = lon_deg * PI / 180.0;
    let (slat, clat) = lat.sin_cos();
    let (slon, clon) = lon.sin_cos();
    let radius_km = 1737.4 + elevation_m / 1000.0;
    let site_fixed = [radius_km * clat * clon, radius_km * clat * slon, radius_km * slat];
    let site_j2000 = rotate(rotation, site_fixed);
    let observer = [moon[0] + site_j2000[0], moon[1] + site_j2000[1], moon[2] + site_j2000[2]];
    let east = rotate(rotation, [-slon, clon, 0.0]);
    let north = rotate(rotation, [-slat * clon, -slat * slon, clat]);
    let up = rotate(rotation, [clat * clon, clat * slon, slat]);

    let sun_local = sub(sun, observer);
    let earth_local = sub(earth, observer);
    let sun_east = dot(sun_local, east); let sun_north = dot(sun_local, north); let sun_up = dot(sun_local, up);
    let earth_east = dot(earth_local, east); let earth_north = dot(earth_local, north); let earth_up = dot(earth_local, up);
    let sun_az = sun_east.atan2(sun_north).to_degrees().rem_euclid(360.0);
    let sun_el = sun_up.atan2(sun_east.hypot(sun_north)).to_degrees();
    let earth_az = earth_east.atan2(earth_north).to_degrees().rem_euclid(360.0);
    let earth_el = earth_up.atan2(earth_east.hypot(earth_north)).to_degrees();
    [sun_az, sun_el, earth_az, earth_el]
}

/// Integrate a DE421 initial state with a kick-drift-kick scheme and
/// output [sunAz,sunEl,earthAz,earthEl] for each sample time. `moon_offsets_km`
/// and `earth_offsets_km` are Moon/Earth centers relative to the Earth-Moon
/// barycenter in J2000; `moon_to_j2000` is a row-major 3x3 orientation matrix
/// per sample. These geometry arrays are baked from the unmodified DE421 PCK.
pub fn propagate_site_ephemeris(
    initial_states: &[f64], gm_input: &[f64], sample_times_et: &[f64],
    moon_offsets_km: &[f64], earth_offsets_km: &[f64], moon_to_j2000: &[f64],
    latitude_deg: f64, east_longitude_deg: f64, elevation_m: f64,
    output: &mut Vec<f32>,
) -> Result<(), GravityError> {
    let sample_count = validate(initial_states, gm_input, sample_times_et, moon_offsets_km, earth_offsets_km, moon_to_j2000)?;
    if ![latitude_deg, east_longitude_deg, elevation_m].iter().all(|x| x.is_finite())
        || !(-90.0..=90.0).contains(&latitude_deg) { return Err(GravityError::InvalidInput); }
    let mu = body_gms(gm_input);
    let mut state = [[0.0; STATE_WIDTH]; DYNAMIC_BODY_COUNT];
    for (i, row) in state.iter_mut().enumerate() {
        row.copy_from_slice(&initial_states[i * STATE_WIDTH..(i + 1) * STATE_WIDTH]);
    }
    output.clear();
    output.reserve(sample_count * 4);
    for sample in 0..sample_count {
        let pos = std::array::from_fn(|i| [state[i][0], state[i][1], state[i][2]]);
        let mo = [moon_offsets_km[sample * 3], moon_offsets_km[sample * 3 + 1], moon_offsets_km[sample * 3 + 2]];
        let eo = [earth_offsets_km[sample * 3], earth_offsets_km[sample * 3 + 1], earth_offsets_km[sample * 3 + 2]];
        let angles = angles_for_site(&state, mo, eo, &moon_to_j2000[sample * 9..sample * 9 + 9], latitude_deg, east_longitude_deg, elevation_m);
        output.extend(angles.into_iter().map(|v| v as f32));
        if sample + 1 == sample_count { break; }

        let dt = sample_times_et[sample + 1] - sample_times_et[sample];
        let half_dt = dt * 0.5;
        let a0 = accelerations(&pos, &mu)?;
        for i in 0..DYNAMIC_BODY_COUNT {
            for axis in 0..3 {
                state[i][axis + 3] += a0[i][axis] * half_dt;
                state[i][axis] += state[i][axis + 3] * dt;
            }
        }
        let pos1 = std::array::from_fn(|i| [state[i][0], state[i][1], state[i][2]]);
        let a1 = accelerations(&pos1, &mu)?;
        for i in 0..DYNAMIC_BODY_COUNT {
            for axis in 0..3 { state[i][axis + 3] += a1[i][axis] * half_dt; }
        }
    }
    Ok(())
}
