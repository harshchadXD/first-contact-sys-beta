import React from 'react';
import type {
  LaunchSlipDay,
  SolverConstraints,
  TimeSeriesPoint,
} from '../science/types';

interface LaunchSlipMatrixProps {
  launchSlip30d: LaunchSlipDay[];
  timeSeries: TimeSeriesPoint[];
  activeHourIndex: number;
  constraints: SolverConstraints;
  onSelectEpochSlip: (slipDays: number) => void;
  onSelectHour: (hour: number) => void;
}

const VIABILITY_COLORS: Record<
  LaunchSlipDay['viability'],
  { bg: string; border: string; label: string; text: string }
> = {
  OPTIMAL: {
    bg: 'bg-[#ECFDF5] hover:bg-[#D1FAE5]',
    border: 'border-[#6EE7B7]',
    label: 'OPT',
    text: 'text-[#047857]',
  },
  MARGINAL: {
    bg: 'bg-[#FFFBEB] hover:bg-[#FEF3C7]',
    border: 'border-[#FCD34D]',
    label: 'MRG',
    text: 'text-[#B45309]',
  },
  CRITICAL: {
    bg: 'bg-[#FFF1F2] hover:bg-[#FFE4E6]',
    border: 'border-[#FDA4AF]',
    label: 'CRT',
    text: 'text-[#BE123C]',
  },
};

export const LaunchSlipMatrix: React.FC<LaunchSlipMatrixProps> = ({
  launchSlip30d,
  timeSeries,
  activeHourIndex,
  constraints,
  onSelectEpochSlip,
  onSelectHour,
}) => {
  const optimalDays = launchSlip30d.filter((d) => d.viability === 'OPTIMAL').length;

  // Build SVG polylines for Battery SoC (0..100%) and Surface Temp (25..400K)
  const chartW = 640;
  const chartH = 156;
  const padL = 36;
  const padR = 38;
  const padT = 14;
  const padB = 22;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const maxIdx = Math.max(1, timeSeries.length - 1);

  const socPoints = timeSeries
    .map((pt, i) => {
      const x = padL + (i / maxIdx) * innerW;
      const y = padT + (1 - pt.batterySocPct / 100) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const socAreaPoints = `${padL.toFixed(1)},${(padT + innerH).toFixed(1)} ${socPoints} ${(padL + innerW).toFixed(1)},${(padT + innerH).toFixed(1)}`;

  const tempPoints = timeSeries
    .map((pt, i) => {
      const x = padL + (i / maxIdx) * innerW;
      const normT = Math.max(0, Math.min(1, (pt.surfaceTempK - 20) / 380));
      const y = padT + (1 - normT) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const activePt = timeSeries[activeHourIndex] ?? timeSeries[0];
  const cursorX = padL + (activeHourIndex / maxIdx) * innerW;
  const activeSocY = padT + (1 - (activePt?.batterySocPct ?? 100) / 100) * innerH;
  const activeTempNorm = Math.max(0, Math.min(1, ((activePt?.surfaceTempK ?? 290) - 20) / 380));
  const activeTempY = padT + (1 - activeTempNorm) * innerH;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * chartW;
    const ratio = Math.max(0, Math.min(1, (clickX - padL) / innerW));
    onSelectHour(Math.round(ratio * maxIdx));
  };

  return (
    <section
      aria-label="30-Day Launch Slip Solver and Battery Cryogenic Telemetry"
      className="bg-white border border-[#DCE5F2] rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 flex flex-col justify-between gap-4"
    >
      {/* Part 1: 30-Day Inverse Launch-Slip Matrix */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Inverse 30-Day Launch-Slip Viability Matrix
            </h2>
            <p className="text-[11px] text-[#64748B]">
              Scans arrival scrub days (+0d to +29d) against {constraints.maxDarknessHrs}h darkness & {constraints.minCommsWindowHrs}h comms thresholds
            </p>
          </div>
          <span className="text-[11px] font-mono tabular-nums font-semibold text-[#059669]">
            {optimalDays} / 30 Optimal Windows
          </span>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
          {launchSlip30d.map((day) => {
            const style = VIABILITY_COLORS[day.viability];
            const isSelected = day.slipDays === constraints.epochOffsetDays;
            return (
              <button
                key={day.slipDays}
                type="button"
                onClick={() => onSelectEpochSlip(day.slipDays)}
                aria-pressed={isSelected}
                aria-label={`Launch slip day +${day.slipDays}: ${day.viability}, sun ${day.pSunPct}%, max darkness ${day.longestDarknessHrs}h`}
                className={`px-2 py-1.5 rounded-lg border text-left transition-all focus-visible:outline-2 focus-visible:outline-[#0284C7] ${
                  style.bg
                } ${
                  isSelected
                    ? 'border-[#2563EB] ring-2 ring-[#2563EB]/75 shadow-sm'
                    : style.border
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono tabular-nums">
                  <span className="text-[#334155] font-semibold">+{day.slipDays}d</span>
                  <span className={`font-semibold ${style.text}`}>{style.label}</span>
                </div>
                <div className="text-[10px] font-mono tabular-nums text-[#475569]">
                  {day.pSunPct.toFixed(0)}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Part 2: Battery state of charge and modeled surface temperature */}
      <div className="pt-4 border-t border-[#E8EEF6]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <h3 className="text-xs font-semibold text-[#0F172A]">
            Battery State-of-Charge (%) & Modeled Surface Temperature (K)
          </h3>
          <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums font-semibold">
            <span className="text-[#0284C7]">— Battery SoC</span>
            <span className="text-[#D97706]">— Surface Temp (27K–392K)</span>
          </div>
        </div>

        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2.5">
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            onClick={handleSvgClick}
            className="w-full h-36 cursor-pointer"
            role="img"
            aria-label="Battery state of charge and modeled surface radiative temperature over the mission timeline"
          >
            <defs>
              <linearGradient id="socAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284C7" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Gridlines */}
            {[0, 25, 50, 75, 100].map((pct) => {
              const y = padT + (1 - pct / 100) * innerH;
              return (
                <g key={pct}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={padL + innerW}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeWidth="1"
                  />
                  <text
                    x="4"
                    y={y + 3}
                    fill="#64748B"
                    fontSize="9.5"
                    fontFamily="Mono, monospace"
                  >
                    {pct}%
                  </text>
                  <text
                    x={chartW - 34}
                    y={y + 3}
                    fill="#64748B"
                    fontSize="9.5"
                    fontFamily="Mono, monospace"
                  >
                    {Math.round(20 + (pct / 100) * 380)}K
                  </text>
                </g>
              );
            })}

            {/* Battery SoC Soft Area Fill */}
            <polygon fill="url(#socAreaGrad)" points={socAreaPoints} />

            {/* Surface Temp Curve */}
            <polyline
              fill="none"
              stroke="#D97706"
              strokeWidth="2"
              strokeOpacity="0.9"
              points={tempPoints}
            />

            {/* Battery SoC Curve */}
            <polyline
              fill="none"
              stroke="#0284C7"
              strokeWidth="2.4"
              points={socPoints}
            />

            {/* Active Scrubber Time Marker */}
            <line
              x1={cursorX}
              y1={padT}
              x2={cursorX}
              y2={padT + innerH}
              stroke="#0F172A"
              strokeWidth="1.2"
              strokeDasharray="3 2"
            />
            <circle cx={cursorX} cy={activeSocY} r="3.5" fill="#0284C7" stroke="#FFFFFF" strokeWidth="1.5" />
            <circle cx={cursorX} cy={activeTempY} r="3.5" fill="#D97706" stroke="#FFFFFF" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
    </section>
  );
};
