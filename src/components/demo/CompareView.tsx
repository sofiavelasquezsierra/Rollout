"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { branchVar } from "@/lib/tokens";
import { headFrame } from "@/store/run";
import { summarize, type BranchSummary } from "@/store/selectors";
import type { Evaluation } from "@/store/types";
import { useRollout } from "@/store/useRollout";
import { Button, IconButton, Label, Thinking } from "@/components/ui/primitives";
import { scoreTone } from "./ScoreChip";
import { MiniWorld } from "./world/MiniWorld";

type Metric = { label: string; a: number; b: number; fmt?: (n: number) => string; better: "low" | "high" };

/** Side-by-side comparison of two branches with a synchronized frame scrubber. */
export function CompareView() {
  const run = useRollout((s) => s.run);
  const pair = useRollout((s) => s.compare);
  const evaluating = useRollout((s) => s.evaluating);
  const { setCompare, evaluate } = useRollout.getState();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [frame, setFrame] = useState<number | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const [aId, bId] = pair!;
  const A = summarize(run, aId);
  const B = summarize(run, bId);
  const maxFrame = Math.max(A.head, B.head);
  const f = frame ?? maxFrame;

  const metrics: Metric[] = useMemo(
    () => [
      { label: "Ticks used", a: A.head, b: B.head, better: "low" },
      { label: "Crystals", a: A.collected, b: B.collected, fmt: (n) => `${n}/${A.total}`, better: "high" },
      { label: "Red-zone ticks", a: A.hazardHits, b: B.hazardHits, better: "low" },
      { label: "Wall bumps", a: A.wallBumps, b: B.wallBumps, better: "low" },
      { label: "Agent calls", a: A.decisions, b: B.decisions, better: "low" },
    ],
    [A, B],
  );

  const pick = (slot: 0 | 1, id: string) => {
    const next: [string, string] = slot === 0 ? [id, bId] : [aId, id];
    setCompare(next);
  };

  const scoreBoth = () => {
    for (const s of [A, B]) {
      const e = s.branch.evaluation;
      if (!e || e.atFrame !== s.head) void evaluate(s.branch.id);
    }
  };
  const anyPending = evaluating[aId] || evaluating[bId];
  const needsScore = [A, B].some((s) => !s.branch.evaluation || s.branch.evaluation.atFrame !== s.head);
  const anyScored = Boolean(A.branch.evaluation || B.branch.evaluation);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-title"
      className="absolute inset-0 z-30 flex animate-rise-in flex-col bg-bg/97 backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <h2 id="compare-title" className="text-15 font-medium">
          Compare branches
        </h2>
        <div className="flex items-center gap-2">
          <BranchSelect value={aId} other={bId} onChange={(id) => pick(0, id)} label="Left branch" />
          <span className="font-mono text-12 text-ink-3">vs</span>
          <BranchSelect value={bId} other={aId} onChange={(id) => pick(1, id)} label="Right branch" />
          <IconButton icon="refresh" label="Swap sides" onClick={() => setCompare([bId, aId])} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button icon="scale" onClick={scoreBoth} disabled={anyPending || !needsScore}>
            {anyPending ? (
              <>
                Scoring <Thinking />
              </>
            ) : !needsScore ? (
              "Both scored"
            ) : anyScored ? (
              "Score remaining"
            ) : (
              "Score both"
            )}
          </Button>
          <IconButton ref={closeRef} icon="close" label="Close comparison" shortcut="Escape" onClick={() => setCompare(null)} />
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-line px-5 py-2">
        <Label>Synced frame</Label>
        <input
          type="range"
          min={0}
          max={maxFrame}
          value={f}
          onChange={(e) => setFrame(Number(e.target.value))}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Synchronized frame for both branches"
          className="h-1 flex-1 cursor-pointer accent-[var(--c-accent)]"
        />
        <span className="w-20 text-right font-mono text-13 tabular text-ink">f{String(f).padStart(3, "0")}</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-px overflow-y-auto bg-line [&>section]:min-h-full">
        {[A, B].map((S, i) => (
          <Column key={S.branch.id} S={S} other={i === 0 ? B : A} frame={f} metrics={metrics} side={i === 0 ? "a" : "b"} pending={!!evaluating[S.branch.id]} />
        ))}
      </div>
    </div>
  );
}

