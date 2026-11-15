import type { CSSProperties } from "react";
import type { LaunchWindow } from "../types";

export default function LaunchSlipMatrix({ windows, selected, onSelect }: { windows: LaunchWindow[]; selected: number; onSelect: (day: number) => void }) {
  const best = windows.reduce((a, b) => (b.survives && (!a || b.sunPct > a.sunPct) ? b : a), null as LaunchWindow | null);
  return <section className="panel launch-panel">
    <div className="section-heading"><div><span className="eyebrow">30-DAY ROLLING ARRIVAL WINDOWS</span><h2>Launch slip matrix</h2></div><span className="best-window">{best ? `BEST WINDOW · D+${String(best.day).padStart(2, "0")}` : "NO SURVIVING WINDOW"}</span></div>
    <div className="launch-grid">{windows.map((window) => {
      const color = window.survives ? `rgba(56,189,248,${0.2 + window.sunPct / 130})` : `rgba(244,63,94,${0.2 + Math.min(0.55, window.darknessH / 100)})`;
      return <button key={window.day} style={{ "--window-color": color } as CSSProperties} className={`launch-cell ${window.day === selected ? "selected" : ""} ${window.survives ? "survives" : "fails"}`} onClick={() => onSelect(window.day)} title={`Day ${window.day}: ${window.sunPct.toFixed(1)}% sun, ${window.darknessH.toFixed(0)}h longest darkness, min battery ${window.minSocPct.toFixed(0)}%`}>
        <span>D{String(window.day).padStart(2, "0")}</span><i />
      </button>;
    })}</div>
    <div className="launch-legend"><span><i className="legend-sun" />SURVIVAL WINDOW</span><span><i className="legend-hazard" />ENERGY SHORTFALL</span><span className="selected-window">SELECTED D+{String(selected).padStart(2, "0")}</span></div>
  </section>;
}
