"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { branchVar } from "@/lib/tokens";
import { headFrame } from "@/store/run";
import { frameDomain } from "@/store/selectors";
import { useRollout } from "@/store/useRollout";

const PAD_X = 14;
const PAD_Y = 12;
const MAX_LANE_GAP = 24;

/**
 * Git-style branch graph. Time runs top → bottom, one lane per branch.
 * A fork is a curve leaving the parent lane at the fork frame; new branches
 * draw in with a short "growth" animation, and heads extend as frames land.
 */
export function BranchGraph() {
  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const cursor = useRollout((s) => s.cursor);
  const freshId = useRollout((s) => s.freshBranchId);
  const setActive = useRollout((s) => s.setActiveBranch);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 208, h: 220 });
  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const domain = frameDomain(run);
  const lanes = run.order.length;
  const gap = Math.min(MAX_LANE_GAP, (size.w - PAD_X * 2) / Math.max(1, lanes - 1));
  const laneX = (i: number) => PAD_X + i * gap;
  const y = (f: number) => PAD_Y + (f / domain) * (size.h - PAD_Y * 2);

  const items = useMemo(
    () =>
      run.order.map((id, lane) => {
        const b = run.branches[id];
        const parentLane = b.parentId ? run.order.indexOf(b.parentId) : -1;
        return { b, lane, parentLane, head: headFrame(b) };
      }),
    [run],
  );

  return (
    <div ref={wrapRef} className="relative h-full min-h-[140px] w-full">
      <svg width={size.w} height={size.h} className="absolute inset-0 overflow-visible" role="img" aria-label={`Branch graph with ${lanes} branch${lanes === 1 ? "" : "es"}`}>
        {/* frame grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={0} x2={size.w} y1={y(t * domain)} y2={y(t * domain)} stroke="var(--c-line)" strokeDasharray="1 3" />
          </g>
        ))}

        {/* playhead */}
        <line
          x1={0}
          x2={size.w}
          y1={y(cursor)}
          y2={y(cursor)}
          stroke="var(--c-accent)"
          strokeOpacity={0.5}
          style={{ transition: "all var(--d-fast) linear" }}
        />

        {items.map(({ b, lane, parentLane, head }) => {
          const x = laneX(lane);
          const isActive = b.id === activeId;
          const color = branchVar(b.colorIndex);
          const y0 = y(b.forkFrame);
          const yHead = Math.max(y(head), y0 + (parentLane >= 0 ? 14 : 0));
          const d =
            parentLane >= 0
              ? `M ${laneX(parentLane)} ${y0} C ${laneX(parentLane)} ${y0 + 10}, ${x} ${y0 + 2}, ${x} ${y0 + 14} L ${x} ${yHead}`
              : `M ${x} ${y0} L ${x} ${yHead}`;
          const fresh = b.id === freshId;
          return (
            <g
              key={b.id}
              className="cursor-pointer"
              onClick={() => setActive(b.id)}
              opacity={isActive ? 1 : 0.55}
              style={{ transition: "opacity var(--d-base) var(--ease-out)" }}
            >
              <path d={d} stroke="transparent" strokeWidth={14} fill="none" />
              <path
                d={d}
                stroke={color}
                strokeWidth={isActive ? 2 : 1.5}
                fill="none"
                strokeLinecap="round"
                pathLength={fresh ? 1 : undefined}
                className={fresh ? "animate-branch-grow" : undefined}
                style={fresh ? { strokeDasharray: 1 } : undefined}
              />
              {parentLane >= 0 && (
                <circle cx={laneX(parentLane)} cy={y0} r={2.5} fill={color} />
              )}
              {b.events.map((e) =>
                e.kind === "director" ? (
                  <rect
                    key={e.id}
                    x={x - 3}
                    y={y(e.frame) - 3}
                    width={6}
                    height={6}
                    transform={`rotate(45 ${x} ${y(e.frame)})`}
                    fill="var(--c-accent)"
                    stroke="var(--c-bg)"
                    strokeWidth={1.5}
                  />
                ) : null,
              )}
              <circle
                cx={x}
                cy={yHead}
                r={isActive ? 4.5 : 3.5}
                fill={isActive ? color : "var(--c-bg)"}
                stroke={color}
                strokeWidth={1.5}
                className={fresh ? "animate-node-pop" : undefined}
                style={{ transformOrigin: `${x}px ${yHead}px` }}
              />
              {isActive && <circle cx={x} cy={yHead} r={8} fill="none" stroke={color} strokeOpacity={0.3} />}
            </g>
          );
        })}
      </svg>
      <span className="pointer-events-none absolute bottom-0 right-0 font-mono text-[10px] text-ink-3 tabular">
        f{domain}
      </span>
      <span className="pointer-events-none absolute right-0 top-0 font-mono text-[10px] text-ink-3">f0</span>
    </div>
  );
}
