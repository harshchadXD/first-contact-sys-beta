import { useState } from "react";
import { skylineAt, recordedSkyTrack } from "../services/worldGeometry";

type Body = { az: number; el: number };
type Props = {
  azimuths: number[];
  active: number[];
  ground: number[];
  sun: Body;
  earth: Body;
  sunAz: number[];
  sunEl: number[];
  earthAz: number[];
  earthEl: number[];
};

/** Angular tracks use the selected recorded window; they are not an invented libration loop. */
export default function HorizonOscilloscope(p: Props) {
  const [probe, setProbe] = useState(0);
  const min =
    Math.min(-4, ...p.active, ...p.ground, ...p.sunEl, ...p.earthEl) - 1;
  const max =
    Math.max(4, ...p.active, ...p.ground, ...p.sunEl, ...p.earthEl) + 1;
  const x = (az: number) => 38 + (az / 360) * 374;
  const y = (el: number) => 232 - ((el - min) / (max - min)) * 212;
  const track = (az: number[], el: number[]) => recordedSkyTrack(az, el, x, y);
  const active = skylineAt(probe, p.azimuths, p.active);
  const ground = skylineAt(probe, p.azimuths, p.ground);
  return (
    <div className="oscilloscope">
      <svg
        viewBox="0 0 450 268"
        role="img"
        aria-label="Terrain skyline and recorded Sun and Earth tracks for the selected window"
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setProbe(
            Math.max(
              0,
              Math.min(
                360,
                ((((event.clientX - bounds.left) / bounds.width) * 450 - 38) /
                  374) *
                  360,
              ),
            ),
          );
        }}
      >
        <defs>
          <linearGradient id="skyline-fill" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#62bac4" stopOpacity=".2" />
            <stop offset="1" stopColor="#62bac4" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4).map(
          (v) => (
            <g key={v}>
              <line
                x1="38"
                x2="412"
                y1={y(v)}
                y2={y(v)}
                className="chart-rule"
              />
              <text x="30" y={y(v) + 3} textAnchor="end">
                {v.toFixed(0)}°
              </text>
            </g>
          ),
        )}
        {[0, 90, 180, 270, 360].map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1="20" y2="232" className="chart-rule" />
            <text x={x(v)} y="253" textAnchor="middle">
              {v}°
            </text>
          </g>
        ))}
        <path
          d={`${track(p.azimuths, p.active)} L412,${y(p.active[0])} L412,232 L38,232 Z`}
          fill="url(#skyline-fill)"
        />
        <path
          d={track(p.azimuths, p.ground)}
          fill="none"
          stroke="#7d94a7"
          strokeDasharray="4 4"
        />
        <path
          d={track(p.azimuths, p.active)}
          fill="none"
          stroke="#85d7de"
          strokeWidth="1.5"
        />
        <path
          d={track(p.sunAz, p.sunEl)}
          fill="none"
          stroke="#e3b975"
          strokeWidth="1"
          opacity=".65"
        />
        <path
          d={track(p.earthAz, p.earthEl)}
          fill="none"
          stroke="#69bed4"
          strokeWidth="1"
          opacity=".65"
        />
        <circle cx={x(p.sun.az)} cy={y(p.sun.el)} r="4" fill="#f5cd83" />
        <g
          transform={`translate(${x(p.earth.az)},${y(p.earth.el)})`}
          stroke="#83d9e7"
          fill="none"
        >
          <circle r="4" />
          <path d="M-7 0H7M0-7V7" />
        </g>
        <line
          x1={x(probe)}
          x2={x(probe)}
          y1="20"
          y2="232"
          className="probe-crosshair"
        />
        <circle cx={x(probe)} cy={y(active)} r="3" fill="#def5f0" />
      </svg>
      <label className="skyline-probe">
        Probe azimuth
        <input
          type="range"
          min="0"
          max="360"
          step=".5"
          value={probe}
          onChange={(event) => setProbe(Number(event.target.value))}
        />
      </label>
      <output className="probe-readout">
        AZ {probe.toFixed(1)}° · ACTIVE {active.toFixed(2)}° · GROUND{" "}
        {ground.toFixed(2)}°<br />
        Height clearance gain {(ground - active).toFixed(2)}°
      </output>
      <p className="panel-note">
        Tracks cover the selected stay. Earth-centre clearance{" "}
        {(p.earth.el - skylineAt(p.earth.az, p.azimuths, p.active)).toFixed(2)}°
        is geometric, not a radio link margin.
      </p>
    </div>
  );
}
