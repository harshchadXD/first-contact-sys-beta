import type { DispersionCell } from "../types";

export default function DispersionGrid500m({ cells, selected, onSelect }: { cells: DispersionCell[]; selected: DispersionCell | null; onSelect: (cell: DispersionCell) => void }) {
  const picked = selected ?? cells.find((c) => c.dx_m === 0 && c.dy_m === 0) ?? cells[12];
  return <section className="panel dispersion-panel">
    <div className="section-heading"><div><span className="eyebrow">LOCAL TERRAIN / 500 M FOOTPRINT</span><h2>Landing dispersion</h2></div><span className="small-chip">5 × 5 CELLS</span></div>
    <div className="grid-wrap"><div className="north-arrow">N ↑</div><div className="dispersion-grid" role="grid" aria-label="Landing dispersion cells">
      {cells.map((cell) => <button key={`${cell.dx_m}:${cell.dy_m}`} role="gridcell" aria-pressed={cell === picked} onClick={() => onSelect(cell)} className={`grid-cell ${cell.status.toLowerCase().replaceAll("_", "-")} ${cell === picked ? "chosen" : ""}`} title={`${cell.dx_m} m east, ${cell.dy_m} m north · ${cell.status}`}>
        <span className="cell-dot" />{cell.slope_deg == null ? "—" : `${cell.slope_deg.toFixed(1)}°`}
      </button>)}
    </div></div>
    <div className="cell-readout"><div className={`status-pip ${picked.status.toLowerCase().replaceAll("_", "-")}`} /><div className="cell-coords">SELECTED OFFSET<strong>{picked.dx_m > 0 ? "+" : ""}{picked.dx_m} E / {picked.dy_m > 0 ? "+" : ""}{picked.dy_m} N <small>m</small></strong></div><div><span>SLOPE</span><strong>{picked.slope_deg == null ? "—" : `${picked.slope_deg.toFixed(1)}°`}</strong></div><div><span>HEIGHT RMS</span><strong>{picked.rms_height_uncertainty_m == null ? "N/A" : `${picked.rms_height_uncertainty_m.toFixed(2)} m`}</strong></div></div>
    <p className="micro-note">Cell spacing 100 m · surface offset grid ±200 m from reference point.</p>
  </section>;
}
