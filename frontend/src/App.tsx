<<<<<<< HEAD
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import HeaderAdamBridge from "./components/HeaderAdamBridge";
import HardwareProfileSelector from "./components/HardwareProfileSelector";
import DispersionGrid500m from "./components/DispersionGrid500m";
import HorizonPanorama2D from "./components/HorizonPanorama2D";
import LaunchSlipMatrix from "./components/LaunchSlipMatrix";
const ThreeTerrainViewer = lazy(() => import("./components/ThreeTerrainViewer"));
import GMParameterPanel from "./components/GMParameterPanel";
import { loadEngineBundle, runScenario } from "./services/missionEngine";
import type { EngineBundle } from "./services/missionEngine";
import type { DispersionCell, GMReference, GMValues, LunarSite, MissionResult, MissionSettings } from "./types";

type Persona = "PLANNER" | "EDUCATOR";
const profileNames = ["Nova-C", "Griffin", "Blue Ghost", "Vikram"];
const initialSettings: MissionSettings = { profileIndex: 0, mastM: 1.5, hotelLoadW: 120, initialSoc: 0.8 };

export default function App() {
  const [site, setSite] = useState<LunarSite | null>(null);
  const [bundle, setBundle] = useState<EngineBundle | null>(null);
  const [result, setResult] = useState<MissionResult | null>(null);
  const [baseline, setBaseline] = useState<MissionResult | null>(null);
  const [reference, setReference] = useState<GMReference | null>(null);
  const [gms, setGms] = useState<GMValues>({});
  const [settings, setSettings] = useState<MissionSettings>(() => readStorage("fc-mission-settings", initialSettings));
  const [persona, setPersona] = useState<Persona>(() => readStorage("fc-persona", "PLANNER"));
  const [timeIndex, setTimeIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState<DispersionCell | null>(null);
  const [selectedSlip, setSelectedSlip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scenarioApplied, setScenarioApplied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [siteData, gmRef] = await Promise.all([
          fetch("/data/baked_lunar_sites.json").then((r) => { if (!r.ok) throw new Error("Could not load lunar site data"); return r.json(); }),
          fetch("/data/gravitational_parameters_de421.json").then((r) => { if (!r.ok) throw new Error("Could not load DE421 GM reference"); return r.json(); }),
        ]);
        if (!alive) return;
        const loadedSites = (siteData.sites ?? []) as LunarSite[];
        const real = loadedSites.find((s) => s.site_metadata.site_id === "PGDA-Site04-Shackleton");
        const selected = real ?? loadedSites[0];
        if (!selected) throw new Error("No site records are available");
        setSite(selected); setReference(gmRef);
        const defaults = Object.fromEntries(gmRef.bodies.filter((b: { id: string }) => b.id !== "earth_moon").map((b: { id: string; gm_km3_s2: number }) => [b.id, b.gm_km3_s2]));
        const savedGms = readStorage<GMValues | null>("fc-gm-values", null);
        setGms(savedGms ? { ...defaults, ...savedGms } : defaults);
        if (selected.site_metadata.site_id !== "PGDA-Site04-Shackleton") {
          setMessage("Official PGDA Site04 bake is unavailable; synthetic fallback is shown with no mission prediction.");
          return;
        }
        const engineBundle = await loadEngineBundle(selected, setMessage);
        if (!alive) { engineBundle.engine.free(); return; }
        setBundle(engineBundle); setBaseline(engineBundle.baseline);
        setSelectedCell(selected.dispersion_grid_5x5.find((c) => c.dx_m === 0 && c.dy_m === 0) ?? selected.dispersion_grid_5x5[12]);
        const initial = runScenario(engineBundle, savedGms ? { ...defaults, ...savedGms } : defaults, settings);
        setResult(initial.result); setBaseline(initial.baseline); setScenarioApplied(true);
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : "Mission console initialization failed"); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  // Boot once; data and local settings initialize the console.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { localStorage.setItem("fc-persona", JSON.stringify(persona)); }, [persona]);
  useEffect(() => { localStorage.setItem("fc-mission-settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => () => { bundle?.engine.free(); }, [bundle]);

  const run = useCallback(() => {
    if (!bundle) return;
    setBusy(true); setError(""); setMessage("Propagating edited GM set from DE421 initial state…");
    window.setTimeout(() => {
      try {
        const next = runScenario(bundle, gms, settings);
        setResult(next.result); setBaseline(next.baseline); setScenarioApplied(true); setTimeIndex((i) => Math.min(i, next.result.timeline.length - 1));
        setMessage("Scenario propagated · baseline retained · mission timeline refreshed.");
      } catch (e) { setError(e instanceof Error ? e.message : "Scenario propagation failed"); }
      finally { setBusy(false); }
    }, 16);
  }, [bundle, gms, settings]);

  const active = result?.timeline[Math.min(timeIndex, Math.max(0, (result?.timeline.length ?? 1) - 1))];
  const cells = site?.dispersion_grid_5x5 ?? [];
  const offsets = useMemo(() => [...cells].sort((a, b) => scoreCell(b) - scoreCell(a)), [cells]);
  const replay = () => {
    const worst = offsets.find((c) => c.status === "MISSION_LOSS_TRAP") ?? offsets[0];
    if (worst) setSelectedCell(worst);
    setSettings((s) => ({ ...s, mastM: 1 })); setPersona("EDUCATOR");
    setMessage("Off-nominal terrain replay selected. This is a modeled offset case, not a reconstruction of flight telemetry.");
  };
  const updateGm = (id: string, value: number) => { setGms((prev) => ({ ...prev, [id]: value })); setSaved(false); };
  const saveGms = () => { localStorage.setItem("fc-gm-values", JSON.stringify(gms)); setSaved(true); setMessage("GM scenario saved on this device."); };
  const restoreGms = () => { if (!reference) return; setGms(Object.fromEntries(reference.bodies.filter((b) => b.id !== "earth_moon").map((b) => [b.id, b.gm_km3_s2]))); setSaved(false); };
  const changeProfile = (index: number) => { setSettings((s) => ({ ...s, profileIndex: index, hotelLoadW: [120, 280, 160, 100][index] })); };

  const solarPct = result?.metrics[0] ?? 0, earthPct = result?.metrics[1] ?? 0, simultaneousPct = result?.metrics[2] ?? 0;
  const survive = (result?.metrics[7] ?? 0) > 0.5;

  return <div className="console-shell">
    <HeaderAdamBridge persona={persona} onPersona={setPersona} onReplay={replay} time={timeIndex} maxTime={result?.timeline.length ?? 1} onTime={setTimeIndex} />
    <main className="console-main">
      <div className="title-row"><div><div className="breadcrumb">MISSION ANALYSIS <span>/</span> SOUTH POLE <span>/</span> {site?.site_metadata.site_id ?? "SITE DATA"}</div><h1>{site?.site_metadata.name ?? "Lunar Site Navigator"}<span> / {site?.site_metadata.site_id}</span></h1><p>Illumination, communications, terrain risk and power survival in one planning loop.</p></div><div className="title-actions"><span className={`mode-badge ${scenarioApplied ? "live" : ""}`}><i />{scenarioApplied ? "SIMULATION LIVE" : "BASELINE MODE"}</span><button className="run-button" onClick={run} disabled={!bundle || busy}>{busy ? <><i className="spinner" /> PROPAGATING</> : "RUN GM SCENARIO ↗"}</button></div></div>
      {(message || error) && <div className={`notice ${error ? "notice-error" : ""}`}><span>{error ? "!" : "i"}</span>{error || message}<button onClick={() => { setError(""); setMessage(""); }} aria-label="Dismiss notice">×</button></div>}
      <div className="telemetry-strip">
        <Metric label="SUN ACCESS" value={result ? `${solarPct.toFixed(1)}%` : "—"} detail={baseline ? `${signed(solarPct - baseline.metrics[0])} pp vs DE421` : "MISSION TIMELINE"} tone="gold" />
        <Metric label="EARTH VISIBILITY" value={result ? `${earthPct.toFixed(1)}%` : "—"} detail={baseline ? `${signed(earthPct - baseline.metrics[1])} pp vs DE421` : "GEOMETRIC LINE OF SIGHT"} tone="cyan" />
        <Metric label="JOINT WINDOW" value={result ? `${simultaneousPct.toFixed(1)}%` : "—"} detail={baseline ? `${signed(simultaneousPct - baseline.metrics[2])} pp vs DE421` : "SUN + EARTH VISIBLE"} tone="white" />
        <Metric label="LONGEST DARKNESS" value={result ? `${(result.metrics[3] ?? 0).toFixed(0)} h` : "—"} detail={`MIN SOC ${(result?.metrics[5] ?? 0).toFixed(0)}% · vs DE421 ${baseline ? signed((result?.metrics[3] ?? 0) - baseline.metrics[3]) + " h" : "—"}`} tone={survive ? "cyan" : "red"} />
        <div className={`mission-status ${survive ? "good" : "bad"}`}><span>{survive ? "POWER MARGIN" : "POWER SHORTFALL"}</span><strong>{survive ? "VIABLE" : "AT RISK"}</strong><i>{profileNames[settings.profileIndex]} · {settings.mastM.toFixed(1)} M MAST</i></div>
      </div>

      <div className="dashboard-grid">
        <div className="left-stack">
          <section className="panel terrain-panel">
            <div className="section-heading terrain-heading"><div><span className="eyebrow">LOLA DIGITAL ELEVATION MODEL / 5 M PIXEL</span><h2>Landing zone topography</h2></div><div className="terrain-pills"><span>{site?.site_metadata.reference_frame}</span><span>{site?.provenance.mode === "synthetic_mock" ? "SYNTHETIC" : "PGDA PRODUCT 78"}</span></div></div>
            {site && active && selectedCell && <Suspense fallback={<div className="terrain-loading">Loading terrain renderer…</div>}><ThreeTerrainViewer site={site} record={active} mastM={settings.mastM} cell={selectedCell} onCell={setSelectedCell} /></Suspense>}
          </section>
          {site && result && <HorizonPanorama2D horizon={site.horizon_mask_360.h0_deg} timeline={result.timeline} timeIndex={timeIndex} educator={persona === "EDUCATOR"} />}
          {result && <LaunchSlipMatrix windows={result.launch} selected={selectedSlip} onSelect={setSelectedSlip} />}
        </div>
        <aside className="right-stack">
          <section className="panel site-panel"><div className="section-heading"><div><span className="eyebrow">SELECTED REFERENCE POINT</span><h2>Site telemetry</h2></div><span className="orbit-icon">⌖</span></div>
            <div className="site-identity"><div className="site-symbol">S<span>04</span></div><div><strong>{site?.site_metadata.name}</strong><span>{site?.site_metadata.site_id} · PGDA / LOLA</span></div></div>
            <div className="site-coordinates"><div><span>LATITUDE</span><strong>{formatCoord(site?.site_metadata.lat_deg, "S")}</strong></div><div><span>LONGITUDE</span><strong>{formatCoord(site?.site_metadata.lon_deg, "E")}</strong></div><div><span>ELEVATION</span><strong>{site?.site_metadata.elevation_m.toLocaleString()} <small>m</small></strong></div></div>
            <div className="site-provenance"><i />{site?.provenance.mode === "synthetic_mock" ? "SYNTHETIC DATA — NOT A LUNAR OBSERVATION" : "NASA GSFC PGDA PRODUCT 78 · SITE04"}</div>
            <div className="settings-row"><label htmlFor="mast-height">MAST HEIGHT <strong>{settings.mastM.toFixed(1)} m</strong></label><input id="mast-height" type="range" min="0.5" max="10" step="0.1" value={settings.mastM} onChange={(e) => setSettings((s) => ({ ...s, mastM: Number(e.target.value) }))} /></div>
            <div className="settings-row"><label htmlFor="hotel-load">HOTEL LOAD <strong>{settings.hotelLoadW} W</strong></label><input id="hotel-load" type="range" min="50" max="350" step="5" value={settings.hotelLoadW} onChange={(e) => setSettings((s) => ({ ...s, hotelLoadW: Number(e.target.value) }))} /></div>
            <div className="soc-row"><span>INITIAL BATTERY CHARGE</span><strong>{Math.round(settings.initialSoc * 100)}%</strong></div><input className="soc-range" type="range" min="0.1" max="1" step="0.01" value={settings.initialSoc} onChange={(e) => setSettings((s) => ({ ...s, initialSoc: Number(e.target.value) }))} />
          </section>
          <HardwareProfileSelector value={settings.profileIndex} onChange={changeProfile} />
          {site && <DispersionGrid500m cells={cells} selected={selectedCell} onSelect={setSelectedCell} />}
          {reference && <GMParameterPanel reference={reference} values={gms} onChange={updateGm} onSave={saveGms} onRestore={restoreGms} saved={saved} />}
        </aside>
      </div>

      <footer className="console-footer"><div><b>FIRST CONTACT.SYS</b><span>OPEN SCIENCE / DE421 BASELINE · GM SENSITIVITY MODE</span></div><div><span>{loading ? "INITIALIZING" : "DATA READY"}</span><i /> {result?.timeline.length.toLocaleString() ?? "0"} HOURLY SAMPLES</div><a href="/data/ephemeris/site04_gm_scenario.json" target="_blank" rel="noreferrer">PROVENANCE & MODEL INPUT ↗</a></footer>
    </main>
  </div>;
=======
import { Component, lazy, Suspense } from "react";
import type { ReactNode } from "react";
const Explorer = lazy(() => import("./RegionWorkspace"));
class ExplorerBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="startup">
        <h1>The explorer couldn’t load.</h1>
        <p>
          Your calculation runs locally. Reload to retry the application files.
        </p>
        <button className="solid-button" onClick={() => location.reload()}>
          Reload explorer
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ExplorerBoundary>
      <Suspense
        fallback={
          <main className="startup">
            <div className="startup-mark" aria-hidden="true" />
            <h1>
              FIRST CONTACT<span>.sys</span>
            </h1>
            <p role="status">Preparing your view of the Moon…</p>
          </main>
        }
      >
        <Explorer />
      </Suspense>
    </ExplorerBoundary>
  );
>>>>>>> a804f1cf32df6f271aa4a3cc0ef26efa7f0d33b8
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) { return <div className={`metric-card metric-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small><i /></div>; }
function formatCoord(v: number | undefined, suffix: string) { return v == null ? "—" : `${Math.abs(v).toFixed(4)}° ${v < 0 ? (suffix === "E" ? "W" : "S") : suffix}`; }
function signed(v: number) { return `${v > 0 ? "+" : ""}${v.toFixed(2)}`; }
function scoreCell(cell: DispersionCell) { return (cell.status === "MISSION_LOSS_TRAP" ? 100 : cell.status === "CAUTION" ? 50 : 0) + (cell.slope_deg ?? 0); }
function readStorage<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
