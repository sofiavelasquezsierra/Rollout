"use client";

import { useMemo, useState } from "react";
import { parseDirectives, serialize } from "@/sim";
import { stateAt } from "@/store/derive";
import { headFrame, lineageEvents } from "@/store/run";
import type { DecisionEvent, DirectorEvent } from "@/store/types";
import { useRollout } from "@/store/useRollout";
import { Badge, Label, Thinking } from "@/components/ui/primitives";

const TABS = ["Decision", "State", "Instructions"] as const;
type Tab = (typeof TABS)[number];

export function Inspector() {
  const [tab, setTab] = useState<Tab>("Decision");
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label="Inspector" className="flex gap-1 border-b border-line px-3 pt-2">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(e) => {
              const i = TABS.indexOf(tab);
              if (e.key === "ArrowRight") setTab(TABS[(i + 1) % TABS.length]);
              if (e.key === "ArrowLeft") setTab(TABS[(i - 1 + TABS.length) % TABS.length]);
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") e.stopPropagation();
            }}
            className={`relative px-2 pb-2 pt-1 text-13 t-fast transition-colors ${
              tab === t ? "text-ink" : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {t}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-px bg-accent" />}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
      >
        {tab === "Decision" && <DecisionPanel />}
        {tab === "State" && <StatePanel />}
        {tab === "Instructions" && <InstructionsPanel />}
      </div>
    </div>
  );
}

function useLineage() {
  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const cursor = useRollout((s) => s.cursor);
  const events = useMemo(() => lineageEvents(run, activeId), [run, activeId]);
  return { run, activeId, cursor, events };
}

function DecisionPanel() {
  const { run, activeId, cursor, events } = useLineage();
  const activity = useRollout((s) => s.activity);
  const setCursor = useRollout((s) => s.setCursor);
  const setPlaying = useRollout((s) => s.setPlaying);
  const head = headFrame(run.branches[activeId]);
  const [showAll, setShowAll] = useState(false);

  const decisions = events.filter((e): e is DecisionEvent => e.kind === "decision");
  const current = [...decisions].reverse().find((d) => d.frame <= cursor && cursor <= d.frame + d.actions.length) ??
    [...decisions].reverse().find((d) => d.frame <= cursor);
  const streaming =
    activity.branchId === activeId && cursor >= head && (activity.status === "thinking" || activity.status === "streaming");

  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <Label>{streaming ? "Agent is deciding" : "Decision at playhead"}</Label>
          {current && !streaming && <SourceBadge d={current} />}
        </div>

        {streaming ? (
          <div className="rounded-md border border-accent/30 bg-accent-soft p-3">
            <p className="text-15 leading-relaxed text-ink">
              {activity.text || <span className="text-ink-3">Reading the world state</span>}
              <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] animate-caret bg-accent" aria-hidden />
            </p>
            <p className="mt-2 flex items-center gap-2 font-mono text-12 text-accent">
              <Thinking /> {activity.status === "thinking" ? "waiting for first token" : "streaming reasoning"}
            </p>
          </div>
        ) : activity.status === "error" && activity.branchId === activeId ? (
          <div className="rounded-md border border-hazard/40 bg-hazard-soft p-3 text-13 text-ink">
            The agent call failed: {activity.error}. Press play to retry — the scripted policy takes over if the live
            agent stays unavailable.
          </div>
        ) : current ? (
          <div className="rounded-md border border-line bg-surface-2 p-3">
            <p className="text-15 leading-relaxed text-ink">{current.reasoning}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1" aria-label="Planned actions">
              {current.actions.map((a, i) => {
                const f = current.frame + i;
                const executed = f < cursor;
                const now = f === cursor;
                return (
                  <span
                    key={i}
                    className={`inline-flex h-6 min-w-7 items-center justify-center rounded-sm border px-1.5 font-mono text-12 ${
                      now ? "border-accent bg-accent text-accent-ink" : executed ? "border-line-strong text-ink-2" : "border-dashed border-line-strong text-ink-3"
                    }`}
                    title={`f${f}: ${a}`}
                  >
                    {arrow(a)}
                  </span>
                );
              })}
              <span className="ml-1 font-mono text-12 text-ink-3">from f{current.frame}</span>
            </div>
            {current.fallbackReason && (
              <p className="mt-3 border-t border-line pt-2 text-12 text-ink-3">
                <span className="text-accent">Fallback:</span> live agent unavailable ({current.fallbackReason}), so the
                scripted policy decided this step.
              </p>
            )}
          </div>
        ) : (
          <Empty
            title="No decisions yet"
            body="Press play (Space). Every few frames the agent receives the world state and returns its next 3–5 actions with a short rationale."
          />
        )}
      </section>

      {decisions.length > 0 && (
        <section>
          <Label className="mb-2 block">Decision log · {decisions.length}</Label>
          <ol className="space-y-px">
            {[...decisions].reverse().slice(0, showAll ? 200 : 8).map((d) => {
              const active = d === current;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => (setPlaying(false), setCursor(d.frame))}
                    className={`grid w-full grid-cols-[42px_1fr] gap-2 rounded-sm px-1.5 py-1 text-left t-fast transition-colors ${
                      active ? "bg-surface-3" : "hover:bg-surface-2"
                    }`}
                  >
                    <span className="font-mono text-12 text-ink-3 tabular">f{d.frame}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-12 text-ink-2">{d.reasoning}</span>
                      <span className="font-mono text-[11px] text-ink-3">
                        {d.actions.map(arrow).join(" ")} · {d.source === "claude" ? "claude" : d.source === "hand" ? "hand" : d.fallbackReason ? "fallback" : "scripted"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {decisions.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 font-mono text-12 text-ink-3 underline decoration-line-strong underline-offset-4 hover:text-ink"
            >
              {showAll ? "Show fewer" : `Show all ${decisions.length}`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function SourceBadge({ d }: { d: DecisionEvent }) {
  if (d.source === "claude") {
    return (
      <Badge tone="accent">
        {d.model ?? "claude"} · {d.latencyMs ? `${(d.latencyMs / 1000).toFixed(1)}s` : ""}
      </Badge>
    );
  }
  if (d.source === "hand") return <Badge tone="ok">hand · sEMG stand-in</Badge>;
  return <Badge>{d.fallbackReason ? "scripted fallback" : "scripted policy"}</Badge>;
}

function StatePanel() {
  const { run, activeId, cursor } = useLineage();
  const [copied, setCopied] = useState(false);
  const s = stateAt(run, activeId, cursor);
  const setCursor = useRollout((x) => x.setCursor);
  const rows: [string, string][] = [
    ["tick", `${s.tick} / ${s.maxTicks}`],
    ["outcome", s.outcome],
    ["agent", `(${s.agent.pos.x}, ${s.agent.pos.y}) facing ${s.agent.facing}`],
    ["goal", `(${s.goal.x}, ${s.goal.y})`],
    ["seed", `${s.seed}  rng=0x${s.rng.toString(16).padStart(8, "0")}`],
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(serialize(s));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5 font-mono text-12">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-ink tabular">{v}</dd>
          </div>
        ))}
      </dl>

      <section>
        <Label className="mb-2 block">Parcels</Label>
        <ul className="grid grid-cols-2 gap-1 font-mono text-12">
          {s.objects.map((o) => (
            <li key={o.id} className={`flex items-center gap-1.5 ${o.collected ? "text-ink-3 line-through" : "text-ink"}`}>
              <span className="text-[var(--c-world-object)]">{o.collected ? "□" : "■"}</span>
              {o.id} ({o.pos.x},{o.pos.y})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Label className="mb-2 block">Caution zones</Label>
        <ul className="space-y-1 font-mono text-12 text-ink-2">
          {s.hazards.map((h) => (
            <li key={h.id}>
              <span className="text-hazard">▨</span> {h.id} x{h.x}–{h.x + h.w - 1} y{h.y}–{h.y + h.h - 1}
              {h.drift && <span className="text-ink-3"> · drifts every {h.drift.every}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Label className="mb-2 block">Violations · {s.violations.length}</Label>
        {s.violations.length === 0 ? (
          <p className="text-12 text-ink-3">None so far on this branch.</p>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {s.violations.map((v, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setCursor(v.tick)}
                  className="rounded-sm border border-hazard/30 px-1.5 py-0.5 font-mono text-[11px] text-hazard hover:bg-hazard-soft"
                  title={`Jump to f${v.tick}`}
                >
                  {v.kind === "hazard" ? "red" : "wall"} f{v.tick}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-line p-3">
        <p className="text-12 text-ink-2">
          The full world state at this frame is a plain JSON snapshot — seed and RNG included — so any frame can be
          serialized, forked and replayed identically.
        </p>
        <button
          type="button"
          onClick={copy}
          className="mt-2 rounded-sm border border-line-strong px-2 py-1 font-mono text-12 text-ink hover:bg-surface-3"
        >
          {copied ? "Copied ✓" : `Copy state @ f${cursor} (${(serialize(s).length / 1024).toFixed(1)} KB)`}
        </button>
      </section>
    </div>
  );
}

function InstructionsPanel() {
  const { run, activeId, events } = useLineage();
  const setCursor = useRollout((x) => x.setCursor);
  const mode = useRollout((x) => x.agentMode);
  const directives = events.filter((e): e is DirectorEvent => e.kind === "director");
  const parsed = parseDirectives(directives.map((d) => d.text));
  const ownStart = run.branches[activeId].forkFrame;

  if (!directives.length) {
    return (
      <Empty
        title="No director instructions"
        body="Type below to redirect the agent mid-run — e.g. “avoid the caution zones”. The instruction is injected into the next agent call and marked on the timeline with ◆."
      />
    );
  }
  return (
    <div className="space-y-4">
      <ol className="space-y-2">
        {directives.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => setCursor(d.frame)}
              className="w-full rounded-md border border-line bg-surface-2 p-2.5 text-left hover:border-line-strong"
            >
              <span className="flex items-center gap-2 font-mono text-12 text-ink-3">
                <span className="text-accent">◆</span> f{d.frame}
                {d.frame < ownStart && <span>· inherited</span>}
              </span>
              <span className="mt-1 block text-13 text-ink">“{d.text}”</span>
            </button>
          </li>
        ))}
      </ol>
      {mode === "scripted" && (
        <p className="rounded-md border border-dashed border-line-strong p-2.5 text-12 text-ink-3">
          The scripted fallback understands a small keyword vocabulary. Its current reading:{" "}
          <span className="font-mono text-ink-2">
            avoid red={String(parsed.avoidHazards)}, order={parsed.order}
            {parsed.region ? `, region=${parsed.region}` : ""}
            {parsed.goalNow ? ", goal now" : ""}
          </span>
          . The live Claude agent reads instructions as free text.
        </p>
      )}
    </div>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-line-strong p-4">
      <p className="text-13 text-ink">{title}</p>
      <p className="mt-1 text-12 leading-relaxed text-ink-3">{body}</p>
    </div>
  );
}

function arrow(a: string) {
  return { N: "↑", S: "↓", E: "→", W: "←", WAIT: "·" }[a] ?? a;
}
