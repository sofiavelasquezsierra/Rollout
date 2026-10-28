"use client";

import { useEffect, useMemo, useRef } from "react";
import { branchVar } from "@/lib/tokens";
import { stateAt } from "@/store/derive";
import { headFrame, lineageEvents } from "@/store/run";
import { summarize } from "@/store/selectors";
import type { DecisionEvent, Evaluation } from "@/store/types";
import { useRollout } from "@/store/useRollout";
import { Thinking } from "@/components/ui/primitives";
import { scoreTone } from "@/components/demo/ScoreChip";
import { Pinned } from "./Stage";

const OUTCOME_TONE: Record<string, string> = {
  running: "text-ink-3",
  success: "text-ok",
  partial: "text-accent",
  timeout: "text-hazard",
};

/** A floating name tag above every parallel world. Click to fly there. */
export function WorldTags() {
  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const cursor = useRollout((s) => s.cursor);
  const view = useRollout((s) => s.view);
  const renamingId = useRollout((s) => s.renamingId);
  const evaluating = useRollout((s) => s.evaluating);
  const { setActiveBranch, setView, rename, setRenaming } = useRollout.getState();

  return (
    <>
      {run.order.map((id) => {
        const sum = summarize(run, id);
        const b = sum.branch;
        const active = id === activeId;
        const latent = cursor < b.forkFrame;
        const parent = b.parentId ? run.branches[b.parentId] : null;
        return (
          <Pinned key={id} id={`tag-${id}`} anchor={{ kind: "world", worldId: id, at: "back" }}>
            <div className="-translate-x-1/2 -translate-y-full pb-2">
              <div
                className={`glass flex items-center gap-2 rounded-full py-1 pl-2.5 pr-1.5 t-base transition-[transform,opacity] ${
                  active ? "scale-100" : "scale-90 opacity-80 hover:opacity-100"
                }`}
                style={active ? { boxShadow: `0 0 0 1px color-mix(in srgb, ${branchVar(b.colorIndex)} 55%, transparent), 0 0 28px color-mix(in srgb, ${branchVar(b.colorIndex)} 35%, transparent)` } : undefined}
              >
                <span className="size-2 rounded-full" style={{ background: branchVar(b.colorIndex) }} aria-hidden />
                {renamingId === id ? (
                  <RenameField initial={b.name} onDone={(v) => (v === null ? setRenaming(null) : rename(id, v))} />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveBranch(id);
                      setView("focus");
                    }}
                    onDoubleClick={() => setRenaming(id)}
                    aria-current={active ? "true" : undefined}
                    aria-label={`World ${b.name}${active ? ", active" : ""}. ${sum.outcome}. Double-click to rename.`}
                    className="max-w-40 truncate text-13 text-ink"
                  >
                    {b.name}
                  </button>
                )}
                <span className={`font-mono text-[11px] ${latent ? "text-ink-3" : OUTCOME_TONE[sum.outcome]}`}>
                  {latent ? `splits at f${b.forkFrame}` : parent && view === "overview" ? `⑂ f${b.forkFrame}` : sum.outcome === "running" ? `f${sum.head}` : sum.outcome}
                </span>
                {evaluating[id] ? (
                  <span className="px-1 text-ink-3">
                    <Thinking />
                  </span>
                ) : b.evaluation ? (
                  <span className={`rounded-full border px-1.5 font-mono text-[11px] tabular ${scoreTone(b.evaluation.overall)}`}>
                    {b.evaluation.overall.toFixed(1)}
                  </span>
                ) : null}
              </div>
            </div>
          </Pinned>
        );
      })}
    </>
  );
}

function RenameField({ initial, onDone }: { initial: string; onDone: (v: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(v);
  };
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      defaultValue={initial}
      maxLength={40}
      aria-label="World name"
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(e.currentTarget.value);
        if (e.key === "Escape") finish(null);
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
      className="w-36 rounded-sm bg-transparent text-13 text-ink outline-none"
    />
  );
}

