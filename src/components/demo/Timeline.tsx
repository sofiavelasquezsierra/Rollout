"use client";

import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { branchVar } from "@/lib/tokens";
import { headState } from "@/store/derive";
import { headFrame, lineage, lineageEvents } from "@/store/run";
import { useRollout } from "@/store/useRollout";

/**
 * Scrubber for the active branch. The track shows the branch's lineage as
 * colored segments (each ancestor up to the fork point), with markers for
 * agent decisions (top ticks), director instructions (amber diamonds),
 * violations (red ticks below) and fork points (notches).
 */
export function Timeline() {
  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const cursor = useRollout((s) => s.cursor);
  const setCursor = useRollout((s) => s.setCursor);
  const setPlaying = useRollout((s) => s.setPlaying);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const active = run.branches[activeId];
  const head = headFrame(active);

  // Stable domain across branches so switching doesn't rescale the axis.
  const domain = useMemo(() => {
    const maxHead = Math.max(...run.order.map((id) => headFrame(run.branches[id])));
    return Math.max(40, Math.ceil((maxHead * 1.08 + 4) / 10) * 10);
  }, [run]);

  const segments = useMemo(() => {
    const chain = lineage(run, activeId);
    return chain.map((b, i) => ({
      id: b.id,
      color: branchVar(b.colorIndex),
      from: b.forkFrame,
      to: i < chain.length - 1 ? chain[i + 1].forkFrame : headFrame(b),
      name: b.name,
    }));
  }, [run, activeId]);

  const events = useMemo(() => lineageEvents(run, activeId), [run, activeId]);
  const violations = useMemo(() => headState(run, activeId).violations, [run, activeId]);

  const pct = (f: number) => `${(f / domain) * 100}%`;

  const frameFromX = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.round(((clientX - r.left) / r.width) * domain);
  };

  const onPointerDown = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    setPlaying(false);
    setCursor(frameFromX(e.clientX));
  };
  const onPointerMove = (e: RPointerEvent) => {
    const f = Math.max(0, Math.min(frameFromX(e.clientX), domain));
    setHover(f);
    if (dragging) setCursor(f);
  };
  const end = () => setDragging(false);

  const ticks = useMemo(() => {
    const stepSize = domain > 200 ? 40 : domain > 100 ? 20 : 10;
    const out: number[] = [];
    for (let f = 0; f <= domain; f += stepSize) out.push(f);
    return out;
  }, [domain]);

  const hoverEvent =
    hover !== null ? events.find((e) => e.kind === "director" && Math.abs(e.frame - hover) <= domain / 120) : undefined;

  return (
    <div className="select-none">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Timeline scrubber"
        aria-valuemin={0}
        aria-valuemax={head}
        aria-valuenow={cursor}
        aria-valuetext={`Frame ${cursor} of ${head} on branch ${active.name}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={() => setHover(null)}
        className={`group relative h-14 touch-none rounded-md outline-offset-4 ${dragging ? "cursor-grabbing" : "cursor-pointer"}`}
      >
        {/* decision ticks */}
        <div className="absolute inset-x-0 top-2 h-2">
          {events.map((e) =>
            e.kind === "decision" ? (
              <span
                key={e.id}
                className={`absolute top-0 h-2 w-px ${e.source === "claude" ? "bg-ink-2" : "bg-ink-3/70"}`}
                style={{ left: pct(e.frame) }}
              />
            ) : null,
          )}
        </div>

        {/* track */}
        <div className="absolute inset-x-0 top-[22px] h-1.5 rounded-full bg-surface-3">
          {segments.map((s, i) => (
            <span
              key={s.id}
              className="absolute inset-y-0 t-base transition-[width]"
              style={{
                left: pct(s.from),
                width: pct(Math.max(0, s.to - s.from)),
                background: s.color,
                opacity: i === segments.length - 1 ? 0.95 : 0.4,
                borderRadius: 999,
              }}
              title={s.name}
            />
          ))}
          {/* fork notches */}
          {segments.slice(1).map((s) => (
            <span
              key={`n-${s.id}`}
              className="absolute -top-1.5 h-[18px] w-0.5 -translate-x-1/2 rounded-full"
              style={{ left: pct(s.from), background: s.color }}
            />
          ))}
        </div>

        {/* director markers */}
        {events.map((e) =>
          e.kind === "director" ? (
            <span
              key={e.id}
              className="absolute top-[19px] size-3 -translate-x-1/2 rotate-45 rounded-[2px] border-2 border-bg bg-accent"
              style={{ left: pct(e.frame) }}
              aria-hidden
            />
          ) : null,
        )}

        {/* violations */}
        <div className="absolute inset-x-0 top-[34px] h-2">
          {violations.map((v, i) => (
            <span
              key={i}
              className={`absolute top-0 w-px ${v.kind === "hazard" ? "h-2 bg-hazard" : "h-1 bg-hazard/60"}`}
              style={{ left: pct(v.tick) }}
            />
          ))}
        </div>

        {/* hover guide */}
        {hover !== null && !dragging && (
          <span className="pointer-events-none absolute top-1 bottom-4 w-px bg-ink-3/40" style={{ left: pct(hover) }} />
        )}

        {/* playhead */}
        <div
          className="pointer-events-none absolute top-0 bottom-3 -translate-x-1/2"
          style={{ left: pct(cursor), transition: dragging ? "none" : "left 90ms linear" }}
        >
          <div className="mx-auto h-full w-px bg-accent" />
          <div
            className={`absolute left-1/2 top-[18px] size-3.5 -translate-x-1/2 rounded-full border-2 border-accent bg-bg t-fast transition-transform ${dragging ? "scale-125" : "group-hover:scale-110"}`}
          />
        </div>

        {/* ruler */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3">
          {ticks.map((f) => (
            <span
              key={f}
              className="absolute -translate-x-1/2 font-mono text-[10px] leading-none text-ink-3 tabular"
              style={{ left: pct(f) }}
            >
              {f}
            </span>
          ))}
        </div>

        {hoverEvent && hoverEvent.kind === "director" && (
          <div
            className="pointer-events-none absolute -top-9 z-10 max-w-64 -translate-x-1/2 truncate rounded-md border border-line-strong bg-surface-2 px-2 py-1 text-12 text-ink shadow-lg"
            style={{ left: pct(hoverEvent.frame) }}
          >
            <span className="text-accent">◆</span> “{hoverEvent.text}”
          </div>
        )}
      </div>
    </div>
  );
}
