"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { branchVar } from "@/lib/tokens";
import { headState } from "@/store/derive";
import { headFrame, lineage, lineageEvents } from "@/store/run";
import { frameDomain } from "@/store/selectors";
import { useRollout } from "@/store/useRollout";

const H = 46; // svg height
const SAG = 20; // how much the arc bows upward
const PAD = 10;

/**
 * The time arc: a shallow glowing bow you drag to move through time.
 * The bow is a quadratic curve whose x is linear in t, so dragging maps
 * pointer x straight to a frame — it looks like an arc, behaves like a slider.
 */
export function TimeArc() {
  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const cursor = useRollout((s) => s.cursor);
  const setCursor = useRollout((s) => s.setCursor);
  const setPlaying = useRollout((s) => s.setPlaying);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(560);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const domain = useMemo(() => frameDomain(run), [run]);
  const head = headFrame(run.branches[activeId]);
  const inner = W - PAD * 2;
  const pt = (f: number) => {
    const t = Math.max(0, Math.min(1, f / domain));
    return { x: PAD + t * inner, y: H - 6 - 4 * SAG * t * (1 - t) };
  };
  const arc = (f0: number, f1: number) => {
    const n = Math.max(2, Math.ceil(((f1 - f0) / domain) * 60));
    let d = "";
    for (let i = 0; i <= n; i++) {
      const p = pt(f0 + ((f1 - f0) * i) / n);
      d += `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }
    return d;
  };

  const segments = useMemo(() => {
    const chain = lineage(run, activeId);
    return chain.map((b, i) => ({
      id: b.id,
      color: branchVar(b.colorIndex),
      from: b.forkFrame,
      to: i < chain.length - 1 ? chain[i + 1].forkFrame : headFrame(b),
      own: i === chain.length - 1,
    }));
  }, [run, activeId]);
  const events = useMemo(() => lineageEvents(run, activeId), [run, activeId]);
  const violations = useMemo(() => headState(run, activeId).violations, [run, activeId]);

  const toFrame = (clientX: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return Math.round(((clientX - r.left - PAD) / inner) * domain);
  };
  const down = (e: RPointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag(true);
    setPlaying(false);
    setCursor(toFrame(e.clientX));
  };
  const move = (e: RPointerEvent) => drag && setCursor(toFrame(e.clientX));

  const ph = pt(cursor);
  const color = branchVar(run.branches[activeId].colorIndex);

  return (
    <div
      ref={wrapRef}
      role="slider"
      tabIndex={0}
      aria-label="Time"
      aria-valuemin={0}
      aria-valuemax={head}
      aria-valuenow={cursor}
      aria-valuetext={`Frame ${cursor} of ${head}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={() => setDrag(false)}
      onPointerCancel={() => setDrag(false)}
      className="relative h-[46px] w-full cursor-pointer touch-none select-none rounded-full outline-offset-4"
    >
      <svg width={W} height={H} className="absolute inset-0 overflow-visible" aria-hidden>
        <defs>
          <filter id="arc-glow" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={arc(0, domain)} stroke="rgb(190 210 255 / 0.14)" strokeWidth={3} fill="none" strokeLinecap="round" />
        {segments.map((s) =>
          s.to > s.from ? (
            <path
              key={s.id}
              d={arc(s.from, s.to)}
              stroke={s.color}
              strokeOpacity={s.own ? 0.95 : 0.4}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              filter={s.own ? "url(#arc-glow)" : undefined}
            />
          ) : null,
        )}
        {segments.slice(1).map((s) => {
          const p = pt(s.from);
          return <circle key={`f-${s.id}`} cx={p.x} cy={p.y} r={4} fill="var(--c-space)" stroke={s.color} strokeWidth={2} />;
        })}
        {violations.map((v, i) => {
          const p = pt(v.tick);
          return <line key={i} x1={p.x} x2={p.x} y1={p.y + 5} y2={p.y + 10} stroke="var(--c-hazard)" strokeWidth={1.5} opacity={v.kind === "hazard" ? 0.9 : 0.5} />;
        })}
        {events.map((e) => {
          if (e.kind !== "director") return null;
          const p = pt(e.frame);
          return (
            <rect key={e.id} x={p.x - 4} y={p.y - 14} width={8} height={8} transform={`rotate(45 ${p.x} ${p.y - 10})`} fill="var(--c-accent)">
              <title>{`f${e.frame}: “${e.text}”`}</title>
            </rect>
          );
        })}
        <circle cx={ph.x} cy={ph.y} r={drag ? 9 : 7} fill={color} filter="url(#arc-glow)" style={{ transition: drag ? "none" : "cx 90ms linear, cy 90ms linear" }} />
        <circle cx={ph.x} cy={ph.y} r={3} fill="var(--c-space)" style={{ transition: drag ? "none" : "cx 90ms linear, cy 90ms linear" }} />
      </svg>
    </div>
  );
}
