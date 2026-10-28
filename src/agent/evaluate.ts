import { createWorld, getLevel, parseDirectives, scriptedPolicy, stepMany, type WorldState } from "@/sim";
import { headState, pathOf } from "@/store/derive";
import { headFrame, lineageEvents } from "@/store/run";
import type { DirectorEvent, Evaluation, Run } from "@/store/types";

/**
 * Branch evaluation. Prefers the Claude evaluator route; falls back to a
 * deterministic heuristic that implements the same rubric, labeled as such.
 */

const refCache = new Map<string, number | null>();

/** Ticks a clean scripted planner needs for this level and objective — the efficiency yardstick. */
export function referenceTicks(levelId: string, seed: number, goalNow: boolean): number | null {
  const key = `${levelId}:${seed}:${goalNow}`;
  if (refCache.has(key)) return refCache.get(key)!;
  let s = createWorld(levelId, seed);
  const instr = goalNow ? ["avoid the red zone", "head straight for the goal"] : ["avoid the red zone"];
  for (let i = 0; i < 120 && s.outcome === "running"; i++) s = stepMany(s, scriptedPolicy(s, instr).actions);
  const v = s.outcome === "running" || s.outcome === "timeout" ? null : s.tick;
  refCache.set(key, v);
  return v;
}

export function evaluationInput(run: Run, branchId: string) {
  const b = run.branches[branchId];
  const final = headState(run, branchId);
  const events = lineageEvents(run, branchId);
  const instructions = events
    .filter((e): e is DirectorEvent => e.kind === "director")
    .map((e) => ({ frame: e.frame, text: e.text }));
  const goalNow = parseDirectives(instructions.map((i) => i.text)).goalNow;
  const path = pathOf(run, branchId, 0, headFrame(b));
  const stride = Math.max(1, Math.ceil(path.length / 300));
  return {
    branchName: b.name,
    levelName: getLevel(run.levelId).name,
    finalState: final,
    ticks: final.tick,
    instructions,
    decisions: events.filter((e) => e.kind === "decision").length,
    referenceTicks: referenceTicks(run.levelId, run.seed, goalNow),
    trace: path.filter((_, i) => i % stride === 0).map((p) => [p.x, p.y] as [number, number]),
  };
}

export function heuristicEvaluation(input: ReturnType<typeof evaluationInput>): Omit<Evaluation, "atFrame"> {
  const s: WorldState = input.finalState;
  const got = s.objects.filter((o) => o.collected).length;
  const total = s.objects.length || 1;
  const hz = s.violations.filter((v) => v.kind === "hazard").length;
  const walls = s.violations.length - hz;
  const goalNow = parseDirectives(input.instructions.map((i) => i.text)).goalNow;
  const reached = s.outcome === "success" || s.outcome === "partial";
  const round = (n: number) => Math.round(Math.max(0, Math.min(10, n)) * 10) / 10;

  const progress = goalNow
    ? reached
      ? 10
      : 4
    : reached
      ? 4 + 6 * (got / total)
      : 7 * (got / total);
  const ref = input.referenceTicks;
  const efficiency = !reached ? Math.min(3, 3 * (got / total)) : ref ? 10 * Math.min(1, ref / Math.max(1, input.ticks)) ** 1.3 : 6;
  const safety = 10 - 1.5 * hz - 0.5 * walls;
  const overall = 0.45 * progress + 0.2 * efficiency + 0.35 * Math.max(0, safety);

  return {
    progress: {
      score: round(progress),
      rationale: goalNow
        ? `Instructed to head for the goal; ${reached ? "reached it" : "did not reach it"} (${got}/${total} crystals).`
        : `${got}/${total} crystals collected; goal ${reached ? "reached" : "not reached"} (${s.outcome}).`,
    },
    efficiency: {
      score: round(efficiency),
      rationale: reached
        ? `${input.ticks} ticks vs. ${ref ?? "n/a"} for a clean planner on the same objective.`
        : `Did not finish within ${input.ticks} ticks.`,
    },
    safety: {
      score: round(safety),
      rationale: `${hz} red-zone tick${hz === 1 ? "" : "s"} and ${walls} wall bump${walls === 1 ? "" : "s"}.`,
    },
    overall: round(overall),
    summary: `${s.outcome} in ${input.ticks} ticks, ${got}/${total} crystals, ${hz} red-zone ticks.`,
    source: "heuristic",
  };
}

export async function evaluateBranch(
  run: Run,
  branchId: string,
  signal?: AbortSignal,
): Promise<{ evaluation: Evaluation; fallbackReason?: string }> {
  const input = evaluationInput(run, branchId);
  const atFrame = headFrame(run.branches[branchId]);
  let reason = "evaluator unavailable";
  try {
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    const j = await res.json();
    if (res.ok && j.evaluation) {
      return { evaluation: { ...j.evaluation, source: "claude", model: j.model, atFrame } };
    }
    reason = j.reason ?? `server returned ${res.status}`;
  } catch (err) {
    if (signal?.aborted) throw err;
    reason = "network error";
  }
  return { evaluation: { ...heuristicEvaluation(input), atFrame }, fallbackReason: reason };
}
