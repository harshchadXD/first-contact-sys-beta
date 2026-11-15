import { useEffect, useMemo, useRef, useState } from 'react';
import { computeEarthLibrationTrack } from '../science/ephemeris';
import { getSiteById, getSpacecraftById } from '../science/lunarData';
import { runSiteAnalysis } from '../science/physicsEngine';
import type { SolverConstraints } from '../science/types';

const STUDY_SITES = ['PGDA-01', 'PGDA-20', 'PGDA-04'];

const BASE_CONSTRAINTS: SolverConstraints = {
  maxDarknessHrs: 24,
  minCommsWindowHrs: 6,
  mastHeightM: 3,
  missionDurationDays: 14,
  epochOffsetDays: 0,
};

const WEIGHTS = { sun: 0.45, earth: 0.35, terrain: 0.2 };

export function WindowStudy() {
  const [siteId, setSiteId] = useState(STUDY_SITES[0]);
  const [height, setHeight] = useState(3);
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const site = useMemo(() => getSiteById(siteId), [siteId]);
  const analysis = useMemo(
    () =>
      runSiteAnalysis(
        site,
        getSpacecraftById('nova-c'),
        { ...BASE_CONSTRAINTS, mastHeightM: height },
        12,
        WEIGHTS
      ),
    [site, height]
  );

  const libration = useMemo(
    () => computeEarthLibrationTrack(site.metadata.latDeg, site.metadata.lonDeg, 0),
    [site.metadata.latDeg, site.metadata.lonDeg]
  );

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.18 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !inView) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id = window.setInterval(() => {
      setHour((previous) => (previous + 1) % Math.max(1, analysis.timeSeries.length));
    }, 140);
    return () => window.clearInterval(id);
  }, [playing, inView, analysis.timeSeries.length]);

  const point = analysis.timeSeries[Math.min(hour, analysis.timeSeries.length - 1)] ?? analysis.timeSeries[0];

  // Chart geometry.
  const width = 1080;
  const heightPx = 390;
  const padL = 58;
  const padR = 26;
  const padT = 30;
  const padB = 38;
  const plotW = width - padL - padR;
  const plotH = heightPx - padT - padB;
  const minEl = -4;
  const maxEl = 14;
  const azToX = (az: number) => padL + (az / 360) * plotW;
  const elToY = (el: number) => padT + ((maxEl - el) / (maxEl - minEl)) * plotH;

  const horizonPath = useMemo(() => {
    const values = analysis.adjustedHorizonDeg;
    let path = `M ${azToX(0)} ${padT + plotH} L ${azToX(0)} ${elToY(values[0])}`;
    for (let az = 1; az < 360; az += 2) {
      path += ` L ${azToX(az)} ${elToY(values[az])}`;
    }
    path += ` L ${azToX(360)} ${elToY(values[0])} L ${azToX(360)} ${padT + plotH} Z`;
    return path;
  }, [analysis.adjustedHorizonDeg]);

  const horizonLine = useMemo(() => {
    const values = analysis.adjustedHorizonDeg;
    let path = `M ${azToX(0)} ${elToY(values[0])}`;
    for (let az = 1; az < 360; az += 2) {
      path += ` L ${azToX(az)} ${elToY(values[az])}`;
    }
    return path;
  }, [analysis.adjustedHorizonDeg]);

  const sunPath = useMemo(() => {
    let path = '';
    let previous = -999;
    analysis.timeSeries.forEach((sample, index) => {
      const x = azToX(sample.sunAzDeg);
      const y = elToY(sample.sunElDeg);
      if (index === 0 || Math.abs(sample.sunAzDeg - previous) > 120) path += ` M ${x} ${y}`;
      else path += ` L ${x} ${y}`;
      previous = sample.sunAzDeg;
    });
    return path.trim();
  }, [analysis.timeSeries]);

  const earthPath = useMemo(() => {
    let path = '';
    let previous = -999;
    libration.forEach((sample, index) => {
      const x = azToX(sample.azDeg);
      const y = elToY(sample.elDeg);
      if (index === 0 || Math.abs(sample.azDeg - previous) > 120) path += ` M ${x} ${y}`;
      else path += ` L ${x} ${y}`;
      previous = sample.azDeg;
    });
    return path.trim();
  }, [libration]);

  const scenario = SITE_COPY[siteId] ?? SITE_COPY['PGDA-01'];

  return (
    <section className="study" id="method" ref={sectionRef} aria-labelledby="study-title">
      <div className="study-head">
        <div>
          <p className="eyebrow">02 / The instrument</p>
          <h2 id="study-title">
            The horizon
            <br />
            is a clock.
          </h2>
        </div>
        <div className="study-intro">
          <p>
            A landing site is not only a coordinate. It is a place where the sky is cut by
            terrain. Move the site, the observer height, or the hour and the window changes.
          </p>
          <span className="study-live">
            <i aria-hidden="true" /> Computed locally from the shipped horizon study
          </span>
        </div>
      </div>

      <div className="study-board">
        <div className="study-rail">
          <div className="study-group">
            <span className="micro-label">Landing site</span>
            <div className="site-switch" role="group" aria-label="Choose a landing site">
              {STUDY_SITES.map((id) => {
                const item = getSiteById(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={siteId === id}
                    onClick={() => {
                      setSiteId(id);
                      setHour(0);
                    }}
                  >
                    <span>{item.metadata.shortName}</span>
                    <em>{item.metadata.latDeg.toFixed(1)}°S</em>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="study-group">
            <label className="micro-label" htmlFor="study-height">
              Observer height <output>{height.toFixed(1)} m</output>
            </label>
            <input
              id="study-height"
              className="study-range"
              type="range"
              min={0.5}
              max={10}
              step={0.5}
              value={height}
              onChange={(event) => setHeight(Number(event.target.value))}
            />
            <div className="range-ends">
              <span>0.5 m</span>
              <span>10 m</span>
            </div>
          </div>

          <div className="study-readout">
            <div>
              <span className="micro-label">Sun visible</span>
              <strong>{analysis.summary.pSunPct.toFixed(1)}<small>%</small></strong>
            </div>
            <div>
              <span className="micro-label">Earth visible</span>
              <strong>{analysis.summary.pEarthPct.toFixed(1)}<small>%</small></strong>
            </div>
            <div>
              <span className="micro-label">Longest dark</span>
              <strong>{analysis.summary.longestDarknessHrs.toFixed(0)}<small>h</small></strong>
            </div>
          </div>

          <p className="study-note">
            {scenario.note} Named hardware profiles are illustrative assumptions, not
            certified spacecraft specifications.
          </p>
        </div>

        <figure className="study-figure">
          <div className="study-figure-head">
            <div>
              <span className="micro-label">Horizon panorama · 360°</span>
              <p>{scenario.title}</p>
            </div>
            <button
              type="button"
              className="pause-study"
              aria-pressed={!playing}
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? 'Pause sweep' : 'Play sweep'}
            </button>
          </div>
          <div className="study-canvas-wrap">
            <svg
              viewBox={`0 0 ${width} ${heightPx}`}
              role="img"
              aria-label={`Horizon profile at ${scenario.title}. Sun visible ${analysis.summary.pSunPct.toFixed(1)} percent; Earth visible ${analysis.summary.pEarthPct.toFixed(1)} percent.`}
              onPointerMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = ((event.clientX - rect.left) / rect.width) * width;
                const ratio = (x - padL) / plotW;
                if (ratio >= 0 && ratio <= 1) {
                  setPlaying(false);
                  setHour(Math.round(ratio * (analysis.timeSeries.length - 1)));
                }
              }}
              onClick={() => setPlaying((value) => !value)}
            >
              <defs>
                <linearGradient id="terrain-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3a3c35" />
                  <stop offset="100%" stopColor="#141512" />
                </linearGradient>
                <linearGradient id="sun-glow" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#c98842" />
                  <stop offset="50%" stopColor="#f0b46b" />
                  <stop offset="100%" stopColor="#c98842" />
                </linearGradient>
                <radialGradient id="sun-dot">
                  <stop offset="0%" stopColor="#fff4df" />
                  <stop offset="45%" stopColor="#efb268" />
                  <stop offset="100%" stopColor="#c98842" stopOpacity="0" />
                </radialGradient>
              </defs>

              {[-4, -2, 0, 2, 4, 6, 8, 10, 12, 14].map((value) => (
                <g key={value}>
                  <line
                    x1={padL}
                    x2={padL + plotW}
                    y1={elToY(value)}
                    y2={elToY(value)}
                    stroke="rgba(238,235,226,.12)"
                    strokeWidth={value === 0 ? 1.2 : 0.7}
                    strokeDasharray={value === 0 ? '3 5' : undefined}
                  />
                  <text x={padL - 12} y={elToY(value) + 3.5} textAnchor="end" className="chart-tick">
                    {value}°
                  </text>
                </g>
              ))}
              {[0, 45, 90, 135, 180, 225, 270, 315, 360].map((value) => (
                <g key={value}>
                  <line
                    x1={azToX(value)}
                    x2={azToX(value)}
                    y1={padT}
                    y2={padT + plotH}
                    stroke="rgba(238,235,226,.07)"
                  />
                  <text x={azToX(value)} y={heightPx - 14} textAnchor="middle" className="chart-tick">
                    {value === 0 ? 'N' : value === 90 ? 'E' : value === 180 ? 'S' : value === 270 ? 'W' : value === 360 ? 'N' : `${value}°`}
                  </text>
                </g>
              ))}

              <path d={horizonPath} fill="url(#terrain-fill)" opacity="0.96" />
              <path d={horizonLine} fill="none" stroke="#b9b4a6" strokeWidth="1.4" />
              <path d={earthPath} fill="none" stroke="#87aebe" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
              <path d={sunPath} fill="none" stroke="url(#sun-glow)" strokeWidth="2.2" strokeLinecap="round" />

              <line
                x1={azToX(point.sunAzDeg)}
                x2={azToX(point.sunAzDeg)}
                y1={padT}
                y2={padT + plotH}
                stroke="rgba(240,180,107,.34)"
                strokeDasharray="2 5"
              />

              <g transform={`translate(${azToX(point.sunAzDeg)} ${elToY(point.sunElDeg)})`}>
                <circle r="26" fill="url(#sun-dot)" opacity="0.55" />
                <circle r="6" fill="#f4c286" />
              </g>
              <g transform={`translate(${azToX(point.earthAzDeg)} ${elToY(point.earthElDeg)})`}>
                <circle
                  r="7.5"
                  fill="none"
                  stroke={point.earthVisible ? '#9cc6d6' : '#c86b55'}
                  strokeWidth="1.5"
                />
                <circle
                  r="2.6"
                  fill={point.earthVisible ? '#9cc6d6' : '#c86b55'}
                />
              </g>

              <g className="chart-labels">
                <text x={padL + 12} y={padT + 18} fill="#d9a567">
                  SUN PATH
                </text>
                <text x={padL + 12} y={padT + 34} fill="#87aebe">
                  EARTH LIBRATION
                </text>
                <text x={padL + plotW - 12} y={padT + 18} textAnchor="end" fill="#b9b4a6">
                  {scenario.label}
                </text>
              </g>
            </svg>
          </div>
          <figcaption>
            <span>
              Hour <strong>{String(hour % 24).padStart(2, '0')}:00</strong> ·{' '}
              {new Date(point.timestampUtc).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </span>
            <span>
              Sun {point.sunFraction > 0 ? 'above' : 'below'} horizon · Earth{' '}
              {point.earthVisible ? 'in view' : 'obscured'}
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

const SITE_COPY: Record<string, { title: string; label: string; note: string }> = {
  'PGDA-01': {
    title: 'Connecting Ridge, a candidate Artemis region',
    label: 'CONNECTING RIDGE',
    note:
      'A ridge can hold the Sun for days, then hand the sky back to the terrain. This is the trade-off the explorer is built to show.',
  },
  'PGDA-20': {
    title: 'Mons Mouton, a high southern plateau',
    label: 'MONS MOUTON',
    note:
      'A high, open horizon can keep both Sun and Earth in view for most of a stay. The model still depends on the assumptions you choose.',
  },
  'PGDA-04': {
    title: 'Shackleton Crater Rim, a terrain-limited case',
    label: 'SHACKLETON RIM',
    note:
      'Near the pole, small changes in position and height can put a ridge between the observer and the sky. Compare it with the other sites.',
  },
};
