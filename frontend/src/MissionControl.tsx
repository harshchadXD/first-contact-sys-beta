import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { syntheticComparisonFixture } from "./data/syntheticComparisonFixture";
import study from "./data/shackletonStudy.json";
import resolutionChecks from "../../docs/validation/resolution-checks.json";
import modelEvaluation from "../../experiments/surrogate/evaluation.json";
import type { LunarComparisonDataset } from "./types/lunarSite";
import { initializeEngine } from "./services/engineLoader";
import { analyzeDataset } from "./services/missionEngine";
import type { PositionAnalysis } from "./services/missionEngine";
import { assessConstraints } from "./services/missionConstraints";
import { selectStudyWindow } from "./services/studyWindow";
import { energyProfiles, profileParameters } from "./services/energyProfiles";
import type { RepairCandidate } from "./services/repairFrontier";
import Icon from "./components/Icon";
import { scenarioPresets } from "./data/scenarioPresets";
import type { WorldView } from "./components/LunarWorld";
import { skylineAt } from "./services/worldGeometry";
import type { EnergyParameters } from "./services/energyProfiles";
import type { RepairRequest } from "./services/repairSearch.worker";
const LunarWorld = lazy(() => import("./components/LunarWorld"));
const exportTime = () => new Date().toISOString();
const reference = study.dataset as LunarComparisonDataset;
const prepared = study as typeof study & {
  supportedHeightsMeters?: number[];
  heightProfiles?: Record<string, Record<string, number[]>>;
};
type EngineState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; analyze: (request: string) => string };
type SearchState = {
  running: boolean;
  duration: number;
  key: string;
  entries: PositionAnalysis[];
  error?: string;
};
type RepairState = {
  key: string;
  status: "running" | "done" | "error";
  tested: number;
  total: number;
  feasibleCount: number;
  frontier: RepairCandidate[];
  frontierCount?: number;
  message?: string;
};
const stamp = (value: string) => value.slice(0, 16).replace("T", " ") + " UTC";
const percent = (v: number | undefined) =>
  v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;
const hours = (v: number | undefined) =>
  v === undefined ? "—" : `${v.toFixed(1)} h`;

