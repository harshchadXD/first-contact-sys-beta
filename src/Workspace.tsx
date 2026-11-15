import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Keyboard,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CommsRelayTab } from './components/CommsRelayTab';
import { ComparisonWorkspace } from './components/ComparisonWorkspace';
import { DispersionGrid500m } from './components/DispersionGrid500m';
import { HardwareProfileSelector } from './components/HardwareProfileSelector';
import { HorizonPanorama2D } from './components/HorizonPanorama2D';
import { LaunchSlipMatrix } from './components/LaunchSlipMatrix';
import { ThreeTerrainViewer } from './components/ThreeTerrainViewer';
import { HelpKeybindingsModal } from './components/HelpKeybindingsModal';
import {
  ParetoRepairDrawer,
  type ParetoRepairCandidate,
  type ParetoRepairStatus,
} from './components/ParetoRepairDrawer';
import type { RepairCandidate, RepairSearchResult } from './services/repairSearch.worker';
import { quindar } from './services/quindarAudio';
import { analyzeWithWasm, type AnalysisResponse } from './services/wasmEngineBridge';
import {
  DEFAULT_SITE_ID,
  LUNAR_SITES,
  findSiteById,
  getSiteById,
  getSpacecraftById,
} from './science/lunarData';
import { OPS_EPOCH_MS } from './science/ephemeris';
import {
  buildAnalysisCsv,
  computeParetoSiteRankings,
  runSiteAnalysis,
} from './science/physicsEngine';
import type {
  PersonaMode,
  SolverConstraints,
  SpacecraftProfile,
  WeightConfig,
} from './science/types';

const NOMINAL_CELL_INDEX = 12; // (dx=0, dy=0)
const DEFAULT_MAST_HEIGHT_M = 3.0;
const DEFAULT_ARRIVAL_SLIP_DAYS = 16;

type WorkspaceSection = 'terrain' | 'time' | 'hardware' | 'compare';

const SECTIONS: Array<{ id: WorkspaceSection; index: string; label: string; note: string }> = [
  { id: 'terrain', index: '01', label: 'Landscape', note: 'Surface & skyline' },
  { id: 'time', index: '02', label: 'Time & place', note: 'Arrival & offset' },
  { id: 'hardware', index: '03', label: 'Assumptions', note: 'Craft & model' },
  { id: 'compare', index: '04', label: 'Compare & export', note: 'Tested alternatives' },
];

