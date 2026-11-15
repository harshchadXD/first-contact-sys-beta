import type { MissionRecord } from "../types";

export default function HorizonPanorama2D({ horizon, timeline, timeIndex, educator }: { horizon: number[]; timeline: MissionRecord[]; timeIndex: number; educator: boolean }) {
  const width = 720, height = 250, pad = { left: 42, right: 16, top: 20, bottom: 32 };
  const plotW = width - pad.left - pad.right, plotH = height - pad.top - pad.bottom;
  const y = (v: number) => pad.top + plotH - ((v + 3) / 15) * plotH;
  const horizonPath = horizon.map((v, i) => `${i ? "L" : "M"}${pad.left + (i / 359) * plotW},${y(v)}`).join(" ");
  const pathFor = (body: "sun" | "earth") => timeline.filter((_, i) => i % 3 === 0).map((point, i) => {
    const az = body === "sun" ? point.sunAz : point.earthAz;
    const el = body === "sun" ? point.sunEl : point.earthEl;
    return `${i ? "L" : "M"}${pad.left + (az / 360) * plotW},${y(el)}`;
  }).join(" ");
  const current = timeline[Math.min(timeIndex, timeline.length - 1)];
  const sunX = pad.left + (current.sunAz / 360) * plotW, sunY = y(current.sunEl);
  return <section className="panel horizon-panel">
    <div className="section-heading"><div><span className="eyebrow">LOCAL SKY / MOON MEAN EARTH</span><h2>Horizon & visibility</h2></div><div className="chart-legend"><span><i className="legend-sun" />SUN</span><span><i className="legend-earth" />EARTH</span><span><i className="legend-horizon" />TERRAIN</span></div></div>
    <svg className="horizon-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="360 degree horizon and Sun and Earth elevation paths">
      {[0, 3, 6, 9, 12].map((v) => <g key={v}><line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} className="chart-grid" /><text x={pad.left - 8} y={y(v) + 4} textAnchor="end" className="chart-label">{v}°</text></g>)}
      <path d={`${horizonPath} L${width - pad.right},${y(-3)} L${pad.left},${y(-3)} Z`} className="horizon-fill" />
      {educator && <><path d={`M${pad.left},${y(0.57)} H${width - pad.right} V${y(0)} H${pad.left} Z`} className="refraction-band" /><text x={width - pad.right - 4} y={y(0.3)} textAnchor="end" className="refraction-label">+0.57° atmosphere comparison</text></>}
      <path d={pathFor("sun")} className="sun-path" /><path d={pathFor("earth")} className="earth-path" />
      <path d={horizonPath} className="horizon-line" />
      <line x1={sunX} x2={sunX} y1={sunY} y2={height - pad.bottom} className="scrub-line" /><circle cx={sunX} cy={sunY} r="5" className="sun-marker" />
      {[0, 90, 180, 270, 360].map((v) => <text key={v} x={pad.left + (v / 360) * plotW} y={height - 9} textAnchor="middle" className="chart-label">{v}°</text>)}
    </svg>
    <div className="chart-foot"><span>AZIMUTH / 0° N · CLOCKWISE</span><span>EARTH PATH SHOWS LOCAL SKY TRACK · 27.3 D CYCLE</span></div>
  </section>;
}
