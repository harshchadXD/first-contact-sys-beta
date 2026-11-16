import { useEffect, useMemo, useRef, useState } from 'react';
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
import { LUNAR_SITES, getSiteById, getSpacecraftById } from './science/lunarData';
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


export default function Workspace() {
  const [section, setSection] = useState('terrain');
  useEffect(() => { document.getElementById('workspace-title')?.focus(); }, []);
  const [siteId, setSiteId] = useState<string>('PGDA-01');
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
    mastHeightM: 3.0,
    missionDurationDays: 14,
    epochOffsetDays: 0,
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
      if (urlSite && getSiteById(urlSite)) {
        setSiteId(urlSite);
      }
      const urlCraft = params.get('craft');
      if (urlCraft === 'nova-c' || urlCraft === 'blue-ghost' || urlCraft === 'griffin') {
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
    setSiteId('PGDA-01');
    setSpacecraftId('nova-c');
    setSelectedCellIndex(NOMINAL_CELL_INDEX);
    setConstraints((prev) => ({
      ...prev,
      mastHeightM: 3.0,
      epochOffsetDays: 0,
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
    setParetoStatus('COMPUTING');
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

  return <div className="workspace" id="top">
    <header className="workspace-heading"><div><h1 id="workspace-title" tabIndex={-1}>Your lunar window.</h1><p>Explore a place. Change an assumption. Follow the light.</p></div><button onClick={handleExportCsv} className="workspace-export">Export current analysis ?</button></header>
    <div className="workspace-controls">
      <label>Location<select value={siteId} onChange={e => handleSiteChange(e.target.value)}>{LUNAR_SITES.map(site => <option key={site.metadata.siteId} value={site.metadata.siteId}>{site.metadata.name}</option>)}</select></label>
      <div className="workspace-playback"><button onClick={() => setIsPlaying(!isPlaying)} aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}>{isPlaying ? 'Pause' : 'Play'}</button><label>Mission hour <output>{clampedHour}</output><input aria-label="Mission hour" type="range" min="0" max={analysis.timeSeries.length - 1} value={clampedHour} onChange={e => { setIsPlaying(false); setActiveHourIndex(Number(e.target.value)); }}/></label><button onClick={() => { setIsPlaying(false); setActiveHourIndex(0); }}>Reset</button></div>
      <button onClick={handleToggleAudio} aria-pressed={!isAudioMuted}>Audio {isAudioMuted ? 'off' : 'on'}</button>
    </div>
    <div className="workspace-summary" aria-label="Current exploratory results"><div><span>Sun visible</span><strong>{summary.pSunPct.toFixed(1)}<small>%</small></strong></div><div><span>Earth visible</span><strong>{summary.pEarthPct.toFixed(1)}<small>%</small></strong></div><div><span>Longest darkness</span><strong>{summary.longestDarknessHrs.toFixed(1)}<small>h</small></strong></div><div><span>Selected slope</span><strong>{selectedCell.slopeDeg.toFixed(1)}<small>?</small></strong></div></div>
    <nav className="workspace-tabs" aria-label="Analysis views">{[['terrain','Landscape'],['time','Time & location'],['hardware','Assumptions'],['compare','Compare & export']].map(([id,label]) => <button key={id} aria-pressed={section === id} onClick={() => setSection(id)}>{label}</button>)}</nav>
    <main className="workspace-content">
      {searchError && <p role="status" className="workspace-caveat">{searchError}</p>}
      <p className="workspace-caveat">Exploratory model ? hardware values are illustrative ? Earth visibility does not certify a radio link. Display lighting is illustrative. This updated branch?s science is not independently validated.</p>
      {section === 'terrain' && <div className="landscape-view"><ThreeTerrainViewer site={activeSite} dispersionGrid={analysis.dispersionGrid} selectedCellIndex={selectedCellIndex} mastHeightM={constraints.mastHeightM} currentPoint={currentPoint} onSelectCell={setSelectedCellIndex} onSelectSite={handleSiteChange} showGisDrift={showGisDrift} onToggleGisDrift={() => setShowGisDrift(!showGisDrift)}/><HorizonPanorama2D site={activeSite} adjustedHorizonDeg={analysis.adjustedHorizonDeg} timeSeries={analysis.timeSeries} currentPoint={currentPoint} persona={persona} mastHeightM={constraints.mastHeightM}/></div>}
      {section === 'time' && <div className="analysis-pair"><DispersionGrid500m cells={analysis.dispersionGrid} selectedCellIndex={selectedCellIndex} spacecraft={activeSpacecraft} onSelectCell={setSelectedCellIndex}/><LaunchSlipMatrix launchSlip30d={analysis.launchSlip30d} timeSeries={analysis.timeSeries} activeHourIndex={clampedHour} constraints={constraints} onSelectEpochSlip={slip => handleUpdateConstraints({ epochOffsetDays: slip })} onSelectHour={h => { setIsPlaying(false); setActiveHourIndex(h); }}/></div>}
      {section === 'hardware' && <><HardwareProfileSelector selectedSpacecraftId={spacecraftId} constraints={constraints} onSelectSpacecraft={handleSelectSpacecraft} onUpdateConstraints={handleUpdateConstraints}/><details className="relay-details"><summary>Explore the illustrative communications model</summary><CommsRelayTab currentPoint={currentPoint} siteName={activeSite.metadata.name} spacecraftName={activeSpacecraft.name}/></details></>}
      {section === 'compare' && <><div className="repair-heading"><div><h2>Look for a different window.</h2><p>Search tested alternatives within the current model. Results are not a global optimum.</p></div><ParetoRepairDrawer status={paretoStatus} scenariosTested={paretoScenariosTested} feasibleTrajectories={paretoFeasibleTrajectories} computeTimeMs={paretoComputeTimeMs} candidates={paretoCandidates} onRunSolver={handleRunParetoSolver} onApplyRepair={handleApplyRepair}/></div><ComparisonWorkspace rankings={paretoRankings} activeSiteId={siteId} weights={weights} analysis={analysis} onSelectSite={handleSiteChange} onUpdateWeights={setWeights} onExportCsv={handleExportCsv}/></>}
    </main>
    <footer className="workspace-footer"><span>FIRST CONTACT.sys / Research explorer</span><button onClick={() => setIsHelpOpen(true)}>Keyboard shortcuts</button><button onClick={() => setPersona(persona === 'planner' ? 'educator' : 'planner')}>{persona === 'planner' ? 'Switch to guided labels' : 'Switch to technical labels'}</button></footer>
    <HelpKeybindingsModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} persona={persona} onTogglePersona={() => setPersona(persona === 'planner' ? 'educator' : 'planner')}/>
  </div>;
}
