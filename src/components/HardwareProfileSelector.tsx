import React from 'react';
import { SPACECRAFT_PROFILES } from '../science/lunarData';
import type { SolverConstraints, SpacecraftProfile } from '../science/types';

interface HardwareProfileSelectorProps {
  selectedSpacecraftId: SpacecraftProfile['id'];
  constraints: SolverConstraints;
  onSelectSpacecraft: (id: SpacecraftProfile['id']) => void;
  onUpdateConstraints: (patch: Partial<SolverConstraints>) => void;
}

export const HardwareProfileSelector: React.FC<HardwareProfileSelectorProps> = ({
  selectedSpacecraftId,
  constraints,
  onSelectSpacecraft,
  onUpdateConstraints,
}) => {
  return (
    <section
      aria-label="Spacecraft Hardware Profiles and Survival Constraints"
      className="bg-white border border-[#DCE5F2] rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A]">
            Illustrative hardware assumptions
          </h2>
          <p className="text-[11px] text-[#64748B]">
            Named profiles are illustrative assumptions, not certified spacecraft specifications.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#475569] font-medium">Window:</span>
          <div
            role="group"
            aria-label="Mission duration days"
            className="inline-flex p-0.5 bg-[#F1F5F9] border border-[#CBD5E1] rounded-lg"
          >
            {[7, 10, 14].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => onUpdateConstraints({ missionDurationDays: days })}
                aria-pressed={constraints.missionDurationDays === days}
                className={`px-3 py-1 text-xs font-mono tabular-nums rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  constraints.missionDurationDays === days
                    ? 'bg-white text-[#0284C7] font-semibold shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4 Spacecraft Hardware Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 mb-5">
        {SPACECRAFT_PROFILES.map((sc) => {
          const isSelected = sc.id === selectedSpacecraftId;
          return (
            <button
              key={sc.id}
              type="button"
              onClick={() => onSelectSpacecraft(sc.id)}
              aria-pressed={isSelected}
              className={`text-left p-3.5 rounded-lg border transition-all focus-visible:outline-2 focus-visible:outline-[#0284C7] ${
                isSelected
                  ? 'bg-[#EBF3FF] border-[#2563EB] shadow-xs'
                  : 'bg-[#F8FAFC] border-[#DCE5F2] hover:border-[#94A3B8] hover:bg-white'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-sm font-semibold text-[#0F172A] whitespace-nowrap">
                  {sc.name}
                </span>
                <span className="text-[11px] font-mono font-semibold text-[#0284C7] whitespace-nowrap">
                  {sc.missionLabel}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] mb-2.5">{sc.contractor}</p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-mono tabular-nums text-[#334155]">
                <span>Mast {sc.defaultMastM.toFixed(1)} m</span>
                <span>Bat {sc.batteryCapacityKwh.toFixed(1)} kWh</span>
                <span>Slope ≤{sc.maxSlopeDeg.toFixed(0)}°</span>
                <span>Load {sc.hotelLoadW} W</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive Physics & Solver Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-[#E8EEF6]">
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <label htmlFor="mast-height-slider" className="text-[#334155] font-medium">
              Solar / Comms Mast Height
            </label>
            <span className="font-mono tabular-nums text-[#0284C7] font-semibold">
              {constraints.mastHeightM.toFixed(1)} m
            </span>
          </div>
          <input
            id="mast-height-slider"
            type="range"
            min={0.5}
            max={10.0}
            step={0.5}
            value={constraints.mastHeightM}
            onChange={(e) =>
              onUpdateConstraints({ mastHeightM: Number(e.target.value) })
            }
            className="telemetry-slider w-full"
          />
          <div className="flex justify-between text-[10px] font-mono text-[#64748B] mt-1">
            <span>0.5 m</span>
            <span>Exploratory height model</span>
            <span>10.0 m</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <label htmlFor="max-darkness-slider" className="text-[#334155] font-medium">
              Max Allowable Darkness
            </label>
            <span className="font-mono tabular-nums text-[#D97706] font-semibold">
              {constraints.maxDarknessHrs} h
            </span>
          </div>
          <input
            id="max-darkness-slider"
            type="range"
            min={2}
            max={48}
            step={2}
            value={constraints.maxDarknessHrs}
            onChange={(e) =>
              onUpdateConstraints({ maxDarknessHrs: Number(e.target.value) })
            }
            className="telemetry-slider w-full"
          />
          <div className="flex justify-between text-[10px] font-mono text-[#64748B] mt-1">
            <span>2 h</span>
            <span>Battery Survival Limit</span>
            <span>48 h</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <label htmlFor="min-comms-slider" className="text-[#334155] font-medium">
              Min Continuous DTE Comms
            </label>
            <span className="font-mono tabular-nums text-[#0F172A] font-semibold">
              {constraints.minCommsWindowHrs} h
            </span>
          </div>
          <input
            id="min-comms-slider"
            type="range"
            min={2}
            max={24}
            step={2}
            value={constraints.minCommsWindowHrs}
            onChange={(e) =>
              onUpdateConstraints({ minCommsWindowHrs: Number(e.target.value) })
            }
            className="telemetry-slider w-full"
          />
          <div className="flex justify-between text-[10px] font-mono text-[#64748B] mt-1">
            <span>2 h</span>
            <span>Earth Link Window</span>
            <span>24 h</span>
          </div>
        </div>
      </div>
    </section>
  );
};