export default function MissionControl() {
  const [mode] = useState<"reference" | "synthetic">("reference");
  const [selected, setSelected] = useState("0:0");
  const [slip, setSlip] = useState(0);
  const [duration, setDuration] = useState(7);
  const [observerHeight, setObserverHeight] = useState(0);
  const [profileIndex, setProfileIndex] = useState(0);
  const [energyParameters, setEnergyParameters] = useState(() =>
    profileParameters(0),
  );
  const [reserve, setReserve] = useState(20);
  const [slopeLimit, setSlopeLimit] = useState(10);
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [intro, setIntro] = useState(true);
  const [view, setView] = useState<WorldView>("overview");
  const [sheet, setSheet] = useState<
    "places" | "dates" | "compare" | "horizon" | "settings" | "evidence" | null
  >(null);
  const [motion, setMotion] = useState(true);
  const [contours, setContours] = useState(false);
  const [rings, setRings] = useState(true);
  const [lookAt, setLookAt] = useState<"sun" | "earth">("earth");
  const [focusVersion, setFocusVersion] = useState(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [horizonProbe, setHorizonProbe] = useState<number | null>(null);
  const [baseline, setBaseline] = useState<{
    label: string;
    sun: number;
    earth: number;
    dark: number;
    assumptions: string;
    durationDays: number;
    positionId: string;
    arrivalDay: number;
    height: number;
    hour: number;
    parameters: EnergyParameters;
    profileIndex: number;
    limits: {
      maxDarknessHours: number;
      minEarthVisibleHours: number;
      reserve: number;
      slopeLimit: number;
    };
  } | null>(null);
  const [engine, setEngine] = useState<EngineState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [constraints, setConstraints] = useState({
    maxDarknessHours: 24,
    minEarthVisibleHours: 4,
  });
  const [search, setSearch] = useState<SearchState | null>(null);
  const searchRun = useRef(0);
  const repairWorker = useRef<Worker | null>(null);
  const [repairs, setRepairs] = useState<RepairState | null>(null);
  const [lastRepair, setLastRepair] = useState<RepairCandidate | null>(null);
  const referenceForHeight = useMemo(
    () => ({
      ...reference,
      provenance: {
        ...reference.provenance,
        observerMastHeightMeters: observerHeight,
      },
      positions: reference.positions.map((p) => ({
        ...p,
        horizon: {
          ...p.horizon,
          horizonElevationDeg:
            prepared.heightProfiles?.[p.positionId]?.[
              observerHeight.toFixed(1)
            ] ?? p.horizon.horizonElevationDeg,
        },
      })),
    }),
    [observerHeight],
  );
  const window = useMemo(
    () =>
      mode === "reference"
        ? selectStudyWindow(referenceForHeight, slip * 24, duration * 24)
        : {
            dataset: syntheticComparisonFixture,
            windowEndUtc: "2026-10-02T00:00:00Z",
          },
    [mode, slip, duration, referenceForHeight],
  );
  const data = window.dataset;
  const evaluation = useMemo(() => {
    if (engine.status !== "ready") return { result: null, error: "" };
    try {
      return {
        result: analyzeDataset(
          data,
          window.windowEndUtc,
          engine.analyze,
          energyParameters,
        ),
        error: "",
      };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Analysis failed",
      };
    }
  }, [data, window.windowEndUtc, engine, energyParameters]);
  const evaluatedId = selected;
  const analysis = evaluation.result?.positions.find(
    (p) => p.positionId === evaluatedId,
  );
  const selectedPoint = study.points.find((p) => p.id === selected);
  const position =
    data.positions.find((p) => p.positionId === evaluatedId) ??
    data.positions.find((p) => p.positionId === "0:0") ??
    data.positions[0];
  const e = position.ephemeris ?? data.ephemeris;
  const sample = Math.min(hour, e.timestampsUtc.length - 1);
  const activeConstraints = {
    ...constraints,
    minimumSocPct: reserve,
    maxSlopeDeg: mode === "reference" ? slopeLimit : undefined,
  };
  const check = (result: PositionAnalysis) =>
    assessConstraints(
      result,
      activeConstraints,
      study.points.find((p) => p.id === result.positionId)?.slopeDeg,
    );
  const violations = analysis ? check(analysis) : [];
  const outcome = analysis
    ? violations.length
      ? "Selected limits exceeded"
      : "Selected limits met"
    : "Calculating your window";
  const sun = { az: e.sunAzimuthDeg[sample], el: e.sunElevationDeg[sample] };
  const earth = {
    az: e.earthAzimuthDeg[sample],
    el: e.earthElevationDeg[sample],
  };
  const searchKey = `${selected}/${duration}/${observerHeight}/${JSON.stringify(energyParameters)}`;
  const visibleSearch = search?.key === searchKey ? search : null;
  const repairKey = JSON.stringify({
    selected,
    slip,
    duration,
    observerHeight,
    energyParameters,
    activeConstraints,
  });
  const visibleRepairs = repairs?.key === repairKey ? repairs : null;

  useEffect(() => {
    let active = true;
    initializeEngine(() => import("../../engine/pkg/first_contact_engine.js"))
      .then((analyze) => {
        if (active) setEngine({ status: "ready", analyze });
      })
      .catch((error: unknown) => {
        if (active)
          setEngine({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Engine initialization failed",
          });
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  useEffect(
    () => () => {
      searchRun.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      repairWorker.current?.terminate();
    },
    [repairKey],
  );

  function findRepairs() {
    if (mode !== "reference" || !prepared.heightProfiles) return;
    repairWorker.current?.terminate();
    const worker = new Worker(
      new URL("./services/repairSearch.worker.ts", import.meta.url),
      { type: "module" },
    );
    repairWorker.current = worker;
    const total =
      reference.positions.length *
      30 *
      (prepared.supportedHeightsMeters?.length ?? 1);
    setRepairs({
      key: repairKey,
      status: "running",
      tested: 0,
      total,
      feasibleCount: 0,
      frontier: [],
    });
    worker.onmessage = (event) => {
      const message = event.data;
      if (message.type === "progress")
        setRepairs((previous) =>
          previous?.key === repairKey
            ? { ...previous, tested: message.tested }
            : previous,
        );
      else if (message.type === "complete") {
        setRepairs({
          key: repairKey,
          status: "done",
          tested: message.tested,
          total: message.total,
          feasibleCount: message.feasibleCount,
          frontier: message.frontier,
          frontierCount: message.frontierCount,
        });
        worker.terminate();
      } else if (message.type === "error") {
        setRepairs((previous) =>
          previous
            ? { ...previous, status: "error", message: message.message }
            : previous,
        );
        worker.terminate();
      }
    };
    worker.onerror = () => {
      setRepairs((previous) =>
        previous
          ? {
              ...previous,
              status: "error",
              message:
                "The background search failed. Current exact analysis is preserved.",
            }
          : previous,
      );
      worker.terminate();
    };
    const request: RepairRequest = {
      dataset: reference,
      heightProfiles: prepared.heightProfiles,
      heights: prepared.supportedHeightsMeters ?? [0],
      durationDays: duration,
      constraints: activeConstraints,
      energy: energyParameters,
      points: study.points,
      baseline: {
        positionId: selected,
        arrivalDay: slip,
        heightMeters: observerHeight,
      },
    };
    worker.postMessage(request);
  }

  async function runSearch() {
    if (engine.status !== "ready") return;
    const run = ++searchRun.current,
      entries: PositionAnalysis[] = [];
    const source = {
      ...referenceForHeight,
      positions: referenceForHeight.positions.filter(
        (p) => p.positionId === selected,
      ),
    };
    if (!source.positions.length) return;
    setSearch({ running: true, duration, key: searchKey, entries: [] });
    try {
      for (let day = 0; day < 30; day++) {
        if (searchRun.current !== run) return;
        const candidate = selectStudyWindow(source, day * 24, duration * 24);
        entries.push(
          analyzeDataset(
            candidate.dataset,
            candidate.windowEndUtc,
            engine.analyze,
            energyParameters,
          ).positions[0],
        );
        setSearch({
          running: true,
          duration,
          key: searchKey,
          entries: [...entries],
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (searchRun.current === run)
        setSearch({ running: false, duration, key: searchKey, entries });
    } catch (error) {
      if (searchRun.current === run)
        setSearch({
          running: false,
          duration,
          key: searchKey,
          entries,
          error: error instanceof Error ? error.message : "Search failed",
        });
    }
  }
  function exportAnalysis() {
    const payload = {
      exportedAtUtc: exportTime(),
      dataset: data,
      windowEndUtc: window.windowEndUtc,
      selectedPositionId: selected,
      selectedSampleUtc: e.timestampsUtc[sample],
      constraints: activeConstraints,
      energyParameters,
      analysis: evaluation.result,
      selectedPositionHasHorizon: !!analysis,
      arrivalSearch: visibleSearch,
      sourceManifest: mode === "reference" ? study.sourceManifest : null,
      keptConfiguration: baseline,
      perspective: view,
      limitations: data.provenance.notes,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `first-contact-${data.datasetId}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  const chartMin = Math.min(-4, ...e.earthElevationDeg) - 1;
  const groundProfile =
    prepared.heightProfiles?.[selected]?.["0.0"] ??
    position.horizon.horizonElevationDeg;
  const chartMax =
    Math.max(8, ...position.horizon.horizonElevationDeg, ...groundProfile) + 2;
  const cx = (az: number) => 40 + (az / 360) * 870;
  const cy = (el: number) =>
    196 - ((el - chartMin) / (chartMax - chartMin)) * 176;
  const horizonPath =
    position.horizon.azimuthDeg
      .map(
        (az, i) =>
          `${i ? "L" : "M"}${cx(az)},${cy(position.horizon.horizonElevationDeg[i])}`,
      )
      .join(" ") + ` L910,${cy(position.horizon.horizonElevationDeg[0])}`;
  const canSearch =
    engine.status === "ready" && !visibleSearch?.running && !!analysis;
  const groundHorizonPath =
    position.horizon.azimuthDeg
      .map((az, i) => `${i ? "L" : "M"}${cx(az)},${cy(groundProfile[i])}`)
      .join(" ") + ` L910,${cy(groundProfile[0])}`;

  useEffect(() => {
    if (!playing) return;
    const interval = globalThis.setInterval(() => {
      if (document.hidden) return;
      setHour((current) => (current + 1) % e.timestampsUtc.length);
    }, 450);
    return () => globalThis.clearInterval(interval);
  }, [playing, e.timestampsUtc.length]);

  useEffect(() => {
    if (sheet) document.getElementById("sheet-title")?.focus();
    else if (returnFocus.current) {
      if (returnFocus.current.isConnected) returnFocus.current.focus();
      else
        document.querySelector<HTMLButtonElement>(".contact-wordmark")?.focus();
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheet(null);
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [sheet]);
  function openSheet(next: typeof sheet) {
    returnFocus.current = document.activeElement as HTMLElement;
    setSheet(next);
    setIntro(false);
  }
  function changeView(next: WorldView) {
    setFocusVersion((v) => v + 1);
    setIntro(false);
    setView(next);
  }
  function applyScenario(scenario: (typeof scenarioPresets)[number]) {
    searchRun.current++;
    setSearch(null);
    setRepairs(null);
    repairWorker.current?.terminate();
    setSelected(scenario.positionId);
    setSlip(scenario.arrivalDay);
    setObserverHeight(scenario.height);
    setDuration(7);
    setHour(0);
    setPlaying(false);
    setProfileIndex(0);
    setEnergyParameters(profileParameters(0));
    setConstraints({ maxDarknessHours: 24, minEarthVisibleHours: 4 });
    setReserve(20);
    setSlopeLimit(10);
    setIntro(false);
    setView("terrain");
    setSheet(null);
  }
  function keepView() {
    if (!analysis) return;
    setBaseline({
      label: `${selected} · ${slip + 1} Dec · ${observerHeight} m`,
      sun: analysis.sunVisibleFraction,
      earth: analysis.earthVisibleFraction,
      dark: analysis.longestDarknessHours,
      assumptions: JSON.stringify(energyParameters),
      durationDays: duration,
      positionId: selected,
      arrivalDay: slip,
      height: observerHeight,
      hour,
      parameters: { ...energyParameters },
      profileIndex,
      limits: { ...constraints, reserve, slopeLimit },
    });
  }
  function restoreView() {
    if (!baseline) return;
    setSelected(baseline.positionId);
    setSlip(baseline.arrivalDay);
    setDuration(baseline.durationDays);
    setObserverHeight(baseline.height);
    setHour(baseline.hour);
    setEnergyParameters({ ...baseline.parameters });
    setProfileIndex(baseline.profileIndex ?? 0);
    setConstraints({
      maxDarknessHours: baseline.limits.maxDarknessHours,
      minEarthVisibleHours: baseline.limits.minEarthVisibleHours,
    });
    setReserve(baseline.limits.reserve);
    setSlopeLimit(baseline.limits.slopeLimit);
    setPlaying(false);
  }
  const sunHorizon = skylineAt(
    sun.az,
    position.horizon.azimuthDeg,
    position.horizon.horizonElevationDeg,
  );
  const earthHorizon = skylineAt(
    earth.az,
    position.horizon.azimuthDeg,
    position.horizon.horizonElevationDeg,
  );
  const customEnergy =
    profileIndex < 0 ||
    !Number.isInteger(profileIndex) ||
    JSON.stringify(energyParameters) !==
      JSON.stringify(profileParameters(profileIndex));
  const titles = {
    places: "Find your place",
    dates: "Choose your window",
    compare: "Explore the trade-offs",
    horizon: "Read the horizon",
    settings: "Your operating needs",
    evidence: "Follow the evidence",
  };
  return (
    <div
      className={`contact-app ${intro ? "is-intro" : ""} ${sheet ? "has-sheet" : ""}`}
    >
      <Suspense
        fallback={
          <div className="world-loading">
            <span className="loading-orbit" />
            Preparing your view of the Moon…
          </div>
        }
      >
        <LunarWorld
          terrain={study.terrain}
          points={study.points}
          selected={selected}
          onSelect={setSelected}
          onEnter={() => changeView("terrain")}
          view={view}
          intro={intro}
          motion={motion}
          contours={contours}
          rings={rings}
          sun={sun}
          earth={earth}
          height={observerHeight}
          lat={position.coordinates.latDeg}
          lon={position.coordinates.lonDeg}
          horizon={position.horizon.horizonElevationDeg}
          azimuths={position.horizon.azimuthDeg}
          lookAt={lookAt}
          focusVersion={focusVersion}
          keptPosition={baseline?.positionId}
        />
      </Suspense>
      <header className="app-header">
        <button
          className="contact-wordmark"
          onClick={() => {
            setIntro(true);
            setSheet(null);
            setView("overview");
            setPlaying(false);
          }}
          aria-label="First Contact introduction"
        >
          <svg
            viewBox="0 0 108 40"
            aria-hidden="true"
            className={`brand-wireframe ${analysis?.earthVisible[sample] ? "contact-clear" : "contact-obscured"} ${motion ? "" : "still"}`}
          >
            <path d="M3 30 17 10l9 5 7-9 8 5 7-2 7 14-3 7-9-2-7 5-8-3-8 5z" />
            <path d="m105 30-14-20-9 5-7-9-8 5-7-2-7 14 3 7 9-2 7 5 8-3 8 5z" />
            <path
              className="wire"
              d="M8 28 19 12l8 5 6-8 7 5 7-2 4 9m49 7L89 12l-8 5-6-8-7 5-7-2-4 9"
            />
            <path className="bridge-ray" d="M48 20h12" />
            <circle className="bridge-spark" cx="54" cy="20" r="2.2" />
          </svg>
          <span>
            FIRST CONTACT<span className="sys">.SYS</span>
          </span>
        </button>
        <nav aria-label="Explorer tools">
          <button
            onClick={() => openSheet("places")}
            className={sheet === "places" ? "active" : ""}
          >
            Locations
          </button>
          <button
            onClick={() => openSheet("compare")}
            className={sheet === "compare" ? "active" : ""}
          >
            Compare
          </button>
          <button
            onClick={() => openSheet("evidence")}
            className={sheet === "evidence" ? "active" : ""}
          >
            The science
          </button>
        </nav>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label="Operating assumptions"
            onClick={() => openSheet("settings")}
          >
            <Icon name="settings" />
          </button>
          <button
            className="icon-button motion-toggle"
            aria-label={
              motion ? "Pause ambient motion" : "Resume ambient motion"
            }
            aria-pressed={!motion}
            onClick={() => setMotion((v) => !v)}
          >
            <Icon name={motion ? "pause" : "play"} size={17} />
          </button>
        </div>
      </header>
      {intro ? (
        <section className="intro-copy">
          <h1>
            THE MOON.
            <br />A DIFFERENT
            <br />
            <span>PERSPECTIVE.</span>
          </h1>
          <p>
            A few metres. A different day.
            <br />
            Explore light, terrain and the view back to Earth.
          </p>
          <button
            className="enter-button"
            onClick={() => changeView("terrain")}
          >
            Explore Shackleton
            <Icon name="arrow" />
          </button>
          <button
            className="intro-secondary"
            onClick={() => changeView("overview")}
          >
            Start with the whole Moon
          </button>
          <span className="intro-footnote">
            NASA-derived terrain. Computed on your device.
          </span>
        </section>
      ) : (
        <>
          <div className="view-switch" role="group" aria-label="Perspective">
            {(
              [
                { id: "overview", icon: "globe", label: "Moon" },
                { id: "terrain", icon: "terrain", label: "Terrain" },
                { id: "ground", icon: "eye", label: "Ground" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                aria-pressed={view === item.id}
                onClick={() => changeView(item.id)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          {view === "overview" ? (
            <section className="region-callout">
              <span className="small-label">AVAILABLE REGION</span>
              <h1>
                Shackleton
                <br />
                ridge
              </h1>
              <p>A closer look at 25 places near the lunar south pole.</p>
              <button
                className="text-action"
                onClick={() => changeView("terrain")}
              >
                Approach the surface
                <Icon name="arrow" size={17} />
              </button>
              <small>
                The highlighted marker locates this study. Other regions are not
                yet analysed.
              </small>
            </section>
          ) : (
            <section className="place-callout">
              <button
                className="location-heading"
                onClick={() => openSheet("places")}
              >
                Shackleton ridge
                <Icon name="arrow" size={16} />
              </button>
              <div className="coordinate-line">
                {Math.abs(position.coordinates.latDeg).toFixed(4)}°{" "}
                {position.coordinates.latDeg < 0 ? "S" : "N"} ·{" "}
                {Math.abs(position.coordinates.lonDeg).toFixed(4)}°{" "}
                {position.coordinates.lonDeg < 0 ? "W" : "E"}
              </div>
              <div className="place-offset">
                {selected === "0:0"
                  ? "Reference position"
                  : `East ${selectedPoint?.eastMeters} m / North ${selectedPoint?.northMeters} m`}
              </div>
              <button
                className="tiny-button"
                onClick={() => openSheet("places")}
              >
                Change location
              </button>
            </section>
          )}
          {view !== "overview" && (
            <div className="visibility-chips">
              <button
                onClick={() => {
                  setLookAt("sun");
                  changeView("ground");
                }}
              >
                <span className="body-dot solar" />
                <span>
                  Sun
                  <strong>
                    {analysis
                      ? analysis.sunVisible[sample]
                        ? "In view"
                        : "Obscured"
                      : "Calculating"}
                  </strong>
                </span>
                <Icon name="arrow" size={15} />
              </button>
              <button
                onClick={() => {
                  setLookAt("earth");
                  changeView("ground");
                }}
              >
                <span className="body-dot earth" />
                <span>
                  Earth
                  <strong>
                    {analysis
                      ? analysis.earthVisible[sample]
                        ? "In view"
                        : "Obscured"
                      : "Calculating"}
                  </strong>
                </span>
                <Icon name="arrow" size={15} />
              </button>
            </div>
          )}
          {view === "ground" && (
            <div className="ground-guide">
              <p>
                You’re looking toward {lookAt === "earth" ? "Earth" : "the Sun"}
                .
              </p>
              <button
                onClick={() => setLookAt(lookAt === "earth" ? "sun" : "earth")}
              >
                Look toward {lookAt === "earth" ? "the Sun" : "Earth"}
                <Icon name="arrow" size={14} />
              </button>
              <small>
                Fine line: regional skyline · local mesh: 495 m span
                <br />
                Surface camera behind a generic scale model. Skyline angles are
                computed at the selected point, {observerHeight} m above ground.
              </small>
            </div>
          )}
          {!sheet && view !== "overview" && (
            <section className="window-card">
              <div className="window-card-title">
                <h2>Your {duration}-day window</h2>
                <button
                  className="icon-button"
                  aria-label="Explain these results"
                  onClick={() => openSheet("horizon")}
                >
                  <Icon name="info" size={17} />
                </button>
              </div>
              <div className="window-numbers">
                <div>
                  <span>Sunlight access</span>
                  <strong>{percent(analysis?.sunVisibleFraction)}</strong>
                </div>
                <div>
                  <span>Continuous Earth view</span>
                  <strong>{hours(analysis?.longestEarthVisibleHours)}</strong>
                </div>
              </div>
              <dl className="window-details">
                <div>
                  <dt>Longest darkness</dt>
                  <dd>{hours(analysis?.longestDarknessHours)}</dd>
                </div>
                <div>
                  <dt>Minimum battery</dt>
                  <dd>
                    {analysis?.energy
                      ? `${analysis.energy.minimumSocPct.toFixed(1)}%`
                      : "?"}
                  </dd>
                </div>
                <div>
                  <dt>Local slope / limit</dt>
                  <dd>
                    {selectedPoint?.slopeDeg?.toFixed(1)}? /{" "}
                    {slopeLimit.toFixed(1)}?
                  </dd>
                </div>
              </dl>
              <p
                className={
                  analysis && violations.length
                    ? "window-concern"
                    : "window-status"
                }
              >
                {analysis
                  ? violations.length
                    ? violations[0]
                    : "Selected limits met under your assumptions."
                  : "Calculating the window…"}
              </p>
              <div className="window-actions">
                <button
                  onClick={() => {
                    keepView();
                    openSheet("compare");
                  }}
                >
                  <Icon name="compare" size={16} />
                  Keep & compare
                </button>
                <button onClick={() => openSheet("settings")}>
                  Edit needs
                </button>
              </div>
              <span className="scope-note">
                Exploration, not a mission-survival prediction.
              </span>
            </section>
          )}
        </>
      )}
      {(engine.status === "error" || evaluation.error) && (
        <div className="engine-notice" role="alert">
          <strong>Calculation unavailable</strong>
          <p>{engine.status === "error" ? engine.message : evaluation.error}</p>
          <button
            onClick={() => {
              setEngine({ status: "loading" });
              setAttempt((i) => i + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
      <div className="scene-caption">
        <span>
          {intro
            ? "LRO / NASA SVS · lunar surface explorer"
            : view === "overview"
              ? "LRO / NASA SVS display mosaic"
              : view === "ground"
                ? "Regional skyline overlay · geometric visibility"
                : "LOLA elevation · 5 m pixels · local lighting illustrative"}
        </span>
        {!intro && (
          <button onClick={() => openSheet("evidence")}>
            Data & limitations
            <Icon name="info" size={13} />
          </button>
        )}
      </div>
      <footer className={`time-dock ${intro ? "intro-dock" : ""}`}>
        <button className="date-control" onClick={() => openSheet("dates")}>
          <span>ARRIVAL</span>
          <strong>{String(slip + 1).padStart(2, "0")} DEC 2026</strong>
          <small>
            {duration}-day stay
            <Icon name="arrow" size={13} />
          </small>
        </button>
        <button
          className="transport-play"
          aria-label={playing ? "Pause time" : "Play time"}
          aria-pressed={playing}
          onClick={() => {
            setIntro(false);
            setPlaying((p) => !p);
          }}
        >
          <Icon name={playing ? "pause" : "play"} size={19} />
        </button>
        <div className="time-track">
          <div className="timeline-transport">
            <button
              aria-label="Previous 24 hours"
              onClick={() => {
                setPlaying(false);
                setHour(Math.max(0, sample - 24));
              }}
            >
              <Icon name="arrow" size={14} />
              <span>−24 h</span>
            </button>
            <button
              aria-label="Reset observation time"
              onClick={() => {
                setPlaying(false);
                setHour(0);
              }}
            >
              <Icon name="reset" size={14} />
            </button>
            <strong>
              T+{String(Math.floor(sample / 24)).padStart(2, "0")}D:
              {String(sample % 24).padStart(2, "0")}H
            </strong>
            <button
              aria-label="Next 24 hours"
              onClick={() => {
                setPlaying(false);
                setHour(Math.min(e.timestampsUtc.length - 1, sample + 24));
              }}
            >
              <span>+24 h</span>
              <Icon name="arrow" size={14} />
            </button>
          </div>
          <div className="track-labels">
            <span>{stamp(e.timestampsUtc[sample])}</span>
            <span>
              +{sample} h / {e.timestampsUtc.length} h
            </span>
          </div>
          <label className="sr-only" htmlFor="world-time">
            Observation time
          </label>
          <input
            id="world-time"
            type="range"
            min="0"
            max={e.timestampsUtc.length - 1}
            value={sample}
            onChange={(event) => {
              setHour(Number(event.target.value));
              setPlaying(false);
            }}
          />
          {analysis && (
            <div
              className="track-flags"
              aria-label="Sun and Earth visibility through the window"
            >
              {(["sunVisible", "earthVisible"] as const).map((key, i) => (
                <svg
                  key={key}
                  viewBox={`0 0 ${e.timestampsUtc.length} 3`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={
                    i ? "Earth visibility intervals" : "Sunlight intervals"
                  }
                >
                  {analysis[key].map((visible, j) => (
                    <rect
                      key={j}
                      x={j}
                      y="0"
                      width="1"
                      height="3"
                      fill={visible ? (i ? "#8ebac9" : "#d4b27c") : "#ffffff0a"}
                    />
                  ))}
                </svg>
              ))}
            </div>
          )}
        </div>
        <label className="height-control">
          OBSERVER HEIGHT
          <select
            value={observerHeight}
            onChange={(event) => setObserverHeight(Number(event.target.value))}
          >
            {(prepared.supportedHeightsMeters ?? [0]).map((h) => (
              <option key={h} value={h}>
                {h === 0 ? "Ground level" : `${h} metres`}
              </option>
            ))}
          </select>
        </label>
      </footer>
      {sheet && (
        <aside className="analysis-sheet" aria-labelledby="sheet-title">
          <header className="sheet-header">
            <h2 id="sheet-title" tabIndex={-1}>
              {titles[sheet]}
            </h2>
            <button
              className="icon-button"
              aria-label="Close panel"
              onClick={() => setSheet(null)}
            >
              <Icon name="close" />
            </button>
          </header>
          <div className="sheet-body">
            {sheet === "places" && (
              <>
                <p>
                  One study region. Twenty-five different outlooks. Select a
                  point here or on the terrain.
                </p>
                <details className="scenario-section">
                  <summary>Try a computed example</summary>
                  <p>
                    Computed examples in this Shackleton study. Each loads a
                    seven-day window and the default illustrative energy
                    assumptions.
                  </p>
                  <div className="scenario-list">
                    {scenarioPresets.map((scenario) => (
                      <button
                        key={scenario.id}
                        onClick={() => applyScenario(scenario)}
                      >
                        <span>{scenario.name}</span>
                        <small>{scenario.description}</small>
                        <Icon name="arrow" size={16} />
                      </button>
                    ))}
                  </div>
                </details>
                <div
                  className="location-grid"
                  role="group"
                  aria-label="Locations, geographic north at top"
                >
                  {study.points.map((p) => (
                    <button
                      key={p.id}
                      aria-pressed={selected === p.id}
                      aria-label={`East ${p.eastMeters} metres, north ${p.northMeters} metres`}
                      onClick={() => {
                        setSelected(p.id);
                        setView("terrain");
                      }}
                    >
                      <span>
                        {p.id === "0:0"
                          ? "REF"
                          : `${p.eastMeters}, ${p.northMeters}`}
                      </span>
                      <strong>{p.slopeDeg?.toFixed(1)}°</strong>
                    </button>
                  ))}
                </div>
                <p className="panel-note">
                  Slope in degrees. Centres are 100 m apart, spanning 400 m.
                  Unsampled ground is not certified.
                </p>
                <div className="selected-location">
                  <span>Selected location</span>
                  <strong>
                    E {selectedPoint?.eastMeters ?? 0} / N{" "}
                    {selectedPoint?.northMeters ?? 0} m
                  </strong>
                  <dl>
                    <dt>Elevation</dt>
                    <dd>{selectedPoint?.elevationMeters?.toFixed(1)} m</dd>
                    <dt>Local slope</dt>
                    <dd>{selectedPoint?.slopeDeg?.toFixed(1)}°</dd>
                  </dl>
                </div>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={contours}
                    onChange={(event) => setContours(event.target.checked)}
                  />
                  Show measured mesh structure
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={rings}
                    onChange={(event) => setRings(event.target.checked)}
                  />
                  Show 50 / 100 / 200 m distances
                </label>
                <p className="panel-note">
                  Rings follow the measured surface and stop at its edge. A
                  generic lander provides scale; the height probe marks the
                  actual selected point. It is not spacecraft CAD.
                </p>

                <p className="panel-note">
                  Each point has a separately baked horizon at every supported
                  height. Additional regions need their own verified data.
                </p>
              </>
            )}
            {sheet === "dates" && (
              <section id="arrival" className="arrival-panel">
                <div className="panel-header">
                  <div>
                    <h2>Find an operating window</h2>
                    <p className="section-note">
                      30 arrival dates. Identical duration, height, hardware
                      assumptions and limits.
                    </p>
                  </div>
                  <div className="arrival-controls">
                    <label>
                      Duration
                      <select
                        value={duration}
                        onChange={(event) => {
                          searchRun.current++;
                          setSearch(null);
                          setDuration(Number(event.target.value));
                          setConstraints((c) => ({
                            ...c,
                            maxDarknessHours: Math.min(
                              c.maxDarknessHours,
                              Number(event.target.value) * 24,
                            ),
                            minEarthVisibleHours: Math.min(
                              c.minEarthVisibleHours,
                              Number(event.target.value) * 24,
                            ),
                          }));
                          setHour(0);
                        }}
                      >
                        <option value="1">1 day</option>
                        <option value="7">7 days</option>
                        <option value="14">14 days</option>
                        <option value="30">30 days</option>
                      </select>
                    </label>
                    <button
                      className="primary-action compact"
                      disabled={!canSearch}
                      onClick={runSearch}
                    >
                      {visibleSearch?.running
                        ? `Computing ${visibleSearch.entries.length}/30`
                        : "Search 30 arrivals"}
                    </button>
                  </div>
                </div>
                <div
                  className="arrival-matrix"
                  role="group"
                  aria-label="Arrival dates in December 2026"
                >
                  {Array.from({ length: 30 }, (_, day) => {
                    const r = visibleSearch?.entries[day];
                    const passes = r && check(r).length === 0;
                    return (
                      <button
                        key={day}
                        className={`${day === slip ? "selected " : ""}${r ? (passes ? "passes" : "fails") : "uncomputed"}`}
                        aria-pressed={day === slip}
                        onClick={() => {
                          setSlip(day);
                          setHour(0);
                        }}
                        title={
                          r
                            ? `${day + 1} Dec: ${hours(r.longestDarknessHours)} darkness, ${hours(r.longestEarthVisibleHours)} continuous Earth`
                            : `${day + 1} Dec: select to evaluate`
                        }
                      >
                        <small>DEC</small>
                        <strong>{String(day + 1).padStart(2, "0")}</strong>
                        <span>
                          {r ? (passes ? "MEETS" : "EXCEEDS") : "SELECT"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="section-note">
                  {search?.error ??
                    "Results use the selected position and all active limits. Arrival dates are not launch-trajectory solutions."}
                </p>
              </section>
            )}
            {sheet === "compare" && (
              <>
                <p>
                  Keep a configuration, then change its position, date or
                  observer height. The amber ring marks your kept location on
                  the terrain.
                </p>
                <button
                  className="solid-button full-width"
                  disabled={!analysis}
                  onClick={keepView}
                >
                  <Icon name="compare" size={17} />
                  {baseline ? "Replace kept view" : "Keep current view"}
                </button>
                {baseline && (
                  <>
                    <div className="comparison-heading">
                      <div>
                        <span>KEPT</span>
                        <strong>{baseline.label}</strong>
                      </div>
                      <button className="text-action" onClick={restoreView}>
                        Restore
                        <Icon name="reset" size={14} />
                      </button>
                    </div>
                    <div className="delta-table">
                      <div>
                        <span>For the full stay</span>
                        <span>Kept</span>
                        <span>Now</span>
                      </div>
                      <div>
                        <span>Sunlight access</span>
                        <strong>{percent(baseline.sun)}</strong>
                        <strong>{percent(analysis?.sunVisibleFraction)}</strong>
                      </div>
                      <div>
                        <span>Earth in view</span>
                        <strong>{percent(baseline.earth)}</strong>
                        <strong>
                          {percent(analysis?.earthVisibleFraction)}
                        </strong>
                      </div>
                      <div>
                        <span>Longest darkness</span>
                        <strong>{hours(baseline.dark)}</strong>
                        <strong>{hours(analysis?.longestDarknessHours)}</strong>
                      </div>
                    </div>
                    <p className="panel-note">
                      {baseline.assumptions !==
                        JSON.stringify(energyParameters) ||
                      baseline.durationDays !== duration
                        ? "Hardware or duration differs. Restore the kept view for its original assumptions."
                        : "Same hardware assumptions and duration. Each configuration uses its actual position/date/height."}
                    </p>
                  </>
                )}
                <section className="repair-panel" id="alternatives">
                  <div className="panel-header">
                    <div>
                      <h2>What would change the outcome?</h2>
                      <p className="section-note">
                        Test 25 places × 30 arrivals ×{" "}
                        {(prepared.supportedHeightsMeters ?? [0]).length}{" "}
                        observer heights. Under the operating needs you set.
                      </p>
                    </div>
                    <button
                      className="primary-action compact"
                      disabled={
                        engine.status !== "ready" ||
                        visibleRepairs?.status === "running"
                      }
                      onClick={findRepairs}
                    >
                      {visibleRepairs?.status === "running"
                        ? `Tested ${visibleRepairs.tested}/${visibleRepairs.total}`
                        : "Find alternatives"}
                    </button>
                  </div>
                  <div className="repair-content">
                    {visibleRepairs?.status === "running" ? (
                      <>
                        <progress
                          aria-label="Alternative search progress"
                          value={visibleRepairs.tested}
                          max={visibleRepairs.total}
                        />
                        <p>
                          The exact Rust/WASM search runs in a background
                          worker. You can still inspect the terrain.
                        </p>
                        <button
                          className="text-action"
                          onClick={() => {
                            repairWorker.current?.terminate();
                            setRepairs(null);
                          }}
                        >
                          Cancel search
                        </button>
                      </>
                    ) : visibleRepairs?.status === "error" ? (
                      <p role="alert">{visibleRepairs.message}</p>
                    ) : visibleRepairs?.status === "done" ? (
                      <>
                        <p>
                          {visibleRepairs.feasibleCount} of{" "}
                          {visibleRepairs.total} tested configurations meet the
                          selected constraints. {visibleRepairs.frontierCount}{" "}
                          belong to the Pareto set of smallest-change
                          trade-offs.
                        </p>
                        {visibleRepairs.frontier.length ? (
                          <div className="repair-options">
                            {visibleRepairs.frontier.map((candidate, i) => (
                              <article
                                key={`${candidate.positionId}/${candidate.arrivalDay}/${candidate.heightMeters}`}
                              >
                                <div>
                                  <span>
                                    ALTERNATIVE {String(i + 1).padStart(2, "0")}
                                  </span>
                                  <h3>
                                    E{" "}
                                    {
                                      study.points.find(
                                        (p) => p.id === candidate.positionId,
                                      )?.eastMeters
                                    }{" "}
                                    / N{" "}
                                    {
                                      study.points.find(
                                        (p) => p.id === candidate.positionId,
                                      )?.northMeters
                                    }{" "}
                                    m
                                  </h3>
                                </div>
                                <dl>
                                  <dt>Arrival</dt>
                                  <dd>{candidate.arrivalDay + 1} Dec 2026</dd>
                                  <dt>Observer height</dt>
                                  <dd>{candidate.heightMeters} m</dd>
                                  <dt>Move from baseline</dt>
                                  <dd>
                                    {candidate.distanceMeters.toFixed(0)} m
                                  </dd>
                                  <dt>Date / height change</dt>
                                  <dd>
                                    {candidate.arrivalShiftDays} d /{" "}
                                    {candidate.heightShiftMeters} m
                                  </dd>
                                  <dt>Min battery reserve</dt>
                                  <dd>{candidate.minimumSocPct.toFixed(1)}%</dd>
                                </dl>
                                <button
                                  className="outline-action"
                                  onClick={() => {
                                    setLastRepair(candidate);
                                    setSelected(candidate.positionId);
                                    setSlip(candidate.arrivalDay);
                                    setObserverHeight(candidate.heightMeters);
                                    setHour(0);
                                  }}
                                >
                                  Explore this alternative →
                                </button>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p>
                            No tested combination meets all limits. Review the
                            violated constraint, assumptions, region or
                            supported search range; do not treat unsampled
                            configurations as ruled out.
                          </p>
                        )}
                        <p className="section-note">
                          The frontier minimizes movement, arrival shift and
                          height change separately. It is a set of tested
                          trade-offs, not a global optimum or a safety
                          certification.
                        </p>
                      </>
                    ) : (
                      <p>
                        Ask which tested combination meets your limits with
                        fewer changes. The search is exact; ML does not certify
                        a result.
                      </p>
                    )}
                    {lastRepair && (
                      <p className="applied-repair">
                        Last applied alternative: position{" "}
                        {lastRepair.positionId}, {lastRepair.arrivalDay + 1}{" "}
                        Dec, {lastRepair.heightMeters} m observer. Subsequent
                        edits may change that configuration.
                      </p>
                    )}
                  </div>
                </section>
              </>
            )}
            {sheet === "horizon" && (
              <>
                <p>
                  Sun and Earth positions are compared with the terrain skyline
                  at this exact place and height.
                </p>
                <div className="clearance-pair">
                  <button
                    onClick={() => {
                      setLookAt("sun");
                      changeView("ground");
                    }}
                  >
                    <Icon name="sun" />
                    <span>Sun</span>
                    <strong>{(sun.el - sunHorizon).toFixed(2)}°</strong>
                    <small>centre clearance</small>
                  </button>
                  <button
                    onClick={() => {
                      setLookAt("earth");
                      changeView("ground");
                    }}
                  >
                    <Icon name="earth" />
                    <span>Earth</span>
                    <strong>{(earth.el - earthHorizon).toFixed(2)}°</strong>
                    <small>centre clearance</small>
                  </button>
                </div>
                <section
                  className="horizon-panel"
                  id="horizon"
                  aria-labelledby="horizon-title"
                >
                  <div className="panel-header">
                    <h2 id="horizon-title">Horizon & visibility</h2>
                    <div className="legend">
                      <span className="gold">Sun</span>
                      <span className="cyan">Earth</span>
                      <span>Terrain</span>
                      <span>Dashed: ground level</span>
                    </div>
                  </div>
                  <p className="chart-caption">
                    {position.label} · azimuth clockwise from north ·{" "}
                    {data.provenance.observerMastHeightMeters} m observer
                  </p>
                  <svg
                    className="horizon-chart"
                    onPointerMove={(event) => {
                      const bounds =
                        event.currentTarget.getBoundingClientRect();
                      setHorizonProbe(
                        Math.max(
                          0,
                          Math.min(
                            360,
                            ((((event.clientX - bounds.left) / bounds.width) *
                              950 -
                              40) /
                              870) *
                              360,
                          ),
                        ),
                      );
                    }}
                    onPointerLeave={() => setHorizonProbe(null)}
                    viewBox="0 0 950 230"
                    role="img"
                    aria-label={`Horizon of ${position.label}; Sun ${sun.el.toFixed(2)} degrees and Earth ${earth.el.toFixed(2)} degrees above the tangent plane.`}
                  >
                    {Array.from(
                      { length: 5 },
                      (_, i) => chartMin + (i * (chartMax - chartMin)) / 4,
                    ).map((v) => (
                      <g key={v}>
                        <line
                          x1="40"
                          x2="910"
                          y1={cy(v)}
                          y2={cy(v)}
                          className="chart-rule"
                        />
                        <text x="32" y={cy(v) + 4} textAnchor="end">
                          {v.toFixed(0)}°
                        </text>
                      </g>
                    ))}
                    <path
                      d={`${horizonPath} L910,196 L40,196 Z`}
                      fill="#1d2a34"
                    />
                    <path
                      d={horizonPath}
                      fill="none"
                      stroke="#8a9ba8"
                      strokeWidth="1.5"
                    />
                    <path
                      d={groundHorizonPath}
                      fill="none"
                      stroke="#a4b9c7"
                      strokeWidth="1"
                      strokeDasharray="5 5"
                    />
                    <circle
                      cx={cx(sun.az)}
                      cy={cy(sun.el)}
                      r="5"
                      fill="#facc15"
                    />
                    <circle
                      cx={cx(earth.az)}
                      cy={cy(earth.el)}
                      r="5"
                      fill="#38bdf8"
                    />
                    {horizonProbe !== null && (
                      <line
                        x1={cx(horizonProbe)}
                        x2={cx(horizonProbe)}
                        y1="16"
                        y2="196"
                        className="probe-crosshair"
                      />
                    )}
                    {[0, 90, 180, 270, 360].map((v) => (
                      <text key={v} x={cx(v)} y="222" textAnchor="middle">
                        {v}°
                      </text>
                    ))}
                  </svg>
                  <label className="skyline-probe">
                    Probe azimuth
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="0.5"
                      value={horizonProbe ?? 0}
                      onChange={(event) =>
                        setHorizonProbe(Number(event.target.value))
                      }
                    />
                  </label>
                  <output className="probe-readout" aria-live="off">
                    {horizonProbe === null
                      ? "Move across the chart or use the azimuth control to inspect the skyline."
                      : `AZ ${horizonProbe.toFixed(1)}° · ACTIVE ${skylineAt(horizonProbe, position.horizon.azimuthDeg, position.horizon.horizonElevationDeg).toFixed(2)}°`}
                  </output>
                  {!analysis && selected !== "0:0" && mode === "reference" && (
                    <p className="chart-warning">
                      This is the reference centre skyline. The selected offset
                      has no baked regional horizon.
                    </p>
                  )}
                </section>
                <p className="panel-note">
                  A positive centre clearance is geometrically above the
                  skyline. Sun-disk energy uses partial disk visibility. Earth
                  sight is not an RF or DSN contact guarantee.
                </p>
                {analysis?.energy && (
                  <section className="energy-panel">
                    <div className="panel-header">
                      <h2>Power & surface environment</h2>
                      <span className="subtle">ASSUMPTION-DRIVEN</span>
                    </div>
                    <div className="energy-numbers">
                      <div>
                        <span>Battery at sample</span>
                        <strong>
                          {analysis.energy.batterySocPct[sample].toFixed(1)}%
                        </strong>
                      </div>
                      <div>
                        <span>Net power</span>
                        <strong
                          className={
                            analysis.energy.netPowerW[sample] >= 0
                              ? "cyan"
                              : "gold"
                          }
                        >
                          {analysis.energy.netPowerW[sample].toFixed(0)} W
                        </strong>
                      </div>
                      <div>
                        <span>Surface equilibrium</span>
                        <strong>
                          {analysis.energy.surfaceTemperatureK[sample].toFixed(
                            1,
                          )}{" "}
                          K
                        </strong>
                      </div>
                    </div>
                    <p className="chart-caption">
                      Usable battery reserve through the selected window
                    </p>
                    <svg
                      className="energy-chart"
                      viewBox="0 0 900 140"
                      role="img"
                      aria-label="Battery reserve from 0 to 100 percent over the mission window"
                    >
                      <line
                        x1="40"
                        x2="880"
                        y1="20"
                        y2="20"
                        className="chart-rule"
                      />
                      <line
                        x1="40"
                        x2="880"
                        y1="120"
                        y2="120"
                        className="chart-rule"
                      />
                      <text x="8" y="24">
                        100
                      </text>
                      <text x="22" y="123">
                        0
                      </text>
                      <line
                        x1="40"
                        x2="880"
                        y1={120 - reserve}
                        y2={120 - reserve}
                        stroke="#ba6474"
                        strokeDasharray="4 5"
                      />
                      <polyline
                        fill="none"
                        stroke="#71c4df"
                        strokeWidth="2"
                        points={analysis.energy.batterySocPct
                          .map(
                            (v, i) =>
                              `${40 + (i / Math.max(1, analysis.energy!.batterySocPct.length - 1)) * 840},${120 - v}`,
                          )
                          .join(" ")}
                      />
                      <circle
                        cx={
                          40 +
                          (sample / Math.max(1, e.timestampsUtc.length - 1)) *
                            840
                        }
                        cy={120 - analysis.energy.batterySocPct[sample]}
                        r="4"
                        fill="#e2e8f0"
                      />
                    </svg>
                    <div className="energy-foot">
                      <span>
                        MIN RESERVE {analysis.energy.minimumSocPct.toFixed(1)}%
                      </span>
                      <span>
                        {analysis.energy.firstDepletionHours === null
                          ? "No depletion in evaluated window"
                          : `First depletion at T+${analysis.energy.firstDepletionHours.toFixed(1)} h`}
                      </span>
                    </div>
                    <p className="thermal-note">
                      Surface temperature is instantaneous horizontal-regolith
                      radiative equilibrium. It is not Diviner-calibrated, an
                      avionics temperature, or a freeze-out prediction.
                    </p>
                  </section>
                )}
              </>
            )}
            {sheet === "settings" && (
              <>
                <p>
                  Decide what this window needs to provide. These assumptions
                  affect the analysis and every alternative.
                </p>
                <section className="constraint-panel">
                  <div className="panel-header">
                    <h2>Operating limits</h2>
                    <span className="subtle">HARD CONSTRAINTS</span>
                  </div>
                  {mode === "reference" && (
                    <label
                      className="height-selector"
                      htmlFor="observer-height"
                    >
                      Observer height
                      <select
                        id="observer-height"
                        value={observerHeight}
                        onChange={(event) => {
                          searchRun.current++;
                          setSearch(null);
                          setObserverHeight(Number(event.target.value));
                        }}
                      >
                        {(prepared.supportedHeightsMeters ?? [0]).map(
                          (height) => (
                            <option key={height} value={height}>
                              {height} m
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  )}
                  <label htmlFor="battery-reserve">
                    Minimum battery reserve <output>{reserve}%</output>
                  </label>
                  <input
                    id="battery-reserve"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={reserve}
                    onChange={(event) => setReserve(Number(event.target.value))}
                  />
                  {mode === "reference" && (
                    <>
                      <label htmlFor="slope-limit">
                        Maximum local slope <output>{slopeLimit}°</output>
                      </label>
                      <input
                        id="slope-limit"
                        type="range"
                        min="0"
                        max="45"
                        step="1"
                        value={slopeLimit}
                        onChange={(event) =>
                          setSlopeLimit(Number(event.target.value))
                        }
                      />
                    </>
                  )}
                  <label htmlFor="darkness">
                    Maximum darkness{" "}
                    <output>{constraints.maxDarknessHours} h</output>
                  </label>
                  <input
                    id="darkness"
                    type="range"
                    min="0"
                    max={mode === "reference" ? duration * 24 : 24}
                    value={constraints.maxDarknessHours}
                    onChange={(event) =>
                      setConstraints((c) => ({
                        ...c,
                        maxDarknessHours: Number(event.target.value),
                      }))
                    }
                  />
                  <label htmlFor="earth-limit">
                    Minimum continuous Earth visibility{" "}
                    <output>{constraints.minEarthVisibleHours} h</output>
                  </label>
                  <input
                    id="earth-limit"
                    type="range"
                    min="0"
                    max={mode === "reference" ? duration * 24 : 24}
                    value={constraints.minEarthVisibleHours}
                    onChange={(event) =>
                      setConstraints((c) => ({
                        ...c,
                        minEarthVisibleHours: Number(event.target.value),
                      }))
                    }
                  />
                  <div
                    className={`constraint-explanation ${analysis ? (violations.length ? "exceeded" : "met") : ""}`}
                  >
                    <h3>{outcome}</h3>
                    {analysis ? (
                      violations.length ? (
                        <ul>
                          {violations.map((v) => (
                            <li key={v}>{v}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          The selected geometric, battery and available slope
                          limits are met under the stated assumptions. This is
                          not a mission-survival certification.
                        </p>
                      )
                    ) : (
                      <p>
                        {mode === "reference"
                          ? "A regional horizon is required for this position before evaluating these limits."
                          : "Engine analysis is initializing."}
                      </p>
                    )}
                  </div>
                </section>
                <section className="hardware-panel">
                  <div className="panel-header">
                    <h2>Energy assumptions</h2>
                    <span className="subtle">ILLUSTRATIVE</span>
                  </div>
                  <div
                    className="hardware-presets"
                    role="group"
                    aria-label="Illustrative hardware presets"
                  >
                    {energyProfiles.map((p, i) => (
                      <button
                        key={p.id}
                        aria-pressed={profileIndex === i && !customEnergy}
                        onClick={() => {
                          searchRun.current++;
                          setSearch(null);
                          setProfileIndex(i);
                          setEnergyParameters(profileParameters(i));
                        }}
                      >
                        {p.name}
                        <small>assumed values</small>
                      </button>
                    ))}
                  </div>
                  <button
                    className="outline-button full-width"
                    aria-pressed={customEnergy}
                    onClick={() => setProfileIndex(-1)}
                  >
                    Custom experimental assumptions
                  </button>
                  <div className="hardware-fields">
                    <label>
                      Usable battery / Wh
                      <input
                        aria-label="Usable battery watt-hours"
                        type="number"
                        min="1"
                        step="100"
                        value={energyParameters.usableBatteryWh}
                        onChange={(event) => {
                          const v = event.target.valueAsNumber;
                          if (Number.isFinite(v) && v > 0)
                            setEnergyParameters((p) => ({
                              ...p,
                              usableBatteryWh: v,
                            }));
                        }}
                      />
                    </label>
                    <label>
                      Solar rating / W
                      <input
                        aria-label="Assumed solar rated watts"
                        type="number"
                        min="0"
                        step="20"
                        value={energyParameters.solarRatedW}
                        onChange={(event) => {
                          const v = event.target.valueAsNumber;
                          if (Number.isFinite(v) && v >= 0)
                            setEnergyParameters((p) => ({
                              ...p,
                              solarRatedW: v,
                            }));
                        }}
                      />
                    </label>
                    <label>
                      Hotel load / W
                      <input
                        aria-label="Assumed hotel load watts"
                        type="number"
                        min="0"
                        step="10"
                        value={energyParameters.hotelLoadW}
                        onChange={(event) => {
                          const v = event.target.valueAsNumber;
                          if (Number.isFinite(v) && v >= 0)
                            setEnergyParameters((p) => ({
                              ...p,
                              hotelLoadW: v,
                            }));
                        }}
                      />
                    </label>
                    <label>
                      Transmitter / W
                      <input
                        aria-label="Assumed transmitter load watts"
                        type="number"
                        min="0"
                        step="10"
                        value={energyParameters.transmitterLoadW}
                        onChange={(event) => {
                          const v = event.target.valueAsNumber;
                          if (Number.isFinite(v) && v >= 0)
                            setEnergyParameters((p) => ({
                              ...p,
                              transmitterLoadW: v,
                            }));
                        }}
                      />
                    </label>
                  </div>
                  <label className="tracking-assumption">
                    <input
                      type="checkbox"
                      checked={energyParameters.trackSunAzimuth}
                      onChange={(event) =>
                        setEnergyParameters((p) => ({
                          ...p,
                          trackSunAzimuth: event.target.checked,
                        }))
                      }
                    />
                    Array tracks Sun azimuth (assumed)
                  </label>
                  <div className="hardware-fields">
                    <label>
                      Array tilt / degrees
                      <input
                        aria-label="Array tilt from horizontal in degrees"
                        type="number"
                        min="0"
                        max="90"
                        value={energyParameters.panelTiltDeg}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber;
                          if (
                            Number.isFinite(value) &&
                            value >= 0 &&
                            value <= 90
                          )
                            setEnergyParameters((p) => ({
                              ...p,
                              panelTiltDeg: value,
                            }));
                        }}
                      />
                    </label>
                    <label>
                      Fixed array heading / degrees
                      <input
                        aria-label="Fixed array azimuth clockwise from north"
                        type="number"
                        min="0"
                        max="359"
                        disabled={energyParameters.trackSunAzimuth}
                        value={energyParameters.panelAzimuthDeg}
                        onChange={(event) => {
                          const value = event.target.valueAsNumber;
                          if (
                            Number.isFinite(value) &&
                            value >= 0 &&
                            value < 360
                          )
                            setEnergyParameters((p) => ({
                              ...p,
                              panelAzimuthDeg: value,
                            }));
                        }}
                      />
                    </label>
                  </div>
                  <p>
                    100% initial usable charge. Tilt{" "}
                    {energyParameters.panelTiltDeg}° from horizontal; fixed
                    heading {energyParameters.panelAzimuthDeg}° when tracking is
                    off. Presets are editable assumptions, not verified lander
                    specifications.
                  </p>
                </section>
              </>
            )}
            {sheet === "evidence" && (
              <>
                <p>
                  Every view is an exploration of a bounded NASA-derived study,
                  not flight-operational advice.
                </p>
                <button
                  className="outline-button full-width"
                  onClick={exportAnalysis}
                >
                  <Icon name="download" size={17} />
                  Download inputs, results & provenance
                </button>
                <p className="texture-credit">
                  Moon overview: NASA’s Scientific Visualization Studio / Ernie
                  Wright, LROC & LOLA.{" "}
                  <a
                    href="https://svs.gsfc.nasa.gov/4720/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CGI Moon Kit ↗
                  </a>
                  . Display mosaic is optimized for aesthetics; local analysis
                  uses the separate elevation/horizon dataset.
                </p>
                <section className="model-panel">
                  <h2>Model scope</h2>
                  <dl>
                    <dt>Geometry</dt>
                    <dd>
                      {mode === "reference"
                        ? "DE421 / geometric"
                        : "Synthetic fixture"}
                    </dd>
                    <dt>Terrain horizon</dt>
                    <dd>
                      {mode === "reference"
                        ? "30 km baked radius"
                        : "Illustrative"}
                    </dd>
                    <dt>Observer height</dt>
                    <dd>
                      {data.provenance.observerMastHeightMeters} m / baked
                    </dd>
                    <dt>Sampling</dt>
                    <dd>Hourly intervals</dd>
                    <dt>AI / ML</dt>
                    <dd>Trained / research only</dd>
                  </dl>
                  <p>
                    Terrain and inputs are inspectable. Battery integration uses
                    the explicit hardware assumptions. Surface temperature is
                    exploratory equilibrium, never spacecraft survival.
                  </p>
                </section>
                <section id="methodology" className="methodology">
                  <div>
                    <h2>Trace the data. Question the result.</h2>
                    <p>{data.provenance.notes}</p>
                    <details>
                      <summary>Resolution checks & scientific limits</summary>
                      <p>
                        Centre-only sensitivity: 0.5° angular sampling changes
                        the skyline by up to{" "}
                        {resolutionChecks.terrainSensitivity.halfDegreeMidpointMaxDifferenceDeg.toFixed(
                          3,
                        )}
                        °; finer radial sampling by{" "}
                        {resolutionChecks.terrainSensitivity.finerRadialSamplingMaxDifferenceDeg.toFixed(
                          3,
                        )}
                        °. Increasing ray range from 20 to 30 km changes it by{" "}
                        {resolutionChecks.terrainSensitivity.twentyVsThirtyKmMaxDifferenceDeg.toFixed(
                          3,
                        )}
                        °. Horizon convergence beyond 30 km is not established.
                      </p>
                      <p>
                        A seven-day, 5 m centre case gave identical geometric
                        interval metrics at hourly and 15-minute sampling. This
                        single case is not a general error bound. Pixel spacing
                        is not effective terrain resolution; unsampled terrain
                        between points remains unchecked.
                      </p>
                    </details>
                    <details>
                      <summary>Actual ML training & evaluation</summary>
                      <p>
                        {modelEvaluation.totalLabelledCases.toLocaleString()}{" "}
                        Rust-labelled scenarios;{" "}
                        {modelEvaluation.trainingCases.toLocaleString()}{" "}
                        training cases. CPU neural network with separate spatial
                        and temporal holdouts. Later-date holdout produced{" "}
                        {
                          modelEvaluation.splits.temporal_holdout
                            .falseFeasibleCases
                        }{" "}
                        false-feasible predictions in{" "}
                        {modelEvaluation.splits.temporal_holdout.cases} cases.
                        Deployment decision: research only. Every result shown
                        here comes from Rust, not this model.
                      </p>
                      <p>
                        Training code, saved weights, labels, notebook and
                        evaluation report are included in experiments/surrogate.
                        These labels describe sampled geometry, not observed
                        mission success.
                      </p>
                    </details>
                    <details>
                      <summary>Sources and model assumptions</summary>
                      <ul>
                        {data.provenance.sourceUrls?.map((url) => (
                          <li key={url}>
                            <a href={url} target="_blank" rel="noreferrer">
                              {url}
                            </a>
                          </li>
                        ))}
                        {evaluation.result?.assumptions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                        {analysis?.energy?.assumptions.map((a, i) => (
                          <li key={`energy-${i}`}>{a}</li>
                        ))}
                      </ul>
                    </details>
                  </div>
                  <div>
                    <span className="data-tag">
                      {data.provenance.dataFidelity.replace("_", " ")}
                    </span>
                    <code>{data.datasetId}</code>
                  </div>
                </section>
                <details className="register-details">
                  <summary>All evaluated positions</summary>
                  <section className="comparison-panel" id="comparison">
                    <div className="panel-header">
                      <h2>Analysis register</h2>
                      <span className="subtle">
                        ONE WINDOW · ONE SET OF LIMITS
                      </span>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Evaluated position</th>
                            <th>Sun access</th>
                            <th>Earth visibility</th>
                            <th>Max darkness</th>
                            <th>Continuous Earth</th>
                            <th>Selected limits</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.positions.map((p) => {
                            const result = evaluation.result?.positions.find(
                              (r) => r.positionId === p.positionId,
                            );
                            return (
                              <tr key={p.positionId}>
                                <th scope="row">
                                  <button
                                    onClick={() => setSelected(p.positionId)}
                                  >
                                    {p.label}
                                  </button>
                                </th>
                                <td>{percent(result?.sunVisibleFraction)}</td>
                                <td>{percent(result?.earthVisibleFraction)}</td>
                                <td>{hours(result?.longestDarknessHours)}</td>
                                <td>
                                  {hours(result?.longestEarthVisibleHours)}
                                </td>
                                <td>
                                  {result
                                    ? check(result).length
                                      ? "Exceeded"
                                      : "Met"
                                    : "Pending"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </details>
              </>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
