import type { GMReference, GMValues } from "../types";

export default function GMParameterPanel({ reference, values, onChange, onSave, onRestore, saved }: {
  reference: GMReference; values: GMValues; onChange: (id: string, value: number) => void; onSave: () => void; onRestore: () => void; saved: boolean;
}) {
  return <section className="panel gm-panel">
    <div className="section-heading"><div><span className="eyebrow">N-BODY WHAT-IF / KM³ S⁻²</span><h2>Gravitational parameters</h2></div><span className="small-chip">DE421 DEFAULT</span></div>
    <p className="gm-intro">Edit a GM to propagate a separate sensitivity scenario from the unchanged DE421 starting state. Ratios are derived from the Sun GM.</p>
    <div className="gm-head"><span>BODY</span><span>GM · km³/s²</span><span>GM☉ / GM</span></div>
    <div className="gm-list">{reference.bodies.filter((body) => body.id !== "earth_moon").map((body) => {
      const value = values[body.id] ?? body.gm_km3_s2;
      const relative = Math.max(0.8, Math.min(1.2, value / body.gm_km3_s2));
      return <div className="gm-row" key={body.id}>
        <label htmlFor={`gm-${body.id}`}>{body.name}<small>{body.id === "earth" || body.id === "moon" ? "EARTH–MOON PAIR" : body.kind?.toUpperCase?.() ?? "BODY"}</small></label>
        <div className="gm-value-control"><input id={`gm-${body.id}`} className="gm-range" type="range" min="0.8" max="1.2" step="0.0001" value={relative} onChange={(e) => onChange(body.id, body.gm_km3_s2 * Number(e.target.value))} aria-label={`${body.name} GM sensitivity slider`} /><input className="gm-number" type="number" min="0" step="any" value={Number(value.toPrecision(12))} onChange={(e) => onChange(body.id, Number(e.target.value))} /></div>
        <output>{body.id === "sun" ? "1.000000" : (values.sun / value).toLocaleString("en-US", { maximumSignificantDigits: 8 })}</output>
      </div>;
    })}</div>
    <div className="gm-actions"><button className="quiet-button" onClick={onRestore}>RESTORE DE421</button><button className="save-button" onClick={onSave}>{saved ? "SAVED ✓" : "SAVE GM SET"}</button></div>
    <div className="model-note"><span>MODEL SCOPE</span><p>Newtonian point masses · 1-hour sample steps · frozen lunar orbit and orientation. Topocentric selenographic reference frame · Sensitivity model.</p></div>
  </section>;
}
