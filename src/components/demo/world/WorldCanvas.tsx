"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { palette, prefersReducedMotion } from "@/lib/tokens";
import { lineage, headFrame } from "@/store/run";
import { pathOf, stateAt } from "@/store/derive";
import { BASE_FRAME_MS, useRollout } from "@/store/useRollout";
import type { Vec } from "@/sim";
import { computeLayout, drawWorld, type GhostPath } from "./draw";

const TRAIL_FRAMES = 28;
const FLASH_MS = 520;

export function WorldCanvas({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const cursor = useRollout((s) => s.cursor);
  const speed = useRollout((s) => s.speed);

  const state = stateAt(run, activeId, cursor);
  const active = run.branches[activeId];

  const ghosts = useMemo<GhostPath[]>(() => {
    const chain = lineage(run, activeId);
    const inChain = new Map(chain.map((b, i) => [b.id, i]));
    return run.order
      .filter((id) => id !== activeId)
      .map((id) => {
        const g = run.branches[id];
        const idx = inChain.get(id);
        const start = idx !== undefined ? chain[idx + 1].forkFrame : g.forkFrame;
        return { colorIndex: g.colorIndex, points: pathOf(run, id, start, headFrame(g)), forkIndex: 0 };
      })
      .filter((g) => g.points.length > 1);
  }, [run, activeId]);

  const trail = useMemo(() => pathOf(run, activeId, cursor - TRAIL_FRAMES, cursor), [run, activeId, cursor]);

  // Animation bookkeeping lives in refs so the rAF loop never re-subscribes.
  const anim = useRef({
    from: state.agent.pos as Vec,
    to: state.agent.pos as Vec,
    start: 0,
    dur: 0,
    lastCursor: cursor,
    lastBranch: activeId,
    flashAt: -Infinity,
  });
  const latest = useRef({ state, trail, ghosts, color: active.colorIndex });
  useLayoutEffect(() => {
    latest.current = { state, trail, ghosts, color: active.colorIndex };
  });

  // Start a tween whenever the displayed frame advances by one.
  useEffect(() => {
    const a = anim.current;
    const now = performance.now();
    const prevTo = a.to;
    const stepped = Math.abs(cursor - a.lastCursor) === 1 && a.lastBranch === activeId;
    a.from = stepped && !prefersReducedMotion() ? currentPos(a, now) ?? prevTo : state.agent.pos;
    a.to = state.agent.pos;
    a.start = now;
    a.dur = stepped ? Math.min(160, (BASE_FRAME_MS / speed) * 0.9) : 0;
    if (state.violations.some((v) => v.tick === state.tick) && cursor > 0) a.flashAt = now;
    a.lastCursor = cursor;
    a.lastBranch = activeId;
  }, [cursor, activeId, state, speed]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduced = prefersReducedMotion();
    let raf = 0;
    let size = { w: 0, h: 0, dpr: 1 };
    const t0 = performance.now();

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = { w: r.width, h: r.height, dpr };
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const frame = (now: number) => {
      const { state: s, trail: tr, ghosts: gh, color } = latest.current;
      const P = palette();
      const a = anim.current;
      const L = computeLayout(size.w, size.h, s);
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.clearRect(0, 0, size.w, size.h);
      const pos = currentPos(a, now) ?? a.to;
      const flashT = (now - a.flashAt) / FLASH_MS;
      drawWorld(ctx, s, L, P, {
        agentPos: pos,
        trail: tr.length ? [...tr.slice(0, -1), pos] : tr,
        trailColor: P.branches[color % P.branches.length],
        ghosts: gh,
        time: reduced ? 0 : (now - t0) / 1000,
        flash: s.violations.filter((v) => v.tick === s.tick),
        flashAlpha: flashT >= 0 && flashT < 1 ? 1 - flashT : 0,
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const left = state.objects.filter((o) => !o.collected).length;
  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Gridworld at frame ${cursor}. Agent at column ${state.agent.pos.x}, row ${state.agent.pos.y}, facing ${state.agent.facing}. ${left} of ${state.objects.length} crystals remaining. ${state.violations.length} violations so far. Status: ${state.outcome}.`}
        className="absolute inset-0"
      />
    </div>
  );
}

function currentPos(a: { from: Vec; to: Vec; start: number; dur: number }, now: number): Vec | null {
  if (a.dur <= 0) return null;
  const t = Math.min(1, (now - a.start) / a.dur);
  if (t >= 1) return null;
  const e = 1 - Math.pow(1 - t, 3);
  return { x: a.from.x + (a.to.x - a.from.x) * e, y: a.from.y + (a.to.y - a.from.y) * e };
}
