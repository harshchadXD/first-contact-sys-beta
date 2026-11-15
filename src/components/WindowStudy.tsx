import { useEffect, useMemo, useRef, useState } from 'react';
import { getSiteById, getSpacecraftById } from '../science/lunarData';
import { runSiteAnalysis } from '../science/physicsEngine';
import type { SolverConstraints } from '../science/types';

const STUDY_SITES = ['PGDA-01', 'PGDA-11', 'PGDA-04'];

const BASE_CONSTRAINTS: SolverConstraints = {
  maxDarknessHrs: 24,
  minCommsWindowHrs: 6,
  mastHeightM: 3,
  missionDurationDays: 14,
  epochOffsetDays: 16,
};

const WEIGHTS = { sun: 0.45, earth: 0.35, terrain: 0.2 };

/** Split a polyline whenever azimuth wraps or jumps across the plot. */
function pathFromSamples(
  samples: Array<{ az: number; el: number }>,
  azToX: (az: number) => number,
  elToY: (el: number) => number
): string {
  let path = '';
  let previous = -999;
  samples.forEach((sample, index) => {
    const x = azToX(sample.az);
    const y = elToY(sample.el);
    const jump = Math.abs(sample.az - previous);
    if (index === 0 || jump > 45) path += ` M ${x.toFixed(1)} ${y.toFixed(1)}`;
    else path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    previous = sample.az;
  });
  return path.trim();
}

