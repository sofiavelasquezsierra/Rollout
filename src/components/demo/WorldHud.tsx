"use client";

import { stateAt } from "@/store/derive";
import { useRollout } from "@/store/useRollout";
import { Badge } from "@/components/ui/primitives";
import { getLevel } from "@/sim";

const OUTCOME: Record<string, { label: string; tone: "ok" | "accent" | "hazard" }> = {
  success: { label: "Goal reached · all crystals", tone: "ok" },
  partial: { label: "Goal reached · crystals left behind", tone: "accent" },
  timeout: { label: "Out of time", tone: "hazard" },
};

/** Overlay readouts on top of the world canvas. */
export function WorldHud() {
  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const cursor = useRollout((s) => s.cursor);
  const s = stateAt(run, activeId, cursor);
  const got = s.objects.filter((o) => o.collected).length;
  const hz = s.violations.filter((v) => v.kind === "hazard").length;
  const walls = s.violations.length - hz;
  const outcome = OUTCOME[s.outcome];

  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
        <Badge>{getLevel(run.levelId).name}</Badge>
        <Badge>
          <span className="text-[var(--c-world-object)]">◆</span> {got}/{s.objects.length}
        </Badge>
        <Badge tone={hz ? "hazard" : "neutral"}>red zone {hz}</Badge>
        {walls > 0 && <Badge>wall bumps {walls}</Badge>}
      </div>
      <div className="pointer-events-none absolute right-3 top-3 font-mono text-12 text-ink-3 tabular">
        t={s.tick}/{s.maxTicks}
      </div>
      {outcome && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Badge tone={outcome.tone} className="h-6 px-2 text-13 shadow-lg backdrop-blur">
            {outcome.label} · {s.tick} ticks
          </Badge>
        </div>
      )}
    </>
  );
}
