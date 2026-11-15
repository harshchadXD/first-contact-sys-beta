import type { ReactNode } from "react";

type Props = { persona: "PLANNER" | "EDUCATOR"; onPersona: (next: "PLANNER" | "EDUCATOR") => void; onReplay: () => void; time: number; maxTime: number; onTime: (v: number) => void; children?: ReactNode };

export default function HeaderAdamBridge({ persona, onPersona, onReplay, time, maxTime, onTime }: Props) {
  return <header className="topbar">
    <div className="brand-mark"><svg viewBox="0 0 108 40" role="img" aria-label="First Contact bridge">
      <path className="arm arm-left" d="M3 30 17 10l9 5 7-9 8 5 7-2 7 14-3 7-9-2-7 5-8-3-8 5z" />
      <path className="arm arm-right" d="m105 30-14-20-9 5-7-9-8 5-7-2-7 14 3 7 9-2 7 5 8-3 8 5z" />
      <path className="wire" d="M8 28 19 12l8 5 6-8 7 5 7-2 4 9m49 7L89 12l-8 5-6-8-7 5-7-2-4 9" />
      <path className="bridge-ray" d="M48 22h12" /><circle className="bridge-spark" cx="54" cy="22" r="2.8" />
    </svg></div>
    <div className="brand-copy"><div className="brand-title">FIRST CONTACT<span>.SYS</span><i>MISSION CONSOLE / 01</i></div><div className="brand-sub">LUNAR SOUTH POLE SITE ANALYSIS <b>·</b> DE421 / LOLA</div></div>
    <div className="header-divider" />
    <div className="header-time"><span className="eyebrow">MISSION TIME SCRUBBER</span><div className="time-line"><input aria-label="Mission timeline" type="range" min="0" max={Math.max(1, maxTime - 1)} value={Math.min(time, Math.max(0, maxTime - 1))} onChange={(e) => onTime(Number(e.target.value))} /><strong>T+{String(Math.floor(time / 24)).padStart(2, "0")}D:{String(time % 24).padStart(2, "0")}H</strong></div></div>
    <div className="header-actions"><div className="persona-toggle" aria-label="Persona mode"><button className={persona === "PLANNER" ? "selected" : ""} onClick={() => onPersona("PLANNER")}>PLANNER</button><button className={persona === "EDUCATOR" ? "selected" : ""} onClick={() => onPersona("EDUCATOR")}>EDUCATOR</button></div><button className="replay-button" onClick={onReplay}><span>◉</span> FAILURE REPLAY</button></div>
  </header>;
}
