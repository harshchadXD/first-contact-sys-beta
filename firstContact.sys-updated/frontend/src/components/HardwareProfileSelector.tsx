const profiles = [
  { name: "NOVA-C", operator: "INTUITIVE MACHINES", hotel: 120, array: 500, battery: 1200, comms: 80, code: "IM-1 / IM-2" },
  { name: "GRIFFIN", operator: "ASTROBOTIC", hotel: 280, array: 900, battery: 2400, comms: 120, code: "CLPS LANDER" },
  { name: "BLUE GHOST", operator: "FIREFLY AEROSPACE", hotel: 160, array: 600, battery: 1800, comms: 100, code: "GHOST RIDERS" },
  { name: "VIKRAM", operator: "ISRO", hotel: 100, array: 450, battery: 1000, comms: 70, code: "CHANDRAYAAN-3" },
];

export default function HardwareProfileSelector({ value, onChange }: { value: number; onChange: (index: number) => void }) {
  const active = profiles[value];
  return <section className="hardware-panel">
    <div className="section-heading"><div><span className="eyebrow">VEHICLE / POWER BUDGET</span><h2>Hardware profile</h2></div><span className="provisional-tag">PROVISIONAL LOADS</span></div>
    <div className="hardware-tabs">{profiles.map((p, i) => <button key={p.name} onClick={() => onChange(i)} className={value === i ? "active" : ""}><span>{p.code}</span><b>{p.name}</b></button>)}</div>
    <div className="hardware-stats"><div><span>HOTEL LOAD</span><strong>{active.hotel}<small> W</small></strong></div><div><span>SOLAR ARRAY</span><strong>{active.array}<small> W</small></strong></div><div><span>BATTERY</span><strong>{active.battery.toLocaleString()}<small> Wh</small></strong></div><div><span>TX LOAD</span><strong>{active.comms}<small> W</small></strong></div></div>
    <p className="micro-note">Power-system ratings are starter assumptions, not flight-verified lander telemetry.</p>
  </section>;
}
