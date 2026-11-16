import React from 'react';
import { Download } from 'lucide-react';
import type {
  ParetoSiteRanking,
  SiteAnalysisResult,
  WeightConfig,
} from '../science/types';

interface ComparisonWorkspaceProps {
  rankings: ParetoSiteRanking[];
  activeSiteId: string;
  weights: WeightConfig;
  analysis: SiteAnalysisResult;
  onSelectSite: (siteId: string) => void;
  onUpdateWeights: (weights: WeightConfig) => void;
  onExportCsv: () => void;
}

export const ComparisonWorkspace: React.FC<ComparisonWorkspaceProps> = ({
  rankings,
  activeSiteId,
  weights,
  analysis,
  onSelectSite,
  onUpdateWeights,
  onExportCsv,
}) => {
  return (
    <div className="flex flex-col gap-6">
      {/* Pareto "Goldilocks" Solver Table */}
      <section
        id="pareto-ranking"
        aria-label="Autonomous Goldilocks Pareto Multi-Site Comparison"
        className="bg-white border border-[#DCE5F2] rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Autonomous &ldquo;Goldilocks&rdquo; Pareto Multi-Site Solver
            </h2>
            <p className="text-[11px] text-[#64748B]">
              Simultaneously ranks 8 NASA PGDA &amp; ISRO sites across solar persistence, DTE comms, slope flatness, and PSR volatile proximity
            </p>
          </div>
          <button
            type="button"
            onClick={onExportCsv}
            className="h-9 px-3.5 flex items-center gap-2 bg-[#EBF3FF] border border-[#93C5FD] hover:bg-[#DBEAFE] text-xs font-semibold text-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Export CSV Telemetry</span>
          </button>
        </div>

        {/* Trade-Study Weight Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="weight-sun" className="text-[#334155] font-medium">
                Solar Illumination Weight
              </label>
              <span className="font-mono tabular-nums font-semibold text-[#D97706]">
                {Math.round(weights.sun * 100)}%
              </span>
            </div>
            <input
              id="weight-sun"
              type="range"
              min={0.1}
              max={0.8}
              step={0.05}
              value={weights.sun}
              onChange={(e) =>
                onUpdateWeights({ ...weights, sun: Number(e.target.value) })
              }
              className="telemetry-slider w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="weight-earth" className="text-[#334155] font-medium">
                Earth DTE Comms Weight
              </label>
              <span className="font-mono tabular-nums font-semibold text-[#0284C7]">
                {Math.round(weights.earth * 100)}%
              </span>
            </div>
            <input
              id="weight-earth"
              type="range"
              min={0.1}
              max={0.8}
              step={0.05}
              value={weights.earth}
              onChange={(e) =>
                onUpdateWeights({ ...weights, earth: Number(e.target.value) })
              }
              className="telemetry-slider w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="weight-terrain" className="text-[#334155] font-medium">
                Terrain Slope Weight
              </label>
              <span className="font-mono tabular-nums font-semibold text-[#059669]">
                {Math.round(weights.terrain * 100)}%
              </span>
            </div>
            <input
              id="weight-terrain"
              type="range"
              min={0.1}
              max={0.8}
              step={0.05}
              value={weights.terrain}
              onChange={(e) =>
                onUpdateWeights({ ...weights, terrain: Number(e.target.value) })
              }
              className="telemetry-slider w-full"
            />
          </div>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#DCE5F2] text-[#475569] font-mono">
                <th className="py-2.5 pr-3 font-semibold">Site ID</th>
                <th className="py-2.5 px-3 font-semibold">Region Name</th>
                <th className="py-2.5 px-3 font-semibold text-right">Sun %</th>
                <th className="py-2.5 px-3 font-semibold text-right">DTE %</th>
                <th className="py-2.5 px-3 font-semibold text-right">Slope</th>
                <th className="py-2.5 px-3 font-semibold text-right">PSR Ice</th>
                <th className="py-2.5 px-3 font-semibold text-right">Max Dark</th>
                <th className="py-2.5 px-3 font-semibold text-right">Score</th>
                <th className="py-2.5 pl-3 font-semibold text-right">Frontier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EEF6] font-mono tabular-nums">
              {rankings.map((r) => {
                const isActive = r.siteId === activeSiteId;
                return (
                  <tr
                    key={r.siteId}
                    className={`transition-colors ${
                      isActive ? 'bg-[#EBF3FF]' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <td className="py-2.5 pr-3 text-[#0284C7] font-semibold">
                      <button
                        type="button"
                        onClick={() => onSelectSite(r.siteId)}
                        className="hover:underline focus-visible:outline-2 focus-visible:outline-[#0284C7]"
                      >
                        {r.siteId}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[#0F172A] font-medium">
                      <button
                        type="button"
                        onClick={() => onSelectSite(r.siteId)}
                        className="text-left hover:text-[#0284C7] transition-colors"
                      >
                        {r.name}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#B45309]">
                      {r.pSunPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#0284C7]">
                      {r.pEarthPct.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#334155]">
                      {r.slopeDeg.toFixed(1)}°
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#64748B]">
                      {r.iceProximityKm.toFixed(1)} km
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#334155]">
                      {r.longestDarknessHrs}h
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#0F172A]">
                      <div className="inline-flex items-center justify-end gap-2">
                        <span className="w-12 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden hidden sm:inline-block">
                          <span
                            className="block h-full bg-[#2563EB] rounded-full"
                            style={{ width: `${Math.max(4, Math.min(100, r.compositeScore))}%` }}
                          />
                        </span>
                        <span>{r.compositeScore.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      {r.paretoOptimal && r.viable ? (
                        <span className="text-[#059669] font-semibold">★ PARETO</span>
                      ) : r.viable ? (
                        <span className="text-[#475569] font-medium">VIABLE</span>
                      ) : (
                        <span className="text-[#E11D48] font-semibold">AT RISK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Scientific Provenance & Methodology Footer Section */}
      <section
        id="provenance"
        aria-label="NASA Data Provenance and Scientific Methodology"
        className="bg-white border border-[#DCE5F2] rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs text-[#475569]">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">
              Authoritative NASA Geodesy &amp; Ephemeris Provenance
            </h2>
            <ul className="space-y-1.5 leading-relaxed">
              <li>
                <strong className="text-[#0F172A]">Active DEM Source:</strong>{' '}
                <span className="font-mono text-[#1E293B]">{analysis.site.demSource}</span>
              </li>
              <li>
                <strong className="text-[#0F172A]">Geodetic Uncertainty:</strong>{' '}
                RMS height error ±{analysis.site.rmsHeightUncertaintyM} m · RMS slope error ±{analysis.site.rmsSlopeErrorDeg}° · Frame: MOON_ME (DE421-calibrated) / IAU_2015:30135
              </li>
              <li>
                <strong className="text-[#0F172A]">Academic Citations:</strong>{' '}
                Barker et al. (2021) <em>PSS</em> 203; Mazarico et al. (2011) <em>Icarus</em> 211; Bertone et al. (2026) <em>PSJ</em> (PGDA 104); NASA M2M Lunar Surface Data Book (2025).
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-[#0F172A] mb-2">
              Operational Physics Disclaimers
            </h2>
            <ul className="space-y-1.5 leading-relaxed">
              <li>
                <strong className="text-[#0F172A]">Line-of-Sight vs. RF Link Budget:</strong>{' '}
                DTE visibility measures geometric terrain clearance against 360° horizon masks. Operational RF links also depend on spacecraft antenna gain patterns, tilt pointing loss, and DSN schedules.
              </li>
              <li>
                <strong className="text-[#0F172A]">5m/px DEM Resolution Limits:</strong>{' '}
                LOLA-calibrated 5m/px topography resolves regional crater walls, slopes, and horizon blockage; sub-meter terminal boulder avoidance requires onboard hazard detection lidar.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};
