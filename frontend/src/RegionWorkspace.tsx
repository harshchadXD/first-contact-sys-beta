import { useRef, useState } from "react";
import originalStudy from "./data/shackletonStudy.json";
import MissionControl from "./MissionControl";
import { validateStudyPayload } from "./services/studyLoader";
import type { PreparedStudy, RegionId, SavedView } from "./types/study";

export default function RegionWorkspace() {
  const cache = useRef(
    new Map<RegionId, PreparedStudy>([["shackleton", originalStudy]]),
  );
  const [active, setActive] = useState<{
    id: RegionId;
    study: PreparedStudy;
    configuration?: SavedView;
    generation: number;
  }>({ id: "shackleton", study: originalStudy, generation: 0 });
  const [saved, setSaved] = useState<SavedView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const run = useRef(0);
  async function select(id: RegionId, configuration?: SavedView) {
    const token = ++run.current;
    setLoading(true);
    setError("");
    try {
      let study = cache.current.get(id);
      if (!study) {
        const response = await fetch("/data/connecting-ridge-study.json");
        if (!response.ok)
          throw new Error(
            `Regional data unavailable (HTTP ${response.status}).`,
          );
        const payload: unknown = await response.json();
        validateStudyPayload(payload);
        if (payload.dataset.datasetId !== "pgda-site01-ridge-geographic-de421")
          throw new Error("The downloaded region has the wrong identity.");
        study = payload;
        cache.current.set(id, study);
      }
      if (token !== run.current) return;
      setActive((previous) => ({
        id,
        study,
        configuration,
        generation: previous.generation + 1,
      }));
    } catch (cause) {
      if (token === run.current)
        setError(
          cause instanceof Error ? cause.message : "Region could not load.",
        );
    } finally {
      if (token === run.current) setLoading(false);
    }
  }
  return (
    <>
      <div inert={loading || !!error}>
        <MissionControl
          key={active.generation}
          study={active.study}
          regionId={active.id}
          initialConfiguration={active.configuration}
          baseline={saved}
          onKeep={setSaved}
          onRestore={(view) => void select(view.regionId, view)}
          onRegionChange={(id, current) =>
            void select(
              id,
              current
                ? { ...current, regionId: id, positionId: "0:0" }
                : undefined,
            )
          }
        />
      </div>
      {loading && (
        <div className="region-loading" role="status">
          Loading and checking regional terrain…
        </div>
      )}
      {error && (
        <div className="region-loading" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
    </>
  );
}
