import React from 'react';
import {
  Activity,
  Battery,
  BatteryCharging,
  BatteryWarning,
  Flame,
  Radio,
  Sun,
  ThermometerSnowflake,
  Wifi,
  WifiOff,
} from 'lucide-react';

export interface MissionMetricsBarProps {
  siteName: string;
  spacecraftName: string;
  hourIndex: number;
  maxHours: number;
  sunElevationDeg: number;
  earthElevationDeg: number;
  batterySocPct: number;
  surfaceTempK: number;
  isSimultaneous: boolean;
  isShadowed: boolean;
  slopeDeg?: number;
}

export function MissionMetricsBar({
  siteName,
  spacecraftName,
  hourIndex,
  maxHours,
  sunElevationDeg,
  earthElevationDeg,
  batterySocPct,
  surfaceTempK,
  isSimultaneous,
  isShadowed,
  slopeDeg = 0,
}: MissionMetricsBarProps) {
  const isBatteryDepleted = batterySocPct <= 5.0;
  const isBatteryLow = batterySocPct > 5.0 && batterySocPct < 30.0;
  const isEarthVisible = earthElevationDeg > 0;
  const isCryoTrap = surfaceTempK < 60;

  return (
    <div
      role="region"
      aria-label="Mission Operational Status Bar"
      className="w-full bg-[#07090E]/90 backdrop-blur-md border-y border-[#1E293B] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
    >
      {/* Left: Active Site & Spacecraft Pill */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0F172A] border border-[#334155] rounded-md">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isBatteryDepleted ? 'bg-rose-400' : 'bg-cyan-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isBatteryDepleted ? 'bg-rose-500' : 'bg-cyan-500'
              }`}
            />
          </span>
          <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
            {siteName}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-cyan-400 uppercase text-[11px] font-medium">
            {spacecraftName}
          </span>
        </div>

        {/* MET Elapsed */}
        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
          <Activity className="w-3.5 h-3.5 text-slate-500" />
          <span>MET:</span>
          <span className="text-slate-200 font-semibold tabular-nums">
            T+{hourIndex.toString().padStart(3, '0')}h
          </span>
          <span className="text-slate-600">/ {maxHours}h</span>
        </div>
      </div>

      {/* Center: Live Telemetry Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Solar Elevation Chip */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] ${
            isShadowed
              ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              : 'bg-amber-950/30 border-amber-800/50 text-amber-300'
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>SUN:</span>
          <span className="font-bold tabular-nums">
            {sunElevationDeg >= 0 ? `+${sunElevationDeg.toFixed(1)}°` : `${sunElevationDeg.toFixed(1)}°`}
          </span>
          <span className="text-[10px] uppercase font-semibold px-1 rounded bg-black/40">
            {isShadowed ? 'OCCLUDED' : 'DIRECT'}
          </span>
        </div>

        {/* Earth Link Chip */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] ${
            isEarthVisible
              ? 'bg-sky-950/30 border-sky-800/50 text-sky-300'
              : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}
        >
          {isEarthVisible ? (
            <Wifi className="w-3.5 h-3.5 text-sky-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span>EARTH:</span>
          <span className="font-bold tabular-nums">
            {earthElevationDeg >= 0 ? `+${earthElevationDeg.toFixed(1)}°` : `${earthElevationDeg.toFixed(1)}°`}
          </span>
          <span className="text-[10px] uppercase font-semibold px-1 rounded bg-black/40">
            {isEarthVisible ? 'DTE LOCK' : 'BLOCKED'}
          </span>
        </div>

        {/* Battery State of Charge Chip */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] ${
            isBatteryDepleted
              ? 'bg-rose-950/60 border-rose-700 text-rose-200 animate-pulse'
              : isBatteryLow
              ? 'bg-amber-950/40 border-amber-700 text-amber-200'
              : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
          }`}
        >
          {isBatteryDepleted ? (
            <BatteryWarning className="w-3.5 h-3.5 text-rose-400" />
          ) : isBatteryLow ? (
            <Battery className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>BATT:</span>
          <span className="font-bold tabular-nums">{batterySocPct.toFixed(0)}%</span>
          {isBatteryDepleted && (
            <span className="text-[9px] uppercase font-bold px-1 rounded bg-rose-900 text-white">
              DEPLETED
            </span>
          )}
        </div>

        {/* Surface Regolith Temperature */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] ${
            isCryoTrap
              ? 'bg-indigo-950/40 border-indigo-800/60 text-indigo-300'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <ThermometerSnowflake className="w-3.5 h-3.5" />
          <span>TEMP:</span>
          <span className="font-bold tabular-nums">{surfaceTempK.toFixed(0)} K</span>
          {isCryoTrap && (
            <span className="text-[9px] uppercase font-bold px-1 rounded bg-indigo-900/80 text-indigo-200">
              CRYO
            </span>
          )}
        </div>
      </div>

      {/* Right: Operational Window Status Badge */}
      <div className="flex items-center gap-2">
        {isSimultaneous ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/50 border border-emerald-700/60 text-emerald-300 text-[11px] font-semibold tracking-wide">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>OPTIMAL SUN + DTE WINDOW</span>
          </div>
        ) : isShadowed ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/50 border border-rose-800 text-rose-300 text-[11px] font-medium">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>CRATER SHADOW / BATTERY DISCHARGE</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 text-[11px]">
            <span>SUNLIT / DTE OFF-NOMINAL</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default MissionMetricsBar;