export default function Workspace({ onExit, initialSection = 'terrain' }: {
  onExit?: () => void;
  initialSection?: WorkspaceSection;
}) {
  const [section, setSection] = useState<WorkspaceSection>(initialSection);
  useEffect(() => { document.getElementById('workspace-title')?.focus(); }, []);
  const [siteId, setSiteId] = useState<string>(DEFAULT_SITE_ID);
  const [spacecraftId, setSpacecraftId] =
    useState<SpacecraftProfile['id']>('nova-c');
  const [selectedCellIndex, setSelectedCellIndex] =
    useState<number>(NOMINAL_CELL_INDEX);
  const [persona, setPersona] = useState<PersonaMode>('planner');
  const [activeHourIndex, setActiveHourIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [showGisDrift, setShowGisDrift] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(() => quindar.getMuted());

  const [constraints, setConstraints] = useState<SolverConstraints>({
    maxDarknessHrs: 24,
    minCommsWindowHrs: 6,
    mastHeightM: DEFAULT_MAST_HEIGHT_M,
    missionDurationDays: 14,
    epochOffsetDays: DEFAULT_ARRIVAL_SLIP_DAYS,
  });

  const [weights, setWeights] = useState<WeightConfig>({
    sun: 0.45,
    earth: 0.35,
    terrain: 0.2,
  });

  const [paretoStatus, setParetoStatus] = useState<ParetoRepairStatus>('IDLE');
  const [paretoScenariosTested, setParetoScenariosTested] = useState<number>(0);
  const [paretoFeasibleTrajectories, setParetoFeasibleTrajectories] = useState<number>(0);
  const [paretoComputeTimeMs, setParetoComputeTimeMs] = useState<number>(0);
  const [paretoCandidates, setParetoCandidates] = useState<
    (ParetoRepairCandidate & { raw?: RepairCandidate })[]
  >([]);

  const activeSite = useMemo(() => getSiteById(siteId), [siteId]);
  const activeSpacecraft = useMemo(
    () => getSpacecraftById(spacecraftId),
    [spacecraftId]
  );

  const analysis = useMemo(
    () =>
      runSiteAnalysis(
        activeSite,
        activeSpacecraft,
        constraints,
        selectedCellIndex,
        weights
      ),
    [activeSite, activeSpacecraft, constraints, selectedCellIndex, weights]
  );

  const [wasmState, setWasmState] = useState<{
    status: 'IDLE' | 'COMPUTING' | 'VERIFIED' | 'UNAVAILABLE';
    result?: AnalysisResponse;
    computeTimeMs?: number;
  }>({ status: 'IDLE' });

  // Direct Rust WASM Kernel (Zero-Copy DE421 Ephemeris) integration
  useEffect(() => {
    let cancelled = false;
    const t0 = performance.now();
    setWasmState((prev) => ({ ...prev, status: 'COMPUTING' }));

    const cell = analysis.dispersionGrid[selectedCellIndex] ?? analysis.selectedCell;

    analyzeWithWasm({
      site: activeSite,
      dispersion_offset_m: { x: cell.dxM, y: cell.dyM },
      arrival_day: constraints.epochOffsetDays,
      mast_height_m: constraints.mastHeightM,
      battery_capacity_wh: activeSpacecraft.batteryCapacityKwh * 1000,
      hotel_load_w: activeSpacecraft.hotelLoadW,
      slope_threshold_deg: activeSpacecraft.maxSlopeDeg,
      duration_days: constraints.missionDurationDays,
    })
      .then((res) => {
        if (!cancelled) {
          const t1 = performance.now();
          setWasmState({
            status: 'VERIFIED',
            result: res,
            computeTimeMs: Math.max(1, Math.round(t1 - t0)),
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('WASM analysis note:', err);
          setWasmState({ status: 'UNAVAILABLE' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeSite,
    activeSpacecraft,
    constraints.epochOffsetDays,
    constraints.mastHeightM,
    constraints.missionDurationDays,
    selectedCellIndex,
    analysis.dispersionGrid,
    analysis.selectedCell,
  ]);

  const paretoRankings = useMemo(
    () => computeParetoSiteRankings(activeSpacecraft, constraints, weights),
    [activeSpacecraft, constraints, weights]
  );

  const clampedHour = Math.min(
    activeHourIndex,
    Math.max(0, analysis.timeSeries.length - 1)
  );
  const currentPoint = analysis.timeSeries[clampedHour] ?? analysis.timeSeries[0];


  // Timeline playback loop (advances 2 hours every 150ms when playing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open], [role=dialog][aria-modal=true]')) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, button, a, [contenteditable]')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === '[' || e.key === '{') {
        setIsPlaying(false);
        setActiveHourIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === ']' || e.key === '}') {
        setIsPlaying(false);
        setActiveHourIndex((prev) => Math.min(analysis.timeSeries.length - 1, prev + 1));
      } else if (e.key === 'm' || e.key === 'M') {
        setPersona((prev) => (prev === 'planner' ? 'educator' : 'planner'));
      } else if (e.key === 'r' || e.key === 'R') {
        handleResetNominal();
      } else if (e.key === '?' || e.key === 'h' || e.key === 'H') {
        setIsHelpOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [analysis.timeSeries.length]);

  useEffect(() => {
    if (!isPlaying) return;
    const maxHour = Math.max(1, analysis.timeSeries.length - 1);
    const id = window.setInterval(() => {
      setActiveHourIndex((prev) => (prev + 2 > maxHour ? 0 : prev + 2));
    }, 150);
    return () => window.clearInterval(id);
  }, [isPlaying, analysis.timeSeries.length]);

  // 1. Initial URL query string parameter hydration
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlSite = params.get('site');
      if (urlSite && findSiteById(urlSite)) {
        setSiteId(urlSite);
      }
      const urlCraft = params.get('craft');
      if (urlCraft === 'nova-c' || urlCraft === 'blue-ghost' || urlCraft === 'griffin' || urlCraft === 'vikram') {
        setSpacecraftId(urlCraft as SpacecraftProfile['id']);
      }
      const urlMast = params.get('mast');
      if (urlMast) {
        const m = parseFloat(urlMast);
        if (!isNaN(m) && m >= 0.5 && m <= 10.0) {
          setConstraints((prev) => ({ ...prev, mastHeightM: m }));
        }
      }
      const urlCell = params.get('cell');
      if (urlCell) {
        const c = parseInt(urlCell, 10);
        if (!isNaN(c) && c >= 0 && c <= 24) {
          setSelectedCellIndex(c);
        }
      }
      const urlHour = params.get('hour');
      if (urlHour) {
        const h = parseInt(urlHour, 10);
        if (!isNaN(h) && h >= 0) {
          setActiveHourIndex(h);
        }
      }
    } catch {}
  }, []);

  // 2. Synchronize active state into URL query string for instant sharability
  useEffect(() => {
    try {
      const params = new URLSearchParams();
      params.set('site', siteId);
      params.set('craft', spacecraftId);
      params.set('mast', constraints.mastHeightM.toFixed(1));
      params.set('cell', String(selectedCellIndex));
      if (clampedHour > 0) {
        params.set('hour', String(clampedHour));
      }
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
    } catch {}
  }, [siteId, spacecraftId, constraints.mastHeightM, selectedCellIndex, clampedHour]);

  // 3. Procedural Quindar Sound Effects & Cold Trap Telemetry
  const prevEarthVisibleRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (prevEarthVisibleRef.current !== null && currentPoint) {
      if (!prevEarthVisibleRef.current && currentPoint.earthVisible) {
        quindar.playQuindar('intro'); // 2,525 Hz Apollo acquisition tone
      } else if (prevEarthVisibleRef.current && !currentPoint.earthVisible) {
        quindar.playQuindar('outro'); // 2,475 Hz Apollo loss tone
      }
    }
    prevEarthVisibleRef.current = currentPoint?.earthVisible ?? false;
  }, [currentPoint?.earthVisible]);

  useEffect(() => {
    const isDeepInDarkness = (currentPoint?.sunFraction ?? 1) === 0 && clampedHour > 4;
    quindar.updateColdTrapHum(isDeepInDarkness);
  }, [currentPoint?.sunFraction, clampedHour]);

  const handleToggleAudio = () => {
    const nextMuted = quindar.toggleMute();
    setIsAudioMuted(nextMuted);
  };

  const handleSiteChange = (nextSiteId: string) => {
    setSiteId(nextSiteId);
    setSelectedCellIndex(NOMINAL_CELL_INDEX);
    setActiveHourIndex(0);
    setIsPlaying(false);
  };

  const handleSelectSpacecraft = (id: SpacecraftProfile['id']) => {
    const profile = getSpacecraftById(id);
    setSpacecraftId(id);
    setConstraints((prev) => ({
      ...prev,
      mastHeightM: profile.defaultMastM,
    }));
  };

  const handleUpdateConstraints = (patch: Partial<SolverConstraints>) => {
    setConstraints((prev) => ({ ...prev, ...patch }));
  };

  const handleResetNominal = () => {
    setSiteId(DEFAULT_SITE_ID);
    setSpacecraftId('nova-c');
    setSelectedCellIndex(NOMINAL_CELL_INDEX);
    setConstraints((prev) => ({
      ...prev,
      mastHeightM: DEFAULT_MAST_HEIGHT_M,
      epochOffsetDays: DEFAULT_ARRIVAL_SLIP_DAYS,
    }));
    setActiveHourIndex(0);
    setIsPlaying(false);
  };

  const handleExportCsv = () => {
    const csv = buildAnalysisCsv(analysis);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `first-contact-${analysis.site.siteId.toLowerCase()}-dx${analysis.selectedCell.dxM}-dy${analysis.selectedCell.dyM}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const [searchError, setSearchError] = useState('');
  const failSearch = () => {
    setParetoCandidates([]);
    setParetoStatus('IDLE');
    setSearchError('Search unavailable. No alternatives were generated. Please retry.');
  };
  const handleRunParetoSolver = () => {
    setSearchError('');
    setParetoCandidates([]);
    setParetoScenariosTested(0);
    setParetoFeasibleTrajectories(0);
    setParetoComputeTimeMs(0);
    setParetoStatus('COMPUTING (WASM)');
    try {
      const worker = new Worker(
        new URL('./services/repairSearch.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (e: MessageEvent<RepairSearchResult | { error?: string }>) => {
        if ('error' in e.data && e.data.error) {
          console.warn('WASM worker reported error, search unavailable:', e.data.error);
          failSearch();
          worker.terminate();
          return;
        }

        const data = e.data as RepairSearchResult;

        setParetoScenariosTested(data.tested);
        setParetoFeasibleTrajectories(data.feasibleCount);
        setParetoComputeTimeMs(Math.round(data.durationMs));

        const formatted: (ParetoRepairCandidate & { raw?: RepairCandidate })[] = data.frontier.slice(0, 8).map((c, i) => ({
          id: `cand-${i}-${c.arrivalDay}-${c.mastHeightM}m`,
          title: `Trajectory Option ${String.fromCharCode(65 + i)}: +${c.arrivalDay}d Slip, ${c.mastHeightM.toFixed(1)}m Mast (${c.dxM >= 0 ? '+' : ''}${c.dxM}m E, ${c.dyM >= 0 ? '+' : ''}${c.dyM}m N)`,
          impacts: [
            {
              label: 'Shadow',
              value: `${c.continuousShadowDurationH.toFixed(1)}h max dark`,
              tone: c.continuousShadowDurationH <= 12 ? 'emerald' : 'amber',
            },
            {
              label: 'Min Battery',
              value: `${c.minimumBatteryWh.toFixed(0)} Wh (model)`,
              tone: 'emerald',
            },
            {
              label: 'Slope',
              value: `${c.slopeDeg.toFixed(1)}° (Terrain Pass)`,
              tone: 'cyan',
            },
            {
              label: 'Comms',
              value: 'Not evaluated in this search',
              tone: 'cyan',
            },
          ],
          raw: c,
        }));

        setParetoCandidates(formatted);
        setParetoStatus('OPTIMIZED');
        if (!data.frontier.length) setSearchError('No tested alternatives met the search constraints. Try changing the assumptions.');
        worker.terminate();
      };

      worker.onerror = (err) => {
        console.warn('Worker thread error, search unavailable:', err);
        failSearch();
        worker.terminate();
      };

      const batteryCapacityWh = activeSpacecraft.batteryCapacityKwh * 1000;
      worker.postMessage({
        site: activeSite,
        arrivalDayWindow: { startDay: 0, endDay: 30 },
        batteryCapacityWh,
        hotelLoadW: activeSpacecraft.hotelLoadW,
        slopeThresholdDeg: activeSpacecraft.maxSlopeDeg,
        batteryReserveWh: batteryCapacityWh * 0.15,
        durationDays: constraints.missionDurationDays,
      });
    } catch (err) {
      console.warn('Worker instantiation failed, search unavailable:', err);
      failSearch();
    }
  };

  const handleApplyRepair = (candidate: ParetoRepairCandidate) => {
    const matched = paretoCandidates.find((c) => c.id === candidate.id);
    if (matched?.raw) {
      const { dxM, dyM, arrivalDay, mastHeightM } = matched.raw;
      handleUpdateConstraints({
        mastHeightM,
        epochOffsetDays: arrivalDay,
      });
      const col = Math.max(0, Math.min(4, Math.round((dxM + 200) / 100)));
      const row = Math.max(0, Math.min(4, Math.round((dyM + 200) / 100)));
      setSelectedCellIndex(row * 5 + col);
    }
  };

  const { summary, selectedCell } = analysis;
  const meta = activeSite.metadata;
  const lat = `${Math.abs(meta.latDeg).toFixed(4)}° S`;
  const lon = `${Math.abs(meta.lonDeg).toFixed(4)}° ${meta.lonDeg >= 0 ? 'E' : 'W'}`;
  const lastHour = Math.max(0, analysis.timeSeries.length - 1);
  const arrivalDate = new Date(
    OPS_EPOCH_MS + constraints.epochOffsetDays * 86_400_000
  ).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const currentUtc = currentPoint
    ? new Date(currentPoint.timestampUtc).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        hour12: false,
      })
    : '—';
  const isSynthetic = meta.terrainFidelity === 'synthetic';
  const kernelLabel =
    wasmState.status === 'VERIFIED'
      ? 'WASM active'
      : wasmState.status === 'COMPUTING'
        ? 'Computing'
        : wasmState.status === 'UNAVAILABLE'
          ? 'Local fallback'
          : 'Local model';

  return (
    <div className="workspace" id="top">
      <header className="ws-topbar">
        <button className="ws-back" onClick={onExit} aria-label="Back to the cover">
          <ArrowLeft size={15} aria-hidden="true" />
          <span>Cover</span>
        </button>
        <span className="ws-brand">
          <BrandMark />
          FIRST CONTACT<span className="sys">.sys</span>
          <em>Observatory</em>
        </span>
        <div className="ws-top-actions">
          <span className={`ws-kernel ws-kernel--${wasmState.status.toLowerCase()}`}>
            <i aria-hidden="true" />
            {kernelLabel}
          </span>
          <button onClick={() => setIsHelpOpen(true)} aria-label="Keyboard shortcuts">
            <Keyboard size={15} aria-hidden="true" />
            <span>Keys</span>
          </button>
          <button onClick={handleExportCsv} className="ws-export">
            <Download size={15} aria-hidden="true" />
            <span>Export <em>.csv</em></span>
          </button>
        </div>
      </header>

      <section className="ws-intro" aria-labelledby="workspace-title">
        <div className="ws-intro-main">
          <p className="eyebrow">
            Lunar south pole <span aria-hidden="true">/</span> {meta.siteId}
          </p>
          <h1 id="workspace-title" tabIndex={-1}>
            {meta.shortName}
          </h1>
          <p className="ws-context">{meta.missionContext}</p>
          <p className={`ws-data-note${isSynthetic ? ' is-synthetic' : ''}`}>
            {isSynthetic
              ? 'SYNTHETIC CALIBRATION · no LOLA terrain · real DE421 sky'
              : `REAL LOLA TERRAIN · ${meta.demSource}`}
            {meta.nearestPsrKm !== null && meta.nearestPsrKm !== undefined
              ? ` · nearest published PSR ${meta.nearestPsrKm.toFixed(2)} km`
              : ' · PSR distance unavailable outside the published 80°S product'}
          </p>
        </div>
        <dl className="ws-facts">
          <div>
            <dt>Position</dt>
            <dd>{lat}<br />{lon}</dd>
          </div>
          <div>
            <dt>Surface</dt>
            <dd>{meta.elevationM.toFixed(0)} m<br /><span>ref. sphere</span></dd>
          </div>
          <div>
            <dt>Slope at cell</dt>
            <dd>{selectedCell.slopeDeg.toFixed(1)}°<br /><span>{selectedCell.dxM >= 0 ? '+' : ''}{selectedCell.dxM} m E / {selectedCell.dyM >= 0 ? '+' : ''}{selectedCell.dyM} m N</span></dd>
          </div>
          <div>
            <dt>Arrival</dt>
            <dd>{arrivalDate}<br /><span>UTC · slip +{constraints.epochOffsetDays} d</span></dd>
          </div>
          <div>
            <dt>Data</dt>
            <dd>{isSynthetic ? 'Synthetic plane' : `LOLA ${meta.pixelSizeM ?? '—'} m/px`}<br /><span>{isSynthetic ? 'calibration only' : 'DE421 baked series'}</span></dd>
          </div>
        </dl>
      </section>

      <section className="ws-controls" aria-label="Scenario controls">
        <label className="ws-field">
          <span className="ws-label">Study site</span>
          <select value={siteId} onChange={(e) => handleSiteChange(e.target.value)}>
            <optgroup label="Real LOLA sites (14)">
              {LUNAR_SITES.filter((site) => site.metadata.terrainFidelity !== 'synthetic').map((site) => (
                <option key={site.metadata.siteId} value={site.metadata.siteId}>
                  {site.metadata.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Synthetic calibration (excluded from ranking)">
              {LUNAR_SITES.filter((site) => site.metadata.terrainFidelity === 'synthetic').map((site) => (
                <option key={site.metadata.siteId} value={site.metadata.siteId}>
                  {site.metadata.name} — calibration only
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <div className="ws-playback">
          <button
            className="ws-play"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
            aria-pressed={isPlaying}
          >
            {isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </button>
          <label className="ws-timeline">
            <span className="ws-label">
              Mission hour
              <output>{clampedHour}<em> / {lastHour}</em></output>
            </span>
            <span className="ws-time-stamp">{currentUtc} UTC</span>
            <input
              aria-label="Mission hour"
              type="range"
              min="0"
              max={lastHour}
              value={clampedHour}
              onChange={(e) => {
                setIsPlaying(false);
                setActiveHourIndex(Number(e.target.value));
              }}
            />
          </label>
          <button
            className="ws-quiet"
            onClick={() => {
              setIsPlaying(false);
              setActiveHourIndex(0);
            }}
            aria-label="Reset mission hour"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>

        <button
          className="ws-quiet ws-audio"
          onClick={handleToggleAudio}
          aria-pressed={!isAudioMuted}
          aria-label={isAudioMuted ? 'Turn ambience on' : 'Turn ambience off'}
        >
          {isAudioMuted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
          <span>Audio {isAudioMuted ? 'off' : 'on'}</span>
        </button>
      </section>

      <section className="ws-metrics" aria-label="Current exploratory results">
        <article>
          <span className="ws-metric-label">Sun visible</span>
          <strong>{summary.pSunPct.toFixed(1)}<small>%</small></strong>
          <span className="ws-metric-note">of sampled mission hours</span>
        </article>
        <article>
          <span className="ws-metric-label">Earth visible</span>
          <strong>{summary.pEarthPct.toFixed(1)}<small>%</small></strong>
          <span className="ws-metric-note">geometric disc, not RF link</span>
        </article>
        <article>
          <span className="ws-metric-label">Sun and Earth together</span>
          <strong>{summary.pSimultaneousPct.toFixed(1)}<small>%</small></strong>
          <span className="ws-metric-note">direct view, same hour</span>
        </article>
        <article>
          <span className="ws-metric-label">Longest darkness</span>
          <strong>{summary.longestDarknessHrs.toFixed(1)}<small>h</small></strong>
          <span className="ws-metric-note">continuous, at this cell</span>
        </article>
      </section>

      <nav className="ws-tabs" aria-label="Analysis views">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            aria-pressed={section === item.id}
            onClick={() => setSection(item.id)}
          >
            <span className="ws-tab-index">{item.index}</span>
            <span className="ws-tab-label">{item.label}</span>
            <span className="ws-tab-note">{item.note}</span>
          </button>
        ))}
      </nav>

      <main className="ws-content">
        {searchError && <p role="status" className="ws-search-error">{searchError}</p>}
        <p className="ws-caveat">
          <strong>Read this as exploration.</strong> Hardware values are illustrative assumptions,
          Earth-disc visibility is geometric and does not certify a radio link, and display lighting is
          illustrative. Results are tested candidates within this model — not a global optimum.
        </p>

        {section === 'terrain' && (
          <div className="landscape-view">
            <ThreeTerrainViewer
              site={activeSite}
              dispersionGrid={analysis.dispersionGrid}
              selectedCellIndex={selectedCellIndex}
              mastHeightM={constraints.mastHeightM}
              currentPoint={currentPoint}
              onSelectCell={setSelectedCellIndex}
              onSelectSite={handleSiteChange}
              showGisDrift={showGisDrift}
              onToggleGisDrift={() => setShowGisDrift(!showGisDrift)}
            />
            <HorizonPanorama2D
              site={activeSite}
              adjustedHorizonDeg={analysis.adjustedHorizonDeg}
              timeSeries={analysis.timeSeries}
              currentPoint={currentPoint}
              persona={persona}
              mastHeightM={constraints.mastHeightM}
            />
          </div>
        )}

        {section === 'time' && (
          <div className="analysis-pair">
            <DispersionGrid500m
              cells={analysis.dispersionGrid}
              selectedCellIndex={selectedCellIndex}
              spacecraft={activeSpacecraft}
              onSelectCell={setSelectedCellIndex}
            />
            <LaunchSlipMatrix
              launchSlip30d={analysis.launchSlip30d}
              timeSeries={analysis.timeSeries}
              activeHourIndex={clampedHour}
              constraints={constraints}
              onSelectEpochSlip={(slip) => handleUpdateConstraints({ epochOffsetDays: slip })}
              onSelectHour={(h) => {
                setIsPlaying(false);
                setActiveHourIndex(h);
              }}
            />
          </div>
        )}

        {section === 'hardware' && (
          <>
            <HardwareProfileSelector
              selectedSpacecraftId={spacecraftId}
              constraints={constraints}
              onSelectSpacecraft={handleSelectSpacecraft}
              onUpdateConstraints={handleUpdateConstraints}
            />
            <details className="relay-details">
              <summary>Explore the illustrative communications model</summary>
              <CommsRelayTab
                currentPoint={currentPoint}
                siteName={meta.name}
                spacecraftName={activeSpacecraft.name}
              />
            </details>
          </>
        )}

        {section === 'compare' && (
          <>
            <div className="repair-heading">
              <div>
                <p className="eyebrow">Tested alternatives</p>
                <h2>Look for a different window.</h2>
                <p>Search tested alternatives within the current model. Results are not a global optimum.</p>
              </div>
              <ParetoRepairDrawer
                status={paretoStatus}
                scenariosTested={paretoScenariosTested}
                feasibleTrajectories={paretoFeasibleTrajectories}
                computeTimeMs={paretoComputeTimeMs}
                candidates={paretoCandidates}
                onRunSolver={handleRunParetoSolver}
                onApplyRepair={handleApplyRepair}
              />
            </div>
            <ComparisonWorkspace
              rankings={paretoRankings}
              activeSiteId={siteId}
              weights={weights}
              analysis={analysis}
              onSelectSite={handleSiteChange}
              onUpdateWeights={setWeights}
              onExportCsv={handleExportCsv}
            />
          </>
        )}
      </main>

      <footer className="ws-footer">
        <span>FIRST CONTACT.sys / Research explorer</span>
        <span className="ws-footer-source">
          {isSynthetic ? 'SYNTHETIC TERRAIN' : 'NASA LRO / LOLA'} · JPL DE421 · {meta.demSource}
        </span>
        <button onClick={() => setIsHelpOpen(true)}>Keyboard shortcuts</button>
        <button onClick={() => setPersona(persona === 'planner' ? 'educator' : 'planner')}>
          {persona === 'planner' ? 'Switch to guided labels' : 'Switch to technical labels'}
        </button>
      </footer>

      <HelpKeybindingsModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        persona={persona}
        onTogglePersona={() => setPersona(persona === 'planner' ? 'educator' : 'planner')}
      />
    </div>
  );
}

function BrandMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M1 21 10 6v15ZM13 21V2l10 6v13Z" />
    </svg>
  );
}

