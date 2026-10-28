"use client";

import { useEffect, useRef } from "react";
import { palette } from "@/lib/tokens";
import { pathOf, stateAt } from "@/store/derive";
import type { Run } from "@/store/types";
import { computeLayout, drawWorld } from "./draw";

/** Static render of one branch at a frame, with its full path so far. Used by the compare view. */
export function MiniWorld({ run, branchId, frame, label }: { run: Run; branchId: string; frame: number; label: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = stateAt(run, branchId, frame);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const draw = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, r.width, r.height);
      const P = palette();
      const b = run.branches[branchId];
      drawWorld(ctx, state, computeLayout(r.width, r.height, state), P, {
        agentPos: state.agent.pos,
        trail: pathOf(run, branchId, 0, frame),
        trailColor: P.branches[b.colorIndex % P.branches.length],
        ghosts: [],
        time: 0,
        flash: [],
        flashAlpha: 0,
      });
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [run, branchId, frame, state]);

  return (
    <div ref={wrapRef} className="relative aspect-[3/2] w-full">
      <canvas ref={canvasRef} role="img" aria-label={label} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
