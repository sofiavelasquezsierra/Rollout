import { headState } from "./derive";
import { headFrame } from "./run";
import type { Branch, Run } from "./types";

/** Shared frame domain for the timeline and branch graph, stable across branch switches. */
export function frameDomain(run: Run): number {
  const maxHead = Math.max(...run.order.map((id) => headFrame(run.branches[id])));
  return Math.max(40, Math.ceil((maxHead * 1.08 + 4) / 10) * 10);
}

export interface BranchSummary {
  branch: Branch;
  head: number;
  outcome: ReturnType<typeof headState>["outcome"];
  collected: number;
  total: number;
  hazardHits: number;
  wallBumps: number;
  decisions: number;
  directives: number;
  claudeDecisions: number;
}

export function summarize(run: Run, id: string): BranchSummary {
  const b = run.branches[id];
  const s = headState(run, id);
  const hazardHits = s.violations.filter((v) => v.kind === "hazard").length;
  return {
    branch: b,
    head: headFrame(b),
    outcome: s.outcome,
    collected: s.objects.filter((o) => o.collected).length,
    total: s.objects.length,
    hazardHits,
    wallBumps: s.violations.length - hazardHits,
    decisions: b.events.filter((e) => e.kind === "decision").length,
    directives: b.events.filter((e) => e.kind === "director").length,
    claudeDecisions: b.events.filter((e) => e.kind === "decision" && e.source === "claude").length,
  };
}

export const OUTCOME_LABEL: Record<string, string> = {
  running: "running",
  success: "success",
  partial: "partial",
  timeout: "timeout",
};