function Column({
  S,
  other,
  frame,
  metrics,
  side,
  pending,
}: {
  S: BranchSummary;
  other: BranchSummary;
  frame: number;
  metrics: Metric[];
  side: "a" | "b";
  pending: boolean;
}) {
  const run = useRollout((s) => s.run);
  const b = S.branch;
  const color = branchVar(b.colorIndex);
  const e = b.evaluation;
  const oe = other.branch.evaluation;

  return (
    <section aria-label={`Branch ${b.name}`} className="flex min-w-0 flex-col gap-4 bg-bg p-5">
      <header className="flex items-center gap-2.5">
        <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
        <h3 className="truncate text-15 text-ink">{b.name}</h3>
        <span className="font-mono text-12 text-ink-3">
          {b.parentId ? `⑂ ${run.branches[b.parentId].name}@${b.forkFrame}` : "root"} · {S.outcome}
        </span>
        {e && (
          <span className={`ml-auto rounded-sm border px-2 py-0.5 font-mono text-18 tabular ${scoreTone(e.overall)}`}>
            {e.overall.toFixed(1)}
          </span>
        )}
      </header>

      <div className="mx-auto w-full max-w-[calc(28vh*1.5)] shrink-0 overflow-hidden rounded-md border border-line">
        <MiniWorld run={run} branchId={b.id} frame={Math.min(frame, S.head)} label={`${b.name} at frame ${Math.min(frame, S.head)}`} />
      </div>
      <p className="-mt-2 h-4 text-center font-mono text-12 text-ink-3">
        {frame > S.head ? `ended at f${S.head}` : `f${frame}`}
      </p>

      <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-13">
        {metrics.map((m) => {
          const mine = side === "a" ? m.a : m.b;
          const theirs = side === "a" ? m.b : m.a;
          const wins = m.better === "low" ? mine < theirs : mine > theirs;
          return (
            <div key={m.label} className="contents">
              <dt className="text-ink-2">{m.label}</dt>
              <dd className={`text-right font-mono tabular ${wins ? "text-ok" : "text-ink"}`}>
                {wins && <span className="mr-1 text-12" aria-label="better">▲</span>}
                {m.fmt ? m.fmt(mine) : mine}
              </dd>
            </div>
          );
        })}
      </dl>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Evaluator</Label>
          {e && (
            <span className="font-mono text-12 text-ink-3">
              {e.source === "claude" ? e.model ?? "claude" : "heuristic (no API)"}
              {e.atFrame !== S.head && " · stale"}
            </span>
          )}
        </div>
        {pending ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((k) => (
              <div key={k} className="h-12 animate-pulse rounded-md bg-surface-2" />
            ))}
          </div>
        ) : e ? (
          <div className="space-y-3">
            <Rubric label="Progress" r={e.progress} other={oe?.progress.score} color={color} />
            <Rubric label="Efficiency" r={e.efficiency} other={oe?.efficiency.score} color={color} />
            <Rubric label="Safety" r={e.safety} other={oe?.safety.score} color={color} />
            <p className="border-t border-line pt-3 text-13 leading-relaxed text-ink-2">{e.summary}</p>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-line-strong p-3 text-12 text-ink-3">
            Not scored yet. “Score both” sends each branch to a separate evaluator call (distinct from the agent) that
            grades progress, efficiency and safety.
          </p>
        )}
      </div>
    </section>
  );
}

function Rubric({ label, r, other, color }: { label: string; r: Evaluation["progress"]; other?: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-13">
        <span className="text-ink">{label}</span>
        <span className="font-mono tabular text-ink">
          {r.score.toFixed(1)}
          {other !== undefined && other !== r.score && (
            <span className={`ml-1.5 text-12 ${r.score > other ? "text-ok" : "text-ink-3"}`}>
              {r.score > other ? "+" : ""}
              {(r.score - other).toFixed(1)}
            </span>
          )}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-surface-3">
        <div
          className="h-full rounded-full t-slow transition-[width]"
          style={{ width: `${r.score * 10}%`, background: color }}
        />
      </div>
      <p className="mt-1 text-12 leading-relaxed text-ink-3">{r.rationale}</p>
    </div>
  );
}

function BranchSelect({ value, other, onChange, label }: { value: string; other: string; onChange: (id: string) => void; label: string }) {
  const run = useRollout((s) => s.run);
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 max-w-44 rounded-md border border-line bg-surface-2 px-2 text-12 text-ink"
    >
      {run.order.map((id) => (
        <option key={id} value={id} disabled={id === other}>
          {run.branches[id].name} · f{headFrame(run.branches[id])}
        </option>
      ))}
    </select>
  );
}