export function WindowStudy() {
  const [siteId, setSiteId] = useState(STUDY_SITES[0]);
  const [height, setHeight] = useState(3);
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(1600);
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    const measure = () => {
      const next = Math.max(320, Math.round(node.clientWidth));
      setCanvasWidth((previous) => (Math.abs(previous - next) > 1 ? next : previous));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.12 }
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
    }, 130);
    return () => window.clearInterval(id);
  }, [playing, inView, analysis.timeSeries.length]);

  const point = analysis.timeSeries[Math.min(hour, analysis.timeSeries.length - 1)] ?? analysis.timeSeries[0];

  // Stage geometry: the viewBox tracks the rendered container so the panorama
  // never letterboxes at any viewport width, including phones.
  const width = canvasWidth;
  const heightPx =
    width < 700
      ? Math.round(Math.max(340, Math.min(520, width * 0.9)))
      : Math.round(Math.max(460, Math.min(690, width * 0.44)));
  const padL = width < 700 ? 46 : 74;
  const padR = width < 700 ? 24 : 46;
  const padT = 48;
  const padB = 62;
  const plotW = width - padL - padR;
  const plotH = heightPx - padT - padB;

  const horizon = analysis.adjustedHorizonDeg;
  const sunElevations = analysis.timeSeries.map((sample) => sample.sunElDeg);
  const minEl = Math.floor(Math.min(-5, ...horizon, ...sunElevations) - 1);
  const maxEl = Math.ceil(Math.max(7, ...horizon, ...sunElevations) + 2);
  const azToX = (az: number) => padL + (az / 360) * plotW;
  const elToY = (el: number) => padT + ((maxEl - el) / (maxEl - minEl)) * plotH;

  const horizonLine = useMemo(() => {
    let path = `M ${azToX(0)} ${elToY(horizon[0])}`;
    for (let az = 1; az <= 360; az++) {
      path += ` L ${azToX(az)} ${elToY(horizon[az % 360])}`;
    }
    return path;
  }, [horizon, minEl, maxEl, width, heightPx]);

  const horizonFill = `${horizonLine} L ${azToX(360)} ${padT + plotH} L ${azToX(0)} ${padT + plotH} Z`;

  const sunPath = useMemo(
    () =>
      pathFromSamples(
        analysis.timeSeries.map((sample) => ({ az: sample.sunAzDeg, el: sample.sunElDeg })),
        azToX,
        elToY
      ),
    [analysis.timeSeries, minEl, maxEl, width, heightPx]
  );

  const earthPath = useMemo(
    () =>
      pathFromSamples(
        analysis.timeSeries.map((sample) => ({ az: sample.earthAzDeg, el: sample.earthElDeg })),
        azToX,
        elToY
      ),
    [analysis.timeSeries, minEl, maxEl, width, heightPx]
  );

  const altitudeTicks = useMemo(() => {
    const values: number[] = [];
    for (let value = Math.ceil(minEl / 4) * 4; value <= maxEl; value += 4) values.push(value);
    return values;
  }, [minEl, maxEl]);

  const stars = useMemo(
    () =>
      Array.from({ length: 64 }, (_, index) => ({
        x: 20 + (((index * 233) % 1560) / 1560) * (width - 40),
        y: 16 + (((index * 97) % 360) / 360) * (heightPx * 0.62),
        r: index % 7 === 0 ? 1.25 : 0.7,
        o: 0.25 + ((index * 13) % 50) / 100,
      })),
    [width, heightPx]
  );

  const scenario = SITE_COPY[siteId] ?? SITE_COPY['PGDA-01'];
  const startDate = new Date(point.timestampUtc);
  const dayNumber = Math.floor(hour / 24) + 1;
  const hourNumber = hour % 24;
  const sunLow = analysis.summary.pSunPct < 50;
  const darkRisk = analysis.summary.longestDarknessHrs > BASE_CONSTRAINTS.maxDarknessHrs;

  return (
    <section className="sunline" id="method" ref={sectionRef} aria-labelledby="study-title">
      <div className="sunline-head">
        <div>
          <p className="eyebrow">02 / The instrument</p>
          <h2 id="study-title">
            The horizon
            <br />
            is a clock.
          </h2>
        </div>
        <div className="sunline-intro">
          <p>
            A landing site is not only a coordinate. It is a place where the sky is cut by
            terrain. Move the site, the observer height, or the hour and the window changes.
          </p>
          <span className="study-live">
            <i aria-hidden="true" /> Real LOLA horizon · baked JPL DE421 · computed locally
          </span>
        </div>
      </div>

      <div className="sunline-controls">
        <div className="sunline-sites" role="group" aria-label="Choose a landing site">
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
                <em>{Math.abs(item.metadata.latDeg).toFixed(1)}°S</em>
              </button>
            );
          })}
        </div>

        <div className="sunline-height">
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

      <figure className="sunline-stage">
        <div className="sunline-canvas" ref={canvasRef}>
          <svg
            viewBox={`0 0 ${width} ${heightPx}`}
            style={{ height: heightPx }}
            role="img"
            aria-label={`Horizon panorama at ${scenario.title}. Sun visible ${analysis.summary.pSunPct.toFixed(1)} percent; Earth visible ${analysis.summary.pEarthPct.toFixed(1)} percent; longest darkness ${analysis.summary.longestDarknessHrs} hours.`}
            onPointerMove={(event) => {
              if (event.pointerType !== 'mouse') return;
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
              <linearGradient id="sunline-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#07090f" />
                <stop offset="62%" stopColor="#0b0d11" />
                <stop offset="100%" stopColor="#12110d" />
              </linearGradient>
              <linearGradient id="sunline-terrain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#35362f" />
                <stop offset="58%" stopColor="#1b1c18" />
                <stop offset="100%" stopColor="#0a0b09" />
              </linearGradient>
              <radialGradient id="sunline-sun-glow">
                <stop offset="0%" stopColor="#fff1d2" />
                <stop offset="35%" stopColor="#f3b66a" />
                <stop offset="100%" stopColor="#d88a3d" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="sunline-horizon-glow" cx="50%" cy="50%">
                <stop offset="0%" stopColor="#e9a85c" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#e9a85c" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="sunline-sunline" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#d9954d" />
                <stop offset="50%" stopColor="#ffd9a2" />
                <stop offset="100%" stopColor="#d9954d" />
              </linearGradient>
            </defs>

            <rect width={width} height={heightPx} fill="url(#sunline-sky)" />
            {stars.map((star, index) => (
              <circle
                key={index}
                cx={star.x}
                cy={star.y}
                r={star.r}
                fill="#e8e2d4"
                opacity={star.o}
              />
            ))}

            {/* Altitude grid and labels */}
            {altitudeTicks.map((value) => (
              <g key={value}>
                <line
                  x1={padL}
                  x2={padL + plotW}
                  y1={elToY(value)}
                  y2={elToY(value)}
                  stroke="rgba(236,231,218,0.10)"
                  strokeWidth={value === 0 ? 1 : 0.6}
                  strokeDasharray={value === 0 ? '3 6' : undefined}
                />
                <text x={padL - 14} y={elToY(value) + 3.5} textAnchor="end" className="sunline-tick">
                  {value > 0 ? `+${value}°` : `${value}°`}
                </text>
              </g>
            ))}

            {/* Azimuth ticks */}
            {[0, 45, 90, 135, 180, 225, 270, 315, 360].map((value) => (
              <g key={value}>
                <line
                  x1={azToX(value)}
                  x2={azToX(value)}
                  y1={padT}
                  y2={padT + plotH}
                  stroke="rgba(236,231,218,0.055)"
                />
                <text x={azToX(value)} y={heightPx - 24} textAnchor="middle" className="sunline-tick">
                  {value === 0 ? 'N' : value === 90 ? 'E' : value === 180 ? 'S' : value === 270 ? 'W' : value === 360 ? 'N' : `${value}°`}
                </text>
              </g>
            ))}

            {/* Warm glow where the Sun grazes the skyline */}
            <ellipse
              cx={azToX(point.sunAzDeg)}
              cy={elToY(Math.max(horizon[Math.floor(point.sunAzDeg) % 360], point.sunElDeg))}
              rx={190}
              ry={130}
              fill="url(#sunline-horizon-glow)"
            />

            <path d={horizonFill} fill="url(#sunline-terrain)" />
            <path d={horizonLine} fill="none" stroke="#b8b2a2" strokeWidth="1.6" />
            <path d={earthPath} fill="none" stroke="#7fa9bb" strokeWidth="1.4" strokeDasharray="4 6" opacity="0.55" />
            <path d={sunPath} fill="none" stroke="url(#sunline-sunline)" strokeWidth="2.4" strokeLinecap="round" />

            <line
              x1={azToX(point.sunAzDeg)}
              x2={azToX(point.sunAzDeg)}
              y1={padT}
              y2={padT + plotH}
              stroke="rgba(255,210,150,0.32)"
              strokeDasharray="2 6"
            />

            <g transform={`translate(${azToX(point.sunAzDeg)} ${elToY(point.sunElDeg)})`}>
              <circle r="34" fill="url(#sunline-sun-glow)" opacity="0.65" />
              <circle r="7.5" fill="#ffe4b8" />
              <circle r="12" fill="none" stroke="rgba(255,228,184,0.55)" strokeWidth="1" />
            </g>

            <g transform={`translate(${azToX(point.earthAzDeg)} ${elToY(point.earthElDeg)})`}>
              <circle
                r="9"
                fill="none"
                stroke={point.earthVisible ? '#9cc6d6' : '#c86b55'}
                strokeWidth="1.5"
              />
              <circle r="3" fill={point.earthVisible ? '#9cc6d6' : '#c86b55'} />
            </g>

            <g className="sunline-labels">
              <text x={padL + 14} y={padT + 20} fill="#dca76a">
                SUN TRACK · 14 DAYS
              </text>
              <text x={padL + 14} y={padT + 38} fill="#7fa9bb">
                EARTH TRACK · 14 DAYS
              </text>
              <text x={padL + plotW - 14} y={padT + 20} textAnchor="end" fill="#b8b2a2">
                {scenario.label}
              </text>
            </g>
          </svg>
        </div>

        <div className="sunline-hud" aria-live="polite">
          <div>
            <span>Sun visible</span>
            <strong className={sunLow ? 'is-low' : undefined}>
              {analysis.summary.pSunPct.toFixed(1)}
              <small>%</small>
            </strong>
          </div>
          <div>
            <span>Earth visible</span>
            <strong>
              {analysis.summary.pEarthPct.toFixed(1)}
              <small>%</small>
            </strong>
          </div>
          <div>
            <span>Longest dark</span>
            <strong className={darkRisk ? 'is-low' : undefined}>
              {analysis.summary.longestDarknessHrs.toFixed(0)}
              <small>h</small>
            </strong>
          </div>
          <div className="sunline-clock">
            <span>Day {dayNumber} · {String(hourNumber).padStart(2, '0')}:00 UTC</span>
            <strong>
              {startDate.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              })}
            </strong>
          </div>
        </div>

        <figcaption>
          <span>{scenario.title}</span>
          <span>
            Sun {point.sunFraction > 0.01 ? 'above' : 'below'} skyline · Earth{' '}
            {point.earthVisible ? 'in geometric view' : 'occulted'} · mast {height.toFixed(1)} m
          </span>
        </figcaption>
      </figure>

      <div className="sunline-mission">
        <div className="sunline-mission-head">
          <span className="micro-label">14-day surface stay · hourly illumination bands</span>
          <span className="sunline-legend">
            <i className="is-both" /> Sun + Earth
            <i className="is-sun" /> Sun only
            <i className="is-earth" /> Earth only
            <i className="is-dark" /> Dark
          </span>
        </div>
        <div
          className="sunline-strip"
          role="slider"
          tabIndex={0}
          aria-label="Mission hour"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, analysis.timeSeries.length - 1)}
          aria-valuenow={hour}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              setPlaying(false);
              setHour((value) => Math.min(analysis.timeSeries.length - 1, value + 1));
            } else if (event.key === 'ArrowLeft') {
              setPlaying(false);
              setHour((value) => Math.max(0, value - 1));
            } else if (event.key === 'Home') {
              event.preventDefault();
              setPlaying(false);
              setHour(0);
            } else if (event.key === 'End') {
              event.preventDefault();
              setPlaying(false);
              setHour(Math.max(0, analysis.timeSeries.length - 1));
            }
          }}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = Math.min(0.999, Math.max(0, (event.clientX - rect.left) / rect.width));
            setPlaying(false);
            setHour(Math.round(ratio * (analysis.timeSeries.length - 1)));
          }}
        >
          {analysis.timeSeries.map((sample, index) => {
            const both = sample.sunFraction > 0.01 && sample.earthVisible;
            const sun = sample.sunFraction > 0.01;
            const earth = sample.earthVisible;
            return (
              <i
                key={index}
                className={
                  both ? 'is-both' : sun ? 'is-sun' : earth ? 'is-earth' : 'is-dark'
                }
              />
            );
          })}
          {Array.from({ length: 13 }, (_, index) => (
            <b
              key={`day-${index}`}
              className="sunline-day-mark"
              style={{
                left: `${(((index + 1) * 24) / Math.max(1, analysis.timeSeries.length - 1)) * 100}%`,
              }}
              aria-hidden="true"
            />
          ))}
          <b
            className="sunline-playhead"
            style={{ left: `${(hour / Math.max(1, analysis.timeSeries.length - 1)) * 100}%` }}
          />
        </div>
        <div className="sunline-mission-foot">
          <span>{new Date(analysis.timeSeries[0]?.timestampUtc ?? Date.now()).toUTCString().slice(5, 16)}</span>
          <p>{scenario.note}</p>
          <span>{new Date(analysis.timeSeries.at(-1)?.timestampUtc ?? Date.now()).toUTCString().slice(5, 16)}</span>
        </div>
      </div>
    </section>
  );
}

const SITE_COPY: Record<string, { title: string; label: string; note: string }> = {
  'PGDA-01': {
    title: 'Connecting Ridge · Artemis III candidate',
    label: 'CONNECTING RIDGE',
    note:
      'A ridge can hold the Sun for days, then hand the sky back to the terrain. This is the trade-off the explorer is built to show.',
  },
  'PGDA-11': {
    title: 'de Gerlache Rim 1 · high-persistence crest',
    label: 'DE GERLACHE RIM',
    note:
      'A low, open horizon keeps both Sun and Earth in view through this arrival window. Raise the mast and the last shadow disappears.',
  },
  'PGDA-04': {
    title: 'Shackleton Crater Rim · terrain-limited case',
    label: 'SHACKLETON RIM',
    note:
      'Near the pole, small changes in position and height can put a ridge between the observer and the sky. Compare it with the other sites.',
  },
};
