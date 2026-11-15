import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BatteryCharging,
  Check,
  Clock3,
  Cpu,
  Radio,
  Sun,
  X,
  Zap,
} from 'lucide-react';

export type ParetoRepairStatus = 'IDLE' | 'COMPUTING (WASM)' | 'OPTIMIZED';

export interface ParetoRepairImpact {
  label: string;
  value: string;
  tone?: 'cyan' | 'emerald' | 'amber';
}

export interface ParetoRepairCandidate {
  id: string;
  title: string;
  impacts: ParetoRepairImpact[];
}

export interface ParetoRepairDrawerProps {
  status: ParetoRepairStatus;
  scenariosTested: number;
  feasibleTrajectories: number;
  computeTimeMs: number;
  candidates: ParetoRepairCandidate[];
  onRunSolver: () => void | Promise<void>;
  onApplyRepair: (candidate: ParetoRepairCandidate) => void;
}

const STATUS_STYLES: Record<ParetoRepairStatus, string> = {
  IDLE: 'border-slate-700 bg-slate-900 text-slate-300',
  'COMPUTING (WASM)': 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  OPTIMIZED: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
};

const IMPACT_STYLES: Record<
  NonNullable<ParetoRepairImpact['tone']>,
  string
> = {
  cyan: 'border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-200',
  emerald: 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200',
  amber: 'border-amber-400/20 bg-amber-400/[0.07] text-amber-200',
};

const IMPACT_ICONS = {
  Shadow: Sun,
  Comms: Radio,
  'Min Battery': BatteryCharging,
};

