import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { LUNAR_SITES } from '../science/lunarData';
import type {
  LinkBridgeState,
  PersonaMode,
  SiteAnalysisResult,
  TimeSeriesPoint,
} from '../science/types';

interface HeaderAdamBridgeProps {
  analysis: SiteAnalysisResult;
  activeHourIndex: number;
  currentPoint: TimeSeriesPoint;
  persona: PersonaMode;
  isPlaying: boolean;
  isReplayActive: boolean;
  isAudioMuted?: boolean;
  onPersonaChange: (mode: PersonaMode) => void;
  onSiteChange: (siteId: string) => void;
  onHourChange: (hour: number) => void;
  onTogglePlay: () => void;
  onToggleIm2Replay: () => void;
  onResetNominal: () => void;
  onToggleAudio?: () => void;
  onOpenFrrModal?: () => void;
  onEngageEngineeringOverride?: () => void;
}

function getBridgePalette(state: LinkBridgeState) {
  if (state === 'FRACTURED') {
    return {
      stroke: '#E11D48',
      secondary: '#F43F5E',
      label: 'LINK FRACTURED · ECLIPSE TRAP',
      textColor: 'text-[#E11D48]',
    };
  }
  if (state === 'FADING') {
    return {
      stroke: '#D97706',
      secondary: '#F59E0B',
      label: 'MARGINAL · PENUMBRA / DTE DEGRADED',
      textColor: 'text-[#B45309]',
    };
  }
  return {
    stroke: '#0284C7',
    secondary: '#D97706',
    label: 'COHERENT TELEMETRY · NOMINAL',
    textColor: 'text-[#0284C7]',
  };
}

