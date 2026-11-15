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
        aria-label="Pareto multi-site comparison"
        className="bg-white border border-[#DCE5F2] rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Pareto multi-site comparison
            </h2>
            <p className="text-[11px] text-[#64748B]">
              {rankings.filter((r) => !r.isCalibration).length} real sites ranked on published LOLA terrain
              and baked JPL DE421 sky + 1 synthetic calibration case. MOCK-01 is shown last and excluded
              from ranking, the frontier, and recommendations. PSR distance is proximity evidence, not a
              confirmed ice measurement.
            </p>
          </div>
          <button
            type="button"
            onClick={onExportCsv}
            className="h-9 px-3.5 flex items-center gap-2 bg-[#EBF3FF] border border-[#93C5FD] hover:bg-[#DBEAFE] text-xs font-semibold text-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Export CSV</span>
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
                Geometric Earth View Weight
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
          <table className="w-full text-left border-collapse text-xs rankings-table">
            <thead>
              <tr className="border-b border-[#DCE5F2] text-[#475569] font-mono">
                <th className="py-2.5 pr-3 font-semibold">Site ID</th>
                <th className="py-2.5 px-3 font-semibold">Region Name</th>
                <th className="py-2.5 px-3 font-semibold text-right">Sun %</th>
                <th className="py-2.5 px-3 font-semibold text-right">DTE %</th>
                <th className="py-2.5 px-3 font-semibold text-right">Slope</th>
                <th className="py-2.5 px-3 font-semibold text-right">Nearest PSR</th>
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
                      r.isCalibration
                        ? 'rank-row-calibration bg-[#F8FAFC] text-[#64748B]'
                        : isActive
                          ? 'bg-[#EBF3FF]'
                          : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <td className="rank-site py-2.5 pr-3 text-[#0284C7] font-semibold">
                      <button
                        type="button"
                        onClick={() => onSelectSite(r.siteId)}
                        className="hover:underline focus-visible:outline-2 focus-visible:outline-[#0284C7]"
                      >
                        {r.siteId}
                      </button>
                    </td>
                    <td className="rank-name py-2.5 px-3 font-sans text-[#0F172A] font-medium">
                      <button
                        type="button"
                        onClick={() => onSelectSite(r.siteId)}
                        className="text-left hover:text-[#0284C7] transition-colors"
                      >
                        {r.name}
                      </button>
                    </td>
                    <td data-label="Sun" className="rank-sun py-2.5 px-3 text-right font-semibold text-[#B45309]">
                      {r.pSunPct.toFixed(1)}%
                    </td>
                    <td data-label="DTE" className="rank-dte py-2.5 px-3 text-right font-semibold text-[#0284C7]">
                      {r.pEarthPct.toFixed(1)}%
                    </td>
                    <td data-label="Slope" className="rank-slope py-2.5 px-3 text-right text-[#334155]">
                      {r.slopeDeg.toFixed(1)}°
                    </td>
                    <td data-label="Nearest PSR" className="rank-ice py-2.5 px-3 text-right text-[#64748B]">
                      {r.nearestPsrKm === null ? 'n/a' : `${r.nearestPsrKm.toFixed(2)} km`}
                    </td>
                    <td data-label="Max dark" className="rank-dark py-2.5 px-3 text-right text-[#334155]">
                      {r.longestDarknessHrs}h
                    </td>
                    <td data-label="Score" className="rank-score py-2.5 px-3 text-right font-semibold text-[#0F172A]">
                      {r.isCalibration ? (
                        <span
                          className="text-[#64748B] font-sans text-[10px] font-semibold tracking-wide"
                          title="A composite mission suitability score is not assigned to synthetic calibration data."
                        >
                          CAL ONLY
                        </span>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-2">
                          <span className="w-12 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden hidden sm:inline-block">
                            <span
                              className="block h-full bg-[#2563EB] rounded-full"
                              style={{ width: `${Math.max(4, Math.min(100, r.compositeScore))}%` }}
                            />
                          </span>
                          <span>{r.compositeScore.toFixed(1)}</span>
                        </div>
                      )}
                    </td>
                    <td className="rank-status py-2.5 pl-3 text-right">
                      {r.isCalibration ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-[#64748B] font-semibold"
                          title="Synthetic plane for pipeline validation. Not a real landing candidate."
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" aria-hidden="true" />
                          CALIBRATION
                        </span>
                      ) : r.paretoOptimal && r.viable ? (
                        <span className="text-[#059669] font-semibold">★ FRONTIER</span>
                      ) : r.viable ? (
                        <span className="text-[#475569] font-medium">VIABLE</span>
                      ) : (
                        <span className="text-[#E11D48] font-semibold">MISSION LOSS</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-[#64748B]">
          <span className="mt-[4px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#94A3B8]" aria-hidden="true" />
          <span>
            <strong className="font-semibold text-[#475569]">MOCK-01 is calibration-only.</strong>{' '}
            Its terrain is a procedural plane, so no composite suitability score is assigned and
            it is excluded from the Pareto solver and every mission-site recommendation. It stays in the dataset to prove the full
            analysis pipeline runs end to end on a known synthetic input.
          </span>
        </p>
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
                RMS height error {analysis.site.rmsHeightUncertaintyM === null ? 'n/a' : `±${analysis.site.rmsHeightUncertaintyM} m`}
                {' · '}published slope error {analysis.site.rmsSlopeErrorDeg === null ? 'n/a' : `±${analysis.site.rmsSlopeErrorDeg}°`}
                {' · '}frame {analysis.site.referenceFrame ?? 'MOON_ME'}
              </li>
              <li>
                <strong className="text-[#0F172A]">Source:</strong>{' '}
                NASA GSFC PGDA LOLA south-polar DEM products; Barker et al. (2023) <em>PSJ</em> 4, 183,
                doi:10.3847/PSJ/acf3e1. Ephemeris: JPL DE421 SPK with NAIF MOON_ME orientation.
                {analysis.site.terrainFidelity === 'synthetic'
                  ? ' This site is an explicitly synthetic calibration plane.'
                  : ''}
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
                <strong className="text-[#0F172A]">DEM Resolution Limits:</strong>{' '}
                This site uses {analysis.site.pixelSizeM ?? 'an unknown'} m/px published LOLA data.
                The local 500 m crop and 30 km horizon ray cast cannot certify sub-meter boulder
                clearance; terminal hazard avoidance requires onboard lidar.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};
