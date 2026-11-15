//! MOON_ME topocentric coordinate conversion.
//!
//! Coordinate convention: +X is 0° east longitude, +Y is 90° east, +Z is
//! north. Azimuth is degrees clockwise from local north; elevation is degrees
//! above the local tangent plane. Input positions are Moon-centered.

use std::fmt;

pub const MOON_ME_RADIUS_KM: f64 = 1_737.4;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Body {
    pub position_km: [f64; 3],
}

impl Body {
    pub const fn new(x_km: f64, y_km: f64, z_km: f64) -> Self {
        Self { position_km: [x_km, y_km, z_km] }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Site {
    pub latitude_deg: f64,
    pub east_longitude_deg: f64,
    pub elevation_m: f64,
}

impl Site {
    pub const fn new(latitude_deg: f64, east_longitude_deg: f64, elevation_m: f64) -> Self {
        Self { latitude_deg, east_longitude_deg, elevation_m }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Topocentric {
    pub azimuth_deg: f64,
    pub elevation_deg: f64,
    pub range_km: f64,
}

/// Evaluate a single DE-style Chebyshev coordinate series on its normalized
/// interval `tau ∈ [-1, 1]`. Coefficients use the standard T₀, T₁, … basis.
pub fn evaluate_chebyshev(coefficients: &[f64], tau: f64) -> Result<f64, EphemerisError> {
    if coefficients.is_empty() || !tau.is_finite() || !coefficients.iter().all(|v| v.is_finite()) {
        return Err(EphemerisError::InvalidCoordinate);
    }
    // Clenshaw recurrence, stable and O(n), including at interval endpoints.
    let mut b1 = 0.0;
    let mut b2 = 0.0;
    for &coefficient in coefficients.iter().rev() {
        let b0 = 2.0 * tau * b1 - b2 + coefficient;
        b2 = b1;
        b1 = b0;
    }
    Ok(b1 - tau * b2)
}

/// Evaluate Moon-centered body position from three pre-tabulated DE421
/// Chebyshev coordinate series. The caller selects the correct SPK segment
/// and maps time to `tau`; output units follow the coefficients (normally km).
pub fn position_from_chebyshev(
    x_coefficients: &[f64],
    y_coefficients: &[f64],
    z_coefficients: &[f64],
    tau: f64,
) -> Result<Body, EphemerisError> {
    Ok(Body::new(
        evaluate_chebyshev(x_coefficients, tau)?,
        evaluate_chebyshev(y_coefficients, tau)?,
        evaluate_chebyshev(z_coefficients, tau)?,
    ))
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum EphemerisError {
    InvalidCoordinate,
    BodyAtObserver,
}

impl fmt::Display for EphemerisError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidCoordinate => write!(f, "coordinates must be finite; latitude must be in [-90, 90]"),
            Self::BodyAtObserver => write!(f, "body position coincides with the observer"),
        }
    }
}

impl std::error::Error for EphemerisError {}

/// Transform a Moon-centered MOON_ME position into topocentric azimuth,
/// elevation, and range. The Moon is modelled as a sphere of radius 1737.4 km.
pub fn topocentric_alt_az(body: Body, site: Site) -> Result<Topocentric, EphemerisError> {
    let [x, y, z] = body.position_km;
    let lat = site.latitude_deg;
    let lon = site.east_longitude_deg;
    let elev = site.elevation_m;
    if ![x, y, z, lat, lon, elev].iter().all(|v| v.is_finite()) || !(-90.0..=90.0).contains(&lat) {
        return Err(EphemerisError::InvalidCoordinate);
    }

    let (sin_lat, cos_lat) = lat.to_radians().sin_cos();
    let (sin_lon, cos_lon) = lon.to_radians().sin_cos();
    let observer_radius = MOON_ME_RADIUS_KM + elev / 1000.0;
    let observer = [observer_radius * cos_lat * cos_lon,
                    observer_radius * cos_lat * sin_lon,
                    observer_radius * sin_lat];
    let dx = x - observer[0];
    let dy = y - observer[1];
    let dz = z - observer[2];
    let range = dx.hypot(dy).hypot(dz);
    if range == 0.0 { return Err(EphemerisError::BodyAtObserver); }

    // Local east, north, up basis at the observer.
    let east = -sin_lon * dx + cos_lon * dy;
    let north = -sin_lat * cos_lon * dx - sin_lat * sin_lon * dy + cos_lat * dz;
    let up = cos_lat * cos_lon * dx + cos_lat * sin_lon * dy + sin_lat * dz;
    let azimuth_deg = east.atan2(north).to_degrees().rem_euclid(360.0);
    let elevation_deg = up.atan2(east.hypot(north)).to_degrees();
    Ok(Topocentric { azimuth_deg, elevation_deg, range_km: range })
}