export const HeaderAdamBridge: React.FC<HeaderAdamBridgeProps> = ({
  analysis,
  activeHourIndex,
  currentPoint,
  persona,
  isPlaying,
  isReplayActive,
  isAudioMuted = false,
  onPersonaChange,
  onSiteChange,
  onHourChange,
  onTogglePlay,
  onToggleIm2Replay,
  onResetNominal,
  onToggleAudio,
  onOpenFrrModal,
  onEngageEngineeringOverride,
}) => {
  const { site, summary, selectedCell, timeSeries } = analysis;
  const maxHour = Math.max(0, timeSeries.length - 1);
  const palette = getBridgePalette(summary.bridgeState);

  const isCriticalLoss = summary.status === 'MISSION_LOSS_TRAP';
  const dayNumber = (activeHourIndex / 24).toFixed(1);

  return (
    <div className="mission-header border-b border-[#DCE5F2] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="max-w-[1440px] mx-auto px-4 lg:px-6 h-14 flex items-center justify-between gap-6 border-b border-[#E8EEF6]">
        {/* Zone 1: Single-line Wordmark */}
        <a
          href="#top"
          className="font-display text-lg font-bold tracking-wider text-[#0F172A] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#0284C7]"
        >
          FIRST CONTACT.SYS
        </a>

        {/* Zone 2: 4 Single-line Navigation Links */}
        <nav
          aria-label="Workspace sections"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#475569]"
        >
          <a
            href="#terrain-horizon"
            className="hover:text-[#0F172A] hover:underline underline-offset-4 decoration-[#0284C7] transition-colors whitespace-nowrap shrink-0"
          >
            Terrain & Horizon
          </a>
          <a
            href="#dispersion-slip"
            className="hover:text-[#0F172A] hover:underline underline-offset-4 decoration-[#0284C7] transition-colors whitespace-nowrap shrink-0"
          >
            Dispersion & Slip
          </a>
          <a
            href="#pareto-ranking"
            className="hover:text-[#0F172A] hover:underline underline-offset-4 decoration-[#0284C7] transition-colors whitespace-nowrap shrink-0"
          >
            Pareto Solver
          </a>
          <a
            href="#provenance"
            className="hover:text-[#0F172A] hover:underline underline-offset-4 decoration-[#0284C7] transition-colors whitespace-nowrap shrink-0"
          >
            Methodology
          </a>
        </nav>

        {/* Zone 3: Primary CTA & Scientific Telemetry Utilities */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Quindar Audio Synthesizer Toggle */}
          <button
            type="button"
            onClick={onToggleAudio}
            className={`h-8 px-2.5 flex items-center gap-1.5 text-xs font-mono font-medium rounded-lg border transition-all ${
              isAudioMuted
                ? 'bg-slate-100 border-slate-300 text-slate-500 hover:text-slate-700'
                : 'bg-cyan-50 border-cyan-300 text-cyan-800 hover:bg-cyan-100 shadow-2xs'
            }`}
            title="Toggle Apollo Quindar Comms Tones & Cold Trap Telemetry Audio"
          >
            {isAudioMuted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-cyan-600" />
            )}
            <span className="hidden sm:inline">Quindar {isAudioMuted ? 'Off' : 'On'}</span>
          </button>

          {/* NASA Flight Readiness Review (FRR) Dossier Trigger */}
          <button
            type="button"
            onClick={onOpenFrrModal}
            className="h-8 px-2.5 flex items-center gap-1.5 text-xs font-mono font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all"
            title="Open NASA Flight Readiness Review (FRR) Dossier"
          >
            <FileCheck className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">FRR Dossier</span>
          </button>

          {/* IM-2 Replay / Reset Button */}
          <button
            type="button"
            onClick={isReplayActive ? onResetNominal : onToggleIm2Replay}
            className={`h-8 px-3 text-xs font-semibold rounded-lg border shadow-2xs transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7] ${
              isReplayActive
                ? 'bg-[#EBF3FF] border-[#93C5FD] text-[#1D4ED8] hover:bg-[#DBEAFE]'
                : 'bg-[#FFF1F2] border-[#FDA4AF] text-[#BE123C] hover:bg-[#FFE4E6]'
            }`}
          >
            {isReplayActive ? 'Reset Nominal' : 'IM-2 Replay'}
          </button>
        </div>
      </header>

      {/* Creation of Adam Telemetry Bridge + Command Bar */}
      <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-3.5 flex flex-col gap-3.5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Left: Site & Persona Controls */}
          <div className="lg:col-span-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <label
                htmlFor="site-selector"
                className="block text-[11px] font-medium text-[#475569] mb-1"
              >
                Landing Site (NASA PGDA / ISRO)
              </label>
              <select
                id="site-selector"
                value={site.siteId}
                onChange={(e) => onSiteChange(e.target.value)}
                className="w-full h-9 px-3 bg-[#F8FAFC] border border-[#CBD5E1] hover:border-[#94A3B8] rounded-lg text-xs font-medium text-[#0F172A] focus:border-[#0284C7] focus:outline-none transition-colors"
              >
                {LUNAR_SITES.map((s) => (
                  <option key={s.metadata.siteId} value={s.metadata.siteId}>
                    {s.metadata.siteId} · {s.metadata.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-[11px] font-medium text-[#475569] mb-1">
                Persona
              </span>
              <div
                role="group"
                aria-label="Persona mode"
                className="inline-flex p-0.5 bg-[#F1F5F9] border border-[#CBD5E1] rounded-lg"
              >
                <button
                  type="button"
                  onClick={() => onPersonaChange('planner')}
                  aria-pressed={persona === 'planner'}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                    persona === 'planner'
                      ? 'bg-white text-[#0F172A] shadow-xs'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  Planner
                </button>
                <button
                  type="button"
                  onClick={() => onPersonaChange('educator')}
                  aria-pressed={persona === 'educator'}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap shrink-0 ${
                    persona === 'educator'
                      ? 'bg-white text-[#0284C7] shadow-xs font-semibold'
                      : 'text-[#475569] hover:text-[#0F172A]'
                  }`}
                >
                  Educator
                </button>
              </div>
            </div>
          </div>

          {/* Center: Creation of Adam Wireframe Bridge SVG */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center px-3 py-1.5 bg-[#F8FAFC] border border-[#DCE5F2] rounded-xl">
            <svg
              viewBox="0 0 420 56"
              className="w-full max-w-[380px] h-12"
              role="img"
              aria-label={`Creation of Adam Telemetry Bridge: ${palette.label}`}
            >
              {/* Left Arm: Lunar Regolith Contour Wireframe */}
              <g stroke="#1E293B" strokeWidth="1.25" fill="none" opacity="0.9">
                <path d="M 8 36 L 62 29 L 116 32 L 154 25 L 182 28 L 194 26" />
                <path d="M 14 43 L 68 37 L 122 40 L 158 32 L 181 33" opacity="0.45" />
                <path d="M 176 24 L 191 21 L 196 23" strokeWidth="1.1" />
                <path d="M 179 31 L 193 29" strokeWidth="1.0" />
                {/* Lunar topographic elevation ticks */}
                <line x1="40" y1="26" x2="40" y2="46" stroke="#94A3B8" strokeWidth="0.7" />
                <line x1="90" y1="26" x2="90" y2="46" stroke="#94A3B8" strokeWidth="0.7" />
                <line x1="140" y1="22" x2="140" y2="44" stroke="#94A3B8" strokeWidth="0.7" />
              </g>

              {/* Center Target Reticle */}
              <g transform="translate(210, 27)">
                <circle
                  r="11"
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="0.9"
                  strokeDasharray="2 2"
                />
                <line x1="-16" y1="0" x2="-6" y2="0" stroke="#64748B" strokeWidth="0.9" />
                <line x1="6" y1="0" x2="16" y2="0" stroke="#64748B" strokeWidth="0.9" />
                <line x1="0" y1="-15" x2="0" y2="-6" stroke="#64748B" strokeWidth="0.9" />
                <line x1="0" y1="6" x2="0" y2="15" stroke="#64748B" strokeWidth="0.9" />
              </g>

              {/* Reactive Telemetry Spark between Fingertips (196..224) */}
              {summary.bridgeState === 'COHERENT' && (
                <g>
                  <line
                    x1="196"
                    y1="26"
                    x2="224"
                    y2="27"
                    stroke={palette.stroke}
                    strokeWidth="2.4"
                  />
                  <circle cx="210" cy="26.5" r="3.2" fill={palette.secondary} />
                  {/* 1.28s Speed-of-Light traveling cyan pulse from Earth (386) to Lander (196) */}
                  <circle r="3" fill="#38BDF8">
                    <animate attributeName="cx" values="386;224;196" dur="1.28s" repeatCount="indefinite" />
                    <animate attributeName="cy" values="22;27;26" dur="1.28s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;1;0.3" dur="1.28s" repeatCount="indefinite" />
                  </circle>
                </g>
              )}
              {summary.bridgeState === 'FADING' && (
                <g>
                  <line
                    x1="196"
                    y1="26"
                    x2="224"
                    y2="27"
                    stroke={palette.stroke}
                    strokeWidth="1.8"
                    strokeDasharray="4 3"
                  />
                  <circle cx="210" cy="26.5" r="2.2" fill={palette.stroke} />
                  <circle r="2.5" fill="#F59E0B">
                    <animate attributeName="cx" values="386;224;196" dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="cy" values="22;27;26" dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.1;0.8;0.1" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                </g>
              )}
              {summary.bridgeState === 'FRACTURED' && (
                <g stroke={palette.stroke} strokeWidth="1.6" fill="none">
                  {/* Obstructing Crater Ridge Silhouette */}
                  <path
                    d="M 198 44 L 206 20 L 214 23 L 222 44 Z"
                    fill="#334155"
                    stroke="#0F172A"
                    strokeWidth="1.2"
                  />
                  {/* Shattered Crimson Line Shards */}
                  <path d="M 196 26 L 202 18 L 205 28" />
                  <path d="M 213 22 L 217 34 L 224 27" />
                  <line x1="203" y1="14" x2="215" y2="38" strokeWidth="1.4" strokeDasharray="2 2" />
                  <circle cx="210" cy="22" r="2.5" fill="#E11D48" />
                </g>
              )}

              {/* Right Arm: Cosmic & Earth RF Telemetry Vector */}
              <g stroke="#0284C7" strokeWidth="1.25" fill="none" opacity="0.95">
                <path d="M 412 20 L 352 25 L 298 22 L 258 29 L 236 26 L 224 27" />
                <path d="M 404 13 L 348 18 L 296 16 L 256 22 L 235 21" opacity="0.45" />
                <path d="M 241 31 L 227 32" strokeWidth="1.0" />
                <circle cx="386" cy="22" r="2" fill="#0284C7" />
                <circle cx="324" cy="23" r="1.6" fill="#D97706" />
              </g>
            </svg>
            <div className="w-full flex items-center justify-between text-[10px] font-mono tabular-nums px-1 pb-0.5 text-[#64748B]">
              <span>
                {Math.abs(site.latDeg).toFixed(4)}° S ·{' '}
                {site.lonDeg >= 0
                  ? `${site.lonDeg.toFixed(4)}° E`
                  : `${Math.abs(site.lonDeg).toFixed(4)}° W`}
              </span>
              <span className={`font-semibold ${palette.textColor}`}>
                {palette.label}
              </span>
            </div>
          </div>

          {/* Right: Master Time Scrubber */}
          <div className="lg:col-span-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-[#475569]">
                Mission Time{' '}
                <strong className="text-[#0F172A]">
                  T+{activeHourIndex}h (Day {dayNumber})
                </strong>
              </span>
              <span className="text-[#64748B]">
                {currentPoint.timestampUtc.slice(0, 16).replace('T', ' ')} UTC
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pause simulation timeline' : 'Play simulation timeline'}
                className="h-9 px-3 flex items-center gap-1.5 bg-[#F8FAFC] border border-[#CBD5E1] hover:border-[#0284C7] rounded-lg text-xs font-medium text-[#0F172A] transition-colors shrink-0"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Scrub'}</span>
              </button>
              <input
                type="range"
                aria-label="Master simulation time scrubber in hours"
                min={0}
                max={maxHour}
                step={1}
                value={activeHourIndex}
                onChange={(e) => onHourChange(Number(e.target.value))}
                className="telemetry-slider flex-1"
              />
              <button
                type="button"
                onClick={() => onHourChange(0)}
                aria-label="Reset timeline to touchdown"
                className="h-9 px-2.5 flex items-center justify-center bg-[#F8FAFC] border border-[#CBD5E1] hover:border-[#0284C7] rounded-lg text-xs text-[#475569] hover:text-[#0F172A] transition-colors shrink-0"
                title="Reset to T+0h"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mission Autopsy & Engineering Override Banner (IM-2 Athena Replay) */}
        {isReplayActive && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-rose-950 via-slate-900 to-amber-950 border border-rose-500/80 rounded-xl text-xs text-rose-100 shadow-xl"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <div>
                <span className="font-bold text-rose-300 font-mono tracking-wide">
                  IM-2 ATHENA MISSION AUTOPSY:
                </span>{' '}
                <span className="text-slate-200">
                  Crater dispersion trap (-200m, +200m) · 1.5° Grazing ridge shadow engulfs solar array · Battery depletes in 13h
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onEngageEngineeringOverride}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 font-bold font-mono rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
              <span>ENGAGE ENGINEERING OVERRIDE: EXTEND MAST TO 6.5M</span>
            </button>
          </div>
        )}

        {/* Critical Status / Telemetry Summary Strip */}
        {isCriticalLoss ? (
          <div
            role="status"
            data-testid="mission-status-banner"
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#FFF1F2] border border-[#FECDD3] rounded-lg text-xs"
          >
            <div className="flex items-center gap-2 font-semibold text-[#BE123C]">
              <ShieldAlert className="w-4 h-4 text-[#E11D48] shrink-0" />
              <span>
                CRITICAL BATTERY DEPLETION — MISSION TERMINATED IN{' '}
                {summary.hoursToDepletion ?? summary.longestDarknessHrs} HOURS
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums text-[#881337]">
              <span>
                Offset ({selectedCell.dxM >= 0 ? `+${selectedCell.dxM}` : selectedCell.dxM}m,{' '}
                {selectedCell.dyM >= 0 ? `+${selectedCell.dyM}` : selectedCell.dyM}m)
              </span>
              <span>Slope {selectedCell.slopeDeg}°</span>
              <span>Sun {summary.pSunPct}%</span>
              <span>Max Darkness {summary.longestDarknessHrs}h</span>
            </div>
          </div>
        ) : (
          <div
            role="status"
            data-testid="mission-status-banner"
            className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-xs border ${
              summary.status === 'SAFE'
                ? 'bg-[#F0FDF9] border-[#A7F3D0]'
                : 'bg-[#FFFBEB] border-[#FDE68A]'
            }`}
          >
            <div className="flex items-center gap-2 font-medium text-[#0F172A]">
              {summary.status === 'SAFE' ? (
                <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />
              )}
              <span>
                {summary.status === 'SAFE'
                  ? 'NOMINAL LANDING ZONE · SURVIVAL ENVELOPE VERIFIED'
                  : 'MARGINAL ZONE · REDUCED POWER OR COMMS MARGIN'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-[#475569]">
              <span>
                Offset ({selectedCell.dxM >= 0 ? `+${selectedCell.dxM}` : selectedCell.dxM}m,{' '}
                {selectedCell.dyM >= 0 ? `+${selectedCell.dyM}` : selectedCell.dyM}m)
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[#B45309] font-semibold">Sun {summary.pSunPct}%</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#0284C7] font-semibold">DTE {summary.pEarthPct}%</span>
              <span aria-hidden="true">·</span>
              <span>SoC {currentPoint.batterySocPct.toFixed(1)}%</span>
              <span aria-hidden="true">·</span>
              <span>Temp {currentPoint.surfaceTempK.toFixed(1)} K</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