/** The agent's current thought, floating beside it in the active world. */
export function ThoughtBubble({ hidden = false }: { hidden?: boolean }) {
  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const cursor = useRollout((s) => s.cursor);
  const activity = useRollout((s) => s.activity);
  const view = useRollout((s) => s.view);
  const head = headFrame(run.branches[activeId]);

  const current = useMemo(() => {
    const ds = lineageEvents(run, activeId).filter((e): e is DecisionEvent => e.kind === "decision");
    return [...ds].reverse().find((d) => d.frame <= cursor) ?? null;
  }, [run, activeId, cursor]);

  if (view === "overview" || hidden) return null;
  const thinking = activity.branchId === activeId && cursor >= head && (activity.status === "thinking" || activity.status === "streaming");
  const text = thinking ? activity.text : current?.reasoning;
  const s = stateAt(run, activeId, cursor);
  if (!text && !thinking) return null;

  const source = thinking
    ? "thinking"
    : current?.source === "claude"
      ? current.model ?? "claude"
      : current?.source === "hand"
        ? "your hand"
        : current?.fallbackReason
          ? "scripted fallback"
          : "scripted policy";

  return (
    <Pinned id="thought" anchor={{ kind: "agent", worldId: activeId }}>
      <div className="translate-x-6 -translate-y-[85%]">
        <div className="glass relative w-[min(280px,60vw)] rounded-2xl rounded-bl-sm px-3.5 py-2.5">
          <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
            {thinking && <Thinking />}
            {source}
          </p>
          <p className="text-13 leading-snug text-ink" aria-live="off">
            {text || "Looking at the world…"}
            {thinking && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-caret bg-accent" aria-hidden />}
          </p>
          {s.outcome !== "running" && cursor >= head && (
            <p className={`mt-1.5 font-mono text-[11px] ${OUTCOME_TONE[s.outcome]}`}>
              {s.outcome === "success" ? "✓ all parcels, docked" : s.outcome === "partial" ? "docked, parcels left behind" : "ran out of time"}
            </p>
          )}
        </div>
      </div>
    </Pinned>
  );
}

/** In overview, a scorecard floats under each world so worlds compare at a glance. */
export function ScoreCards() {
  const run = useRollout((s) => s.run);
  const view = useRollout((s) => s.view);
  const evaluating = useRollout((s) => s.evaluating);
  const evaluate = useRollout((s) => s.evaluate);
  if (view !== "overview") return null;

  return (
    <>
      {run.order.map((id) => {
        const sum = summarize(run, id);
        const e = sum.branch.evaluation;
        return (
          <Pinned key={id} id={`card-${id}`} anchor={{ kind: "world", worldId: id, at: "front" }}>
            <div className="-translate-x-1/2 pt-2">
              <div className="glass w-56 rounded-xl p-3 text-12">
                <div className="grid grid-cols-3 gap-1 text-center font-mono tabular">
                  <Stat k="ticks" v={sum.head} />
                  <Stat k="parcels" v={`${sum.collected}/${sum.total}`} />
                  <Stat k="in zone" v={sum.hazardHits} tone={sum.hazardHits ? "text-hazard" : "text-ink"} />
                </div>
                <div className="mt-2.5 border-t border-[var(--c-glass-line)] pt-2.5">
                  {evaluating[id] ? (
                    <p className="flex items-center gap-2 text-ink-3">
                      <Thinking /> evaluator scoring…
                    </p>
                  ) : e ? (
                    <Rubric e={e} stale={e.atFrame !== sum.head} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => void evaluate(id)}
                      className="w-full rounded-md border border-[var(--c-glass-line)] py-1 text-ink-2 t-fast transition-colors hover:bg-white/5 hover:text-ink"
                    >
                      Score this world
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Pinned>
        );
      })}
    </>
  );
}

function Stat({ k, v, tone = "text-ink" }: { k: string; v: string | number; tone?: string }) {
  return (
    <div>
      <div className={`text-15 ${tone}`}>{v}</div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-ink-3">{k}</div>
    </div>
  );
}

function Rubric({ e, stale }: { e: Evaluation; stale: boolean }) {
  const rows: [string, number][] = [
    ["progress", e.progress.score],
    ["efficiency", e.efficiency.score],
    ["safety", e.safety.score],
  ];
  return (
    <div title={e.summary}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
          {e.source === "claude" ? "evaluator" : "heuristic"}
          {stale && " · stale"}
        </span>
        <span className={`rounded-full border px-1.5 font-mono text-13 tabular ${scoreTone(e.overall)}`}>{e.overall.toFixed(1)}</span>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="mt-1 grid grid-cols-[62px_1fr_24px] items-center gap-2 font-mono text-[11px]">
          <span className="text-ink-3">{k}</span>
          <span className="h-1 rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${v * 10}%` }} />
          </span>
          <span className="text-right text-ink-2 tabular">{v.toFixed(0)}</span>
        </div>
      ))}
      <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-ink-3">{e.summary}</p>
    </div>
  );
}

/** First-visit headline that recedes once the visitor starts interacting. */
export function HeroLine({
  gone,
  onGone,
  onWalkthrough,
  onHow,
}: {
  gone: boolean;
  onGone: () => void;
  onWalkthrough: () => void;
  onHow: () => void;
}) {
  useEffect(() => {
    const off = () => onGone();
    const t = window.setTimeout(off, 6500);
    window.addEventListener("keydown", off, { once: true });
    window.addEventListener("pointerdown", off, { once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", off);
      window.removeEventListener("pointerdown", off);
    };
  }, [onGone]);
  const hidden = gone;

  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-[118px] z-30 w-[min(680px,calc(100%-32px))] -translate-x-1/2 text-center t-slow transition-[opacity,transform] duration-700 ${
        hidden ? "-translate-y-3 opacity-0" : "opacity-100"
      }`}
      aria-hidden={hidden}
    >
      <h1 className="font-display text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.02] text-ink [text-shadow:0_2px_30px_rgb(0_0_0/0.8)]">
        What if the robot had chosen <span className="text-ink-3">differently?</span>
      </h1>
      <p className="mx-auto mt-3 max-w-md text-15 text-ink-2 [text-shadow:0_1px_16px_rgb(0_0_0/0.9)]">
        Fork a simulated rollout at any frame, redirect the agent in plain language, and compare the futures side by
        side.
      </p>
      <div className="pointer-events-auto mt-4 flex justify-center gap-2">
        <button type="button" onClick={onWalkthrough} className="glass inline-flex h-9 items-center gap-2 rounded-full pl-1.5 pr-4 text-13 text-ink hover:bg-white/5">
          <span className="flex size-6 items-center justify-center rounded-full bg-accent text-[10px] text-accent-ink">▶</span>
          Watch the walkthrough
        </button>
        <button type="button" onClick={onHow} className="glass inline-flex h-9 items-center rounded-full px-4 text-13 text-ink-2 hover:bg-white/5 hover:text-ink">
          How this works
        </button>
      </div>
    </div>
  );
}