export function ParetoRepairDrawer({
  status,
  scenariosTested,
  feasibleTrajectories,
  computeTimeMs,
  candidates,
  onRunSolver,
  onApplyRepair,
}: ParetoRepairDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const startSolver = () => {
    setIsOpen(true);
    void onRunSolver();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={startSolver}
          disabled={status === 'COMPUTING (WASM)'}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-left text-xs font-bold tracking-wide text-cyan-200 shadow-[0_0_24px_rgba(56,189,248,0.08)] transition hover:border-cyan-300/70 hover:bg-cyan-400/15 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-70 sm:text-sm"
        >
          <Zap className="h-4 w-4 shrink-0 text-cyan-300" />
          <span>⚡ RUN PARETO REPAIR SOLVER (WASM 4,500 COMBINATIONS)</span>
        </button>
        <span
          role="status"
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] font-bold tracking-wider ${STATUS_STYLES[status]}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status === 'COMPUTING (WASM)'
                ? 'animate-pulse bg-cyan-300'
                : status === 'OPTIMIZED'
                  ? 'bg-emerald-300'
                  : 'bg-slate-500'
            }`}
          />
          {status}
        </span>
      </div>

      <div
        className={`fixed inset-0 z-50 transition-[visibility] duration-300 ${
          isOpen ? 'visible' : 'invisible delay-300'
        }`}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          aria-label="Close Pareto repair drawer"
          onClick={() => setIsOpen(false)}
          className={`absolute inset-0 h-full w-full bg-[#020617]/75 backdrop-blur-sm transition-opacity duration-300 ${
            isOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="pareto-drawer-title"
          className={`absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-[#1E293B] bg-[#080C14] text-slate-100 shadow-2xl transition-transform duration-300 ease-out ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <header className="flex items-start justify-between gap-4 border-b border-[#1E293B] bg-[#0F172A]/80 px-5 py-5 sm:px-7">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
                <Activity className="h-3.5 w-3.5" />
                Mission repair / Pareto frontier
              </div>
              <h2
                id="pareto-drawer-title"
                className="text-xl font-semibold tracking-tight text-white sm:text-2xl"
              >
                Mission Repair Solver
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400 sm:text-sm">
                Feasible trade-offs ranked across mission constraints.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close drawer"
              className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:border-slate-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <section
            aria-label="Solver telemetry"
            className="grid grid-cols-2 gap-px border-b border-[#1E293B] bg-[#1E293B] sm:grid-cols-4"
          >
            <TelemetryMetric
              icon={<Cpu className="h-3.5 w-3.5" />}
              label="Scenarios tested"
              value={scenariosTested.toLocaleString()}
              detail="combinations"
            />
            <TelemetryMetric
              icon={<Activity className="h-3.5 w-3.5" />}
              label="Feasible paths"
              value={feasibleTrajectories.toLocaleString()}
              detail="trajectories"
            />
            <TelemetryMetric
              icon={<Clock3 className="h-3.5 w-3.5" />}
              label="Compute time"
              value={computeTimeMs.toLocaleString()}
              detail="milliseconds"
            />
            <TelemetryMetric
              icon={<Zap className="h-3.5 w-3.5" />}
              label="Engine"
              value="Rust WASM"
              detail="v1.0"
            />
          </section>

          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Pareto-optimal solutions
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Select a repair to update the active mission plan.
                </p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                {candidates.length} candidates
              </span>
            </div>

            {candidates.length > 0 ? (
              <div className="space-y-3">
                {candidates.map((candidate, index) => (
                  <article
                    key={candidate.id}
                    className="rounded-xl border border-[#1E293B] bg-[#0F172A]/75 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.14)] sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.08] font-mono text-xs font-bold text-cyan-300">
                          {String.fromCharCode(65 + index)}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold leading-snug text-white sm:text-base">
                            {candidate.title}
                          </h4>
                          <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                            Non-dominated trajectory
                          </p>
                        </div>
                      </div>
                      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {candidate.impacts.map((impact) => {
                        const Icon =
                          IMPACT_ICONS[impact.label as keyof typeof IMPACT_ICONS];
                        const tone = impact.tone ?? 'cyan';
                        return (
                          <div
                            key={`${impact.label}-${impact.value}`}
                            className={`flex min-w-0 items-start gap-2 rounded-lg border px-3 py-2.5 ${IMPACT_STYLES[tone]}`}
                          >
                            {Icon ? (
                              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                            ) : (
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" />
                            )}
                            <span className="min-w-0">
                              <span className="block text-[9px] font-bold uppercase tracking-wider opacity-70">
                                {impact.label}
                              </span>
                              <span className="mt-0.5 block break-words text-xs font-semibold leading-snug">
                                {impact.value}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => onApplyRepair(candidate)}
                      className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.08] px-4 py-2 text-xs font-bold tracking-wider text-emerald-300 transition hover:border-emerald-300/60 hover:bg-emerald-400/15 hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                    >
                      <Check className="h-4 w-4" />
                      APPLY TO MISSION
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 bg-[#0F172A]/40 px-5 py-12 text-center">
                <Zap className="mx-auto h-6 w-6 text-slate-600" />
                <p className="mt-3 text-sm font-medium text-slate-300">
                  {status === 'COMPUTING (WASM)'
                    ? 'Evaluating mission trajectories…'
                    : 'No repair candidates yet'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {status === 'COMPUTING (WASM)'
                    ? 'Pareto-optimal solutions will appear here when the worker finishes.'
                    : 'Run the solver to generate feasible mission trade-offs.'}
                </p>
              </div>
            )}
          </div>

          <footer className="border-t border-[#1E293B] bg-[#0F172A]/55 px-5 py-3 text-center text-[10px] font-mono text-slate-500 sm:px-7">
            Rust WebAssembly v1.0 <span className="px-1.5 text-slate-700">/</span>
            Computation runs locally in your browser
          </footer>
        </aside>
      </div>
    </>
  );
}

interface TelemetryMetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}

function TelemetryMetric({ icon, label, value, detail }: TelemetryMetricProps) {
  return (
    <div className="min-w-0 bg-[#0B111C] px-3 py-3 sm:px-4">
      <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
        <span className="text-cyan-400">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 truncate font-mono text-lg font-bold tabular-nums text-slate-100">
        {value}
      </div>
      <div className="text-[9px] text-slate-500">{detail}</div>
    </div>
  );
}
