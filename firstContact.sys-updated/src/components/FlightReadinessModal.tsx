import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileCheck,
  Printer,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { SiteAnalysisResult, SpacecraftProfile, SolverConstraints } from '../science/types';

interface FlightReadinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: SiteAnalysisResult;
  spacecraft: SpacecraftProfile;
  constraints: SolverConstraints;
  onExportCsv: () => void;
  onCopyUrl: () => void;
  hasCopiedUrl: boolean;
  wasmState?: {
    status: 'IDLE' | 'COMPUTING' | 'VERIFIED' | 'UNAVAILABLE';
    result?: {
      continuous_shadow_duration_h: number;
      minimum_battery_wh: number;
      slope_deg: number;
      [k: string]: unknown;
    };
    computeTimeMs?: number;
  };
}

export const FlightReadinessModal: React.FC<FlightReadinessModalProps> = ({
  isOpen,
  onClose,
  analysis,
  spacecraft,
  constraints,
  onExportCsv,
  onCopyUrl,
  hasCopiedUrl,
  wasmState,
}) => {
  if (!isOpen) return null;

  const { site, summary, selectedCell } = analysis;

  // V2-parity constraint assessment — mirrors missionConstraints.ts assessConstraints() logic exactly:
  // maxDarknessHrs must be satisfied, min comms window must be satisfied, minSoC >= 20%, slope within limit.
  const darknessViolation = summary.longestDarknessHrs > constraints.maxDarknessHrs;
  const commsViolation = summary.pEarthPct < (constraints.minCommsWindowHrs / (constraints.missionDurationDays * 24)) * 100;
  const socViolation = summary.minBatterySocPct < 20;
  const slopeViolation = !summary.slopeWithinLimit;
  const depletionViolation = summary.hoursToDepletion !== null;

  const isGo =
    summary.status === 'SAFE' &&
    !darknessViolation &&
    !commsViolation &&
    !socViolation &&
    !slopeViolation &&
    !depletionViolation;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="frr-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-200 text-slate-900 flex flex-col">
        {/* Dossier Header */}
        <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
              <FileCheck className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-[11px] font-mono tracking-wider uppercase text-slate-500 font-bold">
                NASA Space Apps Challenge 2026 · Challenge 10
              </div>
              <h2 id="frr-title" className="text-xl font-bold font-display text-slate-900">
                Flight Readiness Review (FRR) Dossier
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Flight Readiness Dossier"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dossier Content */}
        <div className="p-6 flex flex-col gap-6">
          {/* Official GO / NO-GO Status Stamp */}
          <div
            className={`p-5 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${
              isGo
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-rose-50 border-rose-300 text-rose-950'
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg ${
                  isGo ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              >
                {isGo ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : (
                  <ShieldAlert className="w-7 h-7" />
                )}
              </div>
              <div>
                <div className="text-xs font-mono uppercase tracking-widest font-bold opacity-75">
                  Flight Determination
                </div>
                <div className="text-2xl font-black font-display tracking-tight">
                  {isGo ? 'FLIGHT STATUS: GO' : 'FLIGHT STATUS: NO-GO'}
                </div>
                <div className="text-xs mt-0.5 opacity-90">
                  {isGo
                    ? 'All environmental, slope, battery reserve, and comms criteria satisfied.'
                    : summary.hoursToDepletion !== null
                      ? `Critical failure: Power depletion at T+${summary.hoursToDepletion}h in local crater shadow.`
                      : 'Critical failure: Local terrain slope exceeds lander structural limits.'}
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-xs">
              <div className="font-bold">EVALUATION METRIC</div>
              <div className="text-sm font-semibold">
                Score: {summary.weightedSuitabilityScore.toFixed(1)} / 100
              </div>
            </div>
          </div>

          {/* Mission Telemetry Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-slate-500 font-medium">Landing Site</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                {site.siteId}
              </div>
              <div className="text-[11px] text-slate-600 truncate">{site.name}</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-slate-500 font-medium">Spacecraft Profile</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                {spacecraft.name}
              </div>
              <div className="text-[11px] text-slate-600">{spacecraft.contractor}</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-slate-500 font-medium">Mast Height</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                {constraints.mastHeightM.toFixed(1)} m
              </div>
              <div className="text-[11px] text-slate-600">Elev: {site.elevationM}m</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-slate-500 font-medium">Local Footpad Slope</div>
              <div
                className={`text-sm font-bold mt-0.5 font-mono ${
                  summary.slopeWithinLimit ? 'text-slate-900' : 'text-rose-600'
                }`}
              >
                {selectedCell.slopeDeg.toFixed(1)}°
              </div>
              <div className="text-[11px] text-slate-600">Limit: ≤{spacecraft.maxSlopeDeg}°</div>
            </div>
          </div>

          {/* Deep Physical Telemetry Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono">
                <tr>
                  <th className="py-2.5 px-3.5 font-semibold">Constraint / Parameter</th>
                  <th className="py-2.5 px-3.5 font-semibold">Observed Value</th>
                  <th className="py-2.5 px-3.5 font-semibold">Requirement</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="py-2 px-3.5 font-sans font-medium text-slate-900">
                    Solar Illumination Persistence
                  </td>
                  <td className="py-2 px-3.5 font-semibold text-amber-600">
                    {summary.pSunPct.toFixed(1)}% (Max dark: {summary.longestDarknessHrs}h)
                  </td>
                  <td className="py-2 px-3.5 text-slate-600">≤{constraints.maxDarknessHrs}h darkness</td>
                  <td className={`py-2 px-3.5 text-right font-bold ${!darknessViolation ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {!darknessViolation ? 'PASS' : 'FAIL'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3.5 font-sans font-medium text-slate-900">
                    Direct-to-Earth (DTE) Comms
                  </td>
                  <td className="py-2 px-3.5 font-semibold text-sky-600">
                    {summary.pEarthPct.toFixed(1)}% (Max gap: {summary.longestCommsGapHrs}h)
                  </td>
                  <td className="py-2 px-3.5 text-slate-600">≥{constraints.minCommsWindowHrs}h / day</td>
                  <td className={`py-2 px-3.5 text-right font-bold ${!commsViolation ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {!commsViolation ? 'PASS' : 'FAIL'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3.5 font-sans font-medium text-slate-900">
                    Minimum Battery State of Charge
                  </td>
                  <td
                    className={`py-2 px-3.5 font-semibold ${
                      !socViolation ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {summary.minBatterySocPct.toFixed(1)}%
                  </td>
                  <td className="py-2 px-3.5 text-slate-600">≥20.0% reserve floor</td>
                  <td
                    className={`py-2 px-3.5 text-right font-bold ${
                      !socViolation ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {!socViolation ? 'PASS' : 'FAIL'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3.5 font-sans font-medium text-slate-900">
                    LRO Diviner Surface Temperature
                  </td>
                  <td className="py-2 px-3.5 text-slate-700">
                    {summary.minSurfaceTempK.toFixed(0)}K – {summary.maxSurfaceTempK.toFixed(0)}K
                  </td>
                  <td className="py-2 px-3.5 text-slate-600">≥{spacecraft.minSurvivalTempK}K survival</td>
                  <td className={`py-2 px-3.5 text-right font-bold ${summary.minSurfaceTempK >= spacecraft.minSurvivalTempK ? 'text-emerald-600' : 'text-amber-500'}`}>
                    {summary.minSurfaceTempK >= spacecraft.minSurvivalTempK ? 'NOMINAL' : 'COLD EXCURSION'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* NASA Standards & Open Science Traceability Badges (Dynamically Derived) */}
          <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col gap-2.5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
              Provenance Disclosures & Model Traceability (Pre-Phase-A Trade Study)
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono">
              <span className={`px-2.5 py-1 rounded-lg border ${
                site.siteId === 'PGDA-04' || site.demSource.includes('Product 78')
                  ? 'bg-slate-800 border-cyan-800 text-cyan-200'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}>
                DEM: {site.demSource}
              </span>
              <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-200">
                Ephemeris: JPL DE421 Aligned Topocentric Model (15-min / 1h step)
              </span>
              <span className={`px-2.5 py-1 rounded-lg border ${
                wasmState?.status === 'VERIFIED'
                  ? 'bg-emerald-950/60 border-emerald-600 text-emerald-200'
                  : 'bg-slate-800 border-slate-700 text-slate-200'
              }`}>
                Physics Kernel: {wasmState?.status === 'VERIFIED'
                  ? `Rust WebAssembly (Zero-Copy DE421 · ${wasmState.computeTimeMs}ms)`
                  : 'Analytical Framework (JPL DE421 Ephemeris Aligned)'}
              </span>
              <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-200">
                Frame: MOON_ME (IAU_2015:30135) · NAIF SPICE FK Transform
              </span>
              <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-200">
                DSN: DSS-14 / 63 / 43 Geometric Line-of-Sight Masking
              </span>
              <span className="px-2.5 py-1 bg-amber-950/60 border border-amber-700/60 rounded-lg text-amber-200">
                Status: Exploration & Sensitivity Analysis Only (Not Flight Software)
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopyUrl}
              className="h-9 px-3.5 flex items-center gap-2 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-semibold text-slate-700 transition-colors shadow-xs"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>{hasCopiedUrl ? 'Link Copied! ✓' : 'Copy Shareable Link'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-9 px-3.5 flex items-center gap-2 bg-white border border-slate-300 hover:border-slate-400 rounded-lg text-xs font-semibold text-slate-700 transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Dossier</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onExportCsv}
            className="h-9 px-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Full CSV Telemetry</span>
          </button>
        </div>
      </div>
    </div>
  );
};
