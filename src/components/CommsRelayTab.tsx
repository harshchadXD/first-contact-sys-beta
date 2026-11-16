import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  Globe2,
  Radio,
  Satellite,
  Send,
  ShieldAlert,
  Signal,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import type { TimeSeriesPoint } from '../science/types';
import {
  calculateLunarPosition,
  calculateEarthMoonLatencies,
  calculatePhysicalFsplDb,
  calculateLinkBudget,
  solveDsnVisibility,
  calculateServiceBitrates,
  FREQUENCY_PRESETS,
  type FrequencyBand,
} from '../science/commsEngine';

interface CommsRelayTabProps {
  currentPoint: TimeSeriesPoint;
  siteName: string;
  spacecraftName: string;
}

type Destination = 'earth' | 'iss' | 'gateway';

export function CommsRelayTab({
  currentPoint,
  siteName,
  spacecraftName,
}: CommsRelayTabProps) {
  const [destination, setDestination] = useState<Destination>('earth');
  const [band, setBand] = useState<'x-band' | 's-band'>('x-band');
  const [customMessage, setCustomMessage] = useState<string>(
    'STATUS: Lunar ice core drill active at Shackleton rim. Volatiles detected at 2.4% mass fraction.'
  );
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [transmitProgress, setTransmitProgress] = useState<number>(0);
  const [lastAck, setLastAck] = useState<{
    dest: string;
    owlt: string;
    rtt: string;
    margin: string;
    status: 'ACK_SUCCESS' | 'ACK_BLOCKED';
    timestamp: string;
  } | null>(null);

  const isLosBlocked = !currentPoint.earthVisible;

  // Ephemeris date from timeline point
  const missionDate = React.useMemo(() => {
    try {
      const d = new Date(currentPoint.timestampUtc);
      return isNaN(d.getTime()) ? new Date() : d;
    } catch {
      return new Date();
    }
  }, [currentPoint.timestampUtc]);

  // Scientific Lunar Position & Ephemeris Distance
  const lunarPos = React.useMemo(() => calculateLunarPosition(missionDate), [missionDate]);

  // Speed-of-Light Latency Set from commsEngine
  const latencies = React.useMemo(() => calculateEarthMoonLatencies(missionDate), [missionDate]);

  // Active NASA DSN Complex (Goldstone, Madrid, Canberra)
  const dsnVis = React.useMemo(() => solveDsnVisibility(missionDate), [missionDate]);

  const distEarthKm = Math.round(lunarPos.distanceKm);
  const distIssKm = Math.round(lunarPos.distanceKm - 420);
  const distGatewayKm = 68000;

  const owltEarthS = latencies.earthMoon.oneWaySeconds;
  const owltIssRelayS = latencies.issViaTdrss.oneWaySeconds;
  const owltGatewayS = latencies.artemisGateway.oneWaySeconds;

  const currentDistKm =
    destination === 'earth'
      ? distEarthKm
      : destination === 'iss'
      ? distIssKm
      : distGatewayKm;

  const currentOwltS =
    destination === 'earth'
      ? owltEarthS
      : destination === 'iss'
      ? owltIssRelayS
      : owltGatewayS;

  const currentRttS = currentOwltS * 2;

  // Frequency preset & Physical Link Budget
  const bandKey: FrequencyBand = band === 'x-band' ? 'xBandDeepSpace' : 'sBandNearEarth';
  const freqPreset = FREQUENCY_PRESETS[bandKey];
  const fsplDb = calculatePhysicalFsplDb(currentDistKm, freqPreset.frequencyHz);

  // Link Budget Solver
  const budget = React.useMemo(() => {
    return calculateLinkBudget({
      transmitPowerDbm: 43.0, // 20W SSPA
      transmitGainDbi: band === 'x-band' ? 28.5 : 18.2,
      receiveGainDbi: destination === 'earth' ? (dsnVis.station?.antennaDiameterM === 70 ? 74.2 : 68.1) : 38.0,
      frequencyHz: freqPreset.frequencyHz,
      distanceKm: currentDistKm,
      systemTemperatureK: destination === 'earth' ? 22 : 120,
      bandwidthHz: band === 'x-band' ? 10_000_000 : 2_000_000,
      atmosphericLossDb: destination === 'earth' ? 0.35 : 0.0,
      requiredSnrDb: 4.5,
    });
  }, [band, currentDistKm, destination, dsnVis, freqPreset]);

  const serviceRates = React.useMemo(
    () => calculateServiceBitrates(budget.shannonCapacityBps),
    [budget]
  );

  const linkMarginDb = isLosBlocked ? -14.2 : budget.linkMarginDb;
  const rssiDb = isLosBlocked ? -138.0 : budget.receivedPowerDbm;

  const handleTransmit = () => {
    if (isTransmitting) return;
    setIsTransmitting(true);
    setTransmitProgress(0);

    const stepMs = 50;
    const totalDurationMs = Math.round(currentOwltS * 1000);
    const increment = 100 / (totalDurationMs / stepMs);

    const timer = setInterval(() => {
      setTransmitProgress((prev) => {
        if (prev + increment >= 100) {
          clearInterval(timer);
          setIsTransmitting(false);

          setLastAck({
            dest:
              destination === 'earth'
                ? `NASA DSN ${dsnVis.station?.name ?? 'Goldstone'} (${dsnVis.station?.primaryAntenna ?? 'DSS-14'} ${dsnVis.station?.antennaDiameterM ?? 70}m)`
                : destination === 'iss'
                ? 'ISS Columbus Relay & NASA TDRSS'
                : 'Lunar Gateway HALO Module (NRHO)', 
            owlt: `${currentOwltS.toFixed(3)}s`,
            rtt: `${currentRttS.toFixed(3)}s`,
            margin: `${linkMarginDb >= 0 ? '+' : ''}${linkMarginDb.toFixed(1)} dB`,
            status: isLosBlocked ? 'ACK_BLOCKED' : 'ACK_SUCCESS',
            timestamp: new Date().toLocaleTimeString(),
          });
          return 100;
        }
        return prev + increment;
      });
    }, stepMs);
  };

  return (
    <section
      aria-label="Deep Space Communication and Speed-of-Light Relay Simulator"
      className="bg-[#090D16] border border-[#1E293B] rounded-2xl shadow-2xl p-5 text-slate-200 font-sans flex flex-col gap-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                TELEMETRY LINK & LATENCY PROPAGATION
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  isLosBlocked
                    ? 'bg-rose-950/80 border border-rose-800 text-rose-300'
                    : 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                }`}
              >
                {isLosBlocked ? 'DTE OCCLUDED BY CRATER' : 'DTE COHERENT LOCK'}
              </span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight font-mono">
              Speed-of-Light Relay: Rover ↔ ISS ↔ Earth
            </h3>
          </div>
        </div>

        {/* Band Selector */}
        <div className="flex items-center p-0.5 rounded-lg bg-[#0F172A] border border-[#1E293B] text-xs font-mono">
          <button
            type="button"
            onClick={() => setBand('x-band')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              band === 'x-band'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            X-BAND (8.4 GHz · 2 Mbps)
          </button>
          <button
            type="button"
            onClick={() => setBand('s-band')}
            className={`px-3 py-1 rounded-md font-medium transition-all ${
              band === 's-band'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            S-BAND (2.2 GHz · 256 kbps)
          </button>
        </div>
      </div>

      {/* Destination Grid Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setDestination('earth')}
          className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
            destination === 'earth'
              ? 'bg-sky-950/40 border-sky-500 shadow-md ring-1 ring-sky-500/50'
              : 'bg-[#0D1322] border-[#1E293B] hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-sky-400 flex items-center gap-1.5">
              <Globe2 className="w-4 h-4" />
              EARTH (Geometric DSN Station Visibility Window)
            </span>
            <span className="text-[10px] font-mono text-slate-400">Direct-to-Earth</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-white tabular-nums">
              {owltEarthS.toFixed(3)}
            </span>
            <span className="text-xs font-mono text-sky-300">s OWLT</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            RTT: <strong className="text-slate-200">{(owltEarthS * 2).toFixed(3)}s</strong> · {distEarthKm.toLocaleString()} km
          </div>
          <div className="text-[10px] font-mono text-cyan-300 flex items-center justify-between">
            <span>Geometric DSN Window: {dsnVis.station?.name ?? 'Goldstone'} ({dsnVis.station?.primaryAntenna ?? 'DSS-14'})</span>
            <span className={dsnVis.lock ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
              {dsnVis.elevationDeg !== null ? `+${dsnVis.elevationDeg.toFixed(1)}°` : 'HORIZON'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDestination('iss')}
          className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
            destination === 'iss'
              ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
              : 'bg-[#0D1322] border-[#1E293B] hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-indigo-400 flex items-center gap-1.5">
              <Satellite className="w-4 h-4" />
              INTL SPACE STATION (ISS)
            </span>
            <span className="text-[10px] font-mono text-slate-400">LEO 420 km Alt</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-white tabular-nums">
              {owltIssRelayS.toFixed(3)}
            </span>
            <span className="text-xs font-mono text-indigo-300">s Relay</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            RTT: <strong className="text-slate-200">{(owltIssRelayS * 2).toFixed(3)}s</strong> (1.28s light + 0.25s TDRSS)
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDestination('gateway')}
          className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
            destination === 'gateway'
              ? 'bg-purple-950/40 border-purple-500 shadow-md ring-1 ring-purple-500/50'
              : 'bg-[#0D1322] border-[#1E293B] hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-purple-400 flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              ARTEMIS GATEWAY (NRHO)
            </span>
            <span className="text-[10px] font-mono text-slate-400">Lunar Orbit</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-bold text-white tabular-nums">
              {owltGatewayS.toFixed(3)}
            </span>
            <span className="text-xs font-mono text-purple-300">s OWLT</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            RTT: <strong className="text-slate-200">{(owltGatewayS * 2).toFixed(3)}s</strong> · Distance: 68,000 km
          </div>
        </button>
      </div>

      {/* Telemetry Channel Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0D1322] border border-[#1E293B] p-3.5 rounded-xl text-xs font-mono">
        <div>
          <span className="text-slate-400 text-[10px] uppercase block mb-1">Carrier Path Loss</span>
          <span className="text-white font-bold text-sm tabular-nums">-{fsplDb.toFixed(1)} dB</span>
          <span className="text-[10px] text-slate-500 block">Vacuum free-space</span>
        </div>
        <div>
          <span className="text-slate-400 text-[10px] uppercase block mb-1">Received Signal (RSSI)</span>
          <span
            className={`font-bold text-sm tabular-nums ${
              isLosBlocked ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {rssiDb} dBm
          </span>
          <span className="text-[10px] text-slate-500 block">
            {isLosBlocked ? 'Below noise floor' : '34m dish nominal'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 text-[10px] uppercase block mb-1">Link Margin</span>
          <span
            className={`font-bold text-sm tabular-nums ${
              linkMarginDb > 3 ? 'text-emerald-400' : linkMarginDb > 0 ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {linkMarginDb >= 0 ? '+' : ''}{linkMarginDb.toFixed(1)} dB
          </span>
          <span className="text-[10px] text-slate-500 block">Threshold: +3.0 dB</span>
        </div>
        <div>
          <span className="text-slate-400 text-[10px] uppercase block mb-1">Transmission Speed</span>
          <span className="text-cyan-400 font-bold text-sm tabular-nums">299,792 km/s</span>
          <span className="text-[10px] text-slate-500 block">Exact speed of light (c)</span>
        </div>
      </div>

      {/* Shannon-Hartley Capacity & Active Services */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#080C14] border border-[#1E293B] p-3 rounded-xl text-xs font-mono">
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#0F172A]/70">
          <div>
            <span className="text-slate-400 text-[10px] uppercase block">Shannon Capacity</span>
            <span className="text-white font-bold text-sm tabular-nums">
              {(budget.shannonCapacityBps / 1_000_000).toFixed(2)} Mbps
            </span>
          </div>
          <span className="text-[10px] text-cyan-400 font-mono">C = B·log₂(1+SNR)</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#0F172A]/70">
          <div>
            <span className="text-slate-400 text-[10px] uppercase block">Geometric DSN Station Visibility Window (Goldstone / Madrid / Canberra)</span>
            <span className="text-white font-bold text-sm">
              {dsnVis.station?.name ?? 'Goldstone'} {dsnVis.station?.primaryAntenna}
            </span>
          </div>
          <span className={`text-[10px] font-bold ${dsnVis.lock ? 'text-emerald-400' : 'text-amber-400'}`}>
            {dsnVis.lock ? '● LOCK' : '○ HANDOVER'}
          </span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#0F172A]/70">
          <div>
            <span className="text-slate-400 text-[10px] uppercase block">4K Hazard Video</span>
            <span className={`font-bold text-sm ${serviceRates[2]?.targetIsSustainable ? 'text-emerald-400' : 'text-amber-400'}`}>
              {serviceRates[2]?.targetIsSustainable ? '8.0 Mbps SUSTAINABLE' : 'RATE-LIMITED'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400">H.265 Stream</span>
        </div>
      </div>

      {/* Interactive Signal Transmission Simulator */}
      <div className="flex flex-col gap-3 p-4 rounded-xl bg-[#0D1322] border border-[#1E293B]">
        <div className="flex items-center justify-between">
          <label htmlFor="message-input" className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
            <Send className="w-3.5 h-3.5 text-cyan-400" />
            <span>Transmit Telemetry Packet from {siteName} ({spacecraftName})</span>
          </label>
          <span className="text-[11px] font-mono text-slate-400">
            Recipient: <strong className="text-cyan-300 uppercase">{destination}</strong>
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            id="message-input"
            type="text"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Type transmission packet payload..."
            className="flex-1 px-3.5 py-2 rounded-lg bg-[#070A10] border border-[#1E293B] focus:border-cyan-500 text-xs font-mono text-white placeholder-slate-600 outline-none"
          />
          <button
            type="button"
            onClick={handleTransmit}
            disabled={isTransmitting}
            className={`px-5 py-2 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all ${
              isTransmitting
                ? 'bg-cyan-900/40 text-cyan-300 border border-cyan-800/60 cursor-wait'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 active:scale-95'
            }`}
          >
            {isTransmitting ? (
              <>
                <Activity className="w-4 h-4 animate-spin text-cyan-400" />
                <span>PROPAGATING ({transmitProgress.toFixed(0)}%)...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-cyan-300" />
                <span>FIRE LASER / RADIO BEAM</span>
              </>
            )}
          </button>
        </div>

        {/* Real-Time Laser Propagation Beam Progress Bar */}
        {isTransmitting && (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300">
              <span>Traveling across vacuum: {((currentDistKm * transmitProgress) / 100).toLocaleString()} km</span>
              <span>Light Travel Time: {((currentOwltS * transmitProgress) / 100).toFixed(3)}s / {currentOwltS.toFixed(3)}s</span>
            </div>
            <div className="h-2 w-full bg-[#070A10] rounded-full overflow-hidden border border-[#1E293B]">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-amber-300 transition-all duration-75"
                style={{ width: `${transmitProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Transmission Result Ack Card */}
        {lastAck && !isTransmitting && (
          <div
            className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between gap-3 animate-in fade-in ${
              lastAck.status === 'ACK_SUCCESS'
                ? 'bg-emerald-950/40 border-emerald-800/70 text-emerald-200'
                : 'bg-rose-950/40 border-rose-800/70 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {lastAck.status === 'ACK_SUCCESS' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <div>
                <div className="font-bold">
                  {lastAck.status === 'ACK_SUCCESS'
                    ? `✓ TELEMETRY RECEIVED BY ${lastAck.dest}`
                    : `⚠️ LINK FAILURE: SIGNAL BLOCKED BY TERRAIN RIM`}
                </div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  One-Way Light Delay: <strong>{lastAck.owlt}</strong> · Round-Trip Ping (RTT): <strong>{lastAck.rtt}</strong> · Link Margin: {lastAck.margin}
                </div>
              </div>
            </div>
            <span className="text-[10px] opacity-60 tabular-nums shrink-0">{lastAck.timestamp}</span>
          </div>
        )}
      </div>
    </section>
  );
}

export default CommsRelayTab;
