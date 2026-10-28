"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { palette, prefersReducedMotion } from "@/lib/tokens";
import { pathOf, stateAt } from "@/store/derive";
import { headFrame } from "@/store/run";
import type { Run } from "@/store/types";
import { useRollout } from "@/store/useRollout";
import { WorldCanvas } from "@/components/demo/world/WorldCanvas";
import { WorldScene, webglAvailable, type WorldInput } from "./scene/WorldScene";

/**
 * Anchors pin HTML elements (labels, the agent's thought bubble, score cards)
 * to points in the 3D scene. They're positioned imperatively every frame, so
 * React only re-renders when content changes, not when the camera moves.
 */
export type Anchor =
  | { kind: "world"; worldId: string; at: "back" | "front" }
  | { kind: "agent"; worldId: string };

interface Registry {
  register(key: string, el: HTMLElement, anchor: Anchor): () => void;
  pick(x: number, y: number): string | null;
  mode: "3d" | "2d" | "pending";
}

const StageCtx = createContext<Registry | null>(null);
export const useStage = () => useContext(StageCtx);

const TRAIL = 40;

export function Stage({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<WorldScene | null>(null);
  const anchors = useRef(new Map<string, { el: HTMLElement; anchor: Anchor }>());
  const [mode, setMode] = useState<"3d" | "2d" | "pending">("pending");

  useEffect(() => {
    let scene: WorldScene | null = null;
    let ro: ResizeObserver | null = null;
    let raf = 0;

    // Set up after first layout so the canvas has a size, and so state
    // updates happen in a callback rather than synchronously in the effect.
    const boot = requestAnimationFrame(() => {
      if (!webglAvailable()) {
        setMode("2d");
        return;
      }
      try {
        scene = new WorldScene(canvasRef.current!, palette());
      } catch {
        setMode("2d");
        return;
      }
      const sc = scene;
      sceneRef.current = sc;
      setMode("3d");
      const wrap = wrapRef.current!;
      ro = new ResizeObserver(() => {
        const r = wrap.getBoundingClientRect();
        sc.resize(r.width, r.height);
      });
      ro.observe(wrap);
      const r0 = wrap.getBoundingClientRect();
      sc.resize(r0.width, r0.height);

      const reduced = prefersReducedMotion();
      const trailCache = new Map<string, ReturnType<typeof pathOf>>();
      let trailRun: Run | null = null;

      const loop = () => {
        raf = requestAnimationFrame(loop);
        const { run, activeBranchId, cursor, view } = useRollout.getState();
        if (run !== trailRun) {
          trailCache.clear();
          trailRun = run;
        }
        const worlds: WorldInput[] = run.order.map((id, slot) => {
          const b = run.branches[id];
          const frame = Math.min(cursor, headFrame(b));
          const key = `${id}:${frame}`;
          let trail = trailCache.get(key);
          if (!trail) {
            trail = pathOf(run, id, frame - TRAIL, frame);
            trailCache.set(key, trail);
          }
          return {
            id,
            colorIndex: b.colorIndex,
            slot,
            spawnSlot: b.parentId ? run.order.indexOf(b.parentId) : null,
            state: stateAt(run, id, frame),
            trail,
            active: id === activeBranchId,
            latent: cursor < b.forkFrame,
          };
        });
        sc.update({ worlds, mode: view, activeId: activeBranchId, reducedMotion: reduced });

        const { h } = sc.worldSize();
        for (const { el, anchor } of anchors.current.values()) {
          let p: ReturnType<WorldScene["project"]> = null;
          if (anchor.kind === "world") {
            p = sc.project(anchor.worldId, 0, 0.4, anchor.at === "back" ? -h / 2 - 0.8 : h / 2 + 0.9);
          } else {
            const a = sc.agentLocal(anchor.worldId);
            if (a) p = sc.project(anchor.worldId, a.x, a.y + 0.9, a.z);
          }
          if (!p || !p.visible) {
            el.style.visibility = "hidden";
          } else {
            el.style.visibility = "";
            el.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`;
          }
        }
      };
      raf = requestAnimationFrame(loop);
    });

    return () => {
      cancelAnimationFrame(boot);
      cancelAnimationFrame(raf);
      ro?.disconnect();
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const registry = useMemo<Registry>(
    () => ({
      mode,
      register(key, el, anchor) {
        anchors.current.set(key, { el, anchor });
        return () => {
          anchors.current.delete(key);
        };
      },
      pick(x, y) {
        return sceneRef.current?.pick(x, y) ?? null;
      },
    }),
    [mode],
  );

  return (
    <StageCtx.Provider value={registry}>
      <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
        {mode !== "2d" ? (
          <WorldCanvas3D canvasRef={canvasRef} />
        ) : (
          <div className="absolute inset-x-4 bottom-44 top-20">
            <WorldCanvas className="h-full w-full" />
          </div>
        )}
        {children}
      </div>
    </StageCtx.Provider>
  );
}

function WorldCanvas3D({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const cursor = useRollout((s) => s.cursor);
  const setActive = useRollout((s) => s.setActiveBranch);
  const setView = useRollout((s) => s.setView);
  const stage = useStage();
  const s = stateAt(run, activeId, cursor);
  const left = s.objects.filter((o) => !o.collected).length;

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`${run.order.length} parallel world${run.order.length === 1 ? "" : "s"}. Active world “${run.branches[activeId].name}” at frame ${cursor}: robot at column ${s.agent.pos.x}, row ${s.agent.pos.y}; ${left} of ${s.objects.length} parcels left; ${s.violations.length} violations; ${s.outcome}.`}
      className="absolute inset-0 h-full w-full"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const id = stage?.pick(e.clientX - r.left, e.clientY - r.top);
        if (id) {
          setActive(id);
          setView("focus");
        }
      }}
    />
  );
}

/** An HTML element pinned to a 3D anchor. Positioned by the Stage loop. */
export function Pinned({ id, anchor, children, className = "" }: { id: string; anchor: Anchor; children: ReactNode; className?: string }) {
  const stage = useStage();
  const ref = useRef<HTMLDivElement>(null);
  const key = `${id}`;
  const anchorKey = JSON.stringify(anchor);
  useEffect(() => {
    if (!stage || stage.mode !== "3d" || !ref.current) return;
    return stage.register(key, ref.current, JSON.parse(anchorKey) as Anchor);
  }, [stage, key, anchorKey]);
  if (!stage || stage.mode !== "3d") return null;
  return (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0 will-change-transform" style={{ visibility: "hidden" }}>
      <div className={`pointer-events-auto ${className}`}>{children}</div>
    </div>
  );
}
