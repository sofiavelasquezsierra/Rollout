import type { Action, WorldState } from "@/sim";
import { headState, lineageActions, stateAt } from "@/store/derive";
import { activeInstructions, addEvent, appendAction, forkBranch, headFrame, lineageEvents, setPlan } from "@/store/run";
import type { DecisionEvent, Run } from "@/store/types";
import type { DecideRequest, DecideResult } from "./decide";

/**
 * Headless rollout driver: the same decide → plan → act loop the UI runs,
 * without timers. Used to record the bundled example runs and in tests.
 */
export type Decider = (req: DecideRequest) => Promise<DecideResult>;

export async function advance(
  run: Run,
  branchId: string,
  decider: Decider,
  opts: { untilFrame?: number; maxDecisions?: number } = {},
): Promise<Run> {
  const until = opts.untilFrame ?? Infinity;
  let decisions = 0;
  for (;;) {
    const b = run.branches[branchId];
    const head = headFrame(b);
    const s: WorldState = headState(run, branchId);
    if (s.outcome !== "running" || head >= until) return run;

    if (b.plan.length) {
      run = appendAction(run, branchId, b.plan[0]);
      run = setPlan(run, branchId, b.plan.slice(1));
      continue;
    }
    if (decisions >= (opts.maxDecisions ?? 80)) return run;
    decisions++;
    const history = lineageEvents(run, branchId)
      .filter((e): e is DecisionEvent => e.kind === "decision")
      .slice(-3)
      .map((e) => ({ frame: e.frame, actions: e.actions, reasoning: e.reasoning }));
    const res = await decider({ state: stateAt(run, branchId, head), instructions: activeInstructions(run, branchId), history });
    const actions: Action[] = res.actions.length ? res.actions : ["WAIT"];
    run = addEvent(run, branchId, {
      kind: "decision",
      id: `a-${branchId}-${head}-${b.events.length}`,
      frame: head,
      source: res.source,
      reasoning: res.reasoning,
      actions,
      model: res.model,
      latencyMs: res.latencyMs,
      fallbackReason: res.fallbackReason,
    });
    run = setPlan(run, branchId, actions);
  }
}

/** Director instruction at the branch head, clearing the pending plan (same semantics as the UI). */
export function directAtHead(run: Run, branchId: string, text: string): Run {
  const head = headFrame(run.branches[branchId]);
  run = addEvent(run, branchId, {
    kind: "director",
    id: `d-${branchId}-${head}-${run.branches[branchId].events.length}`,
    frame: head,
    text,
  });
  return setPlan(run, branchId, []);
}

export function fork(run: Run, fromId: string, frame: number, name: string) {
  return forkBranch(run, fromId, frame, name);
}

/** Strip unexecuted plans so a recorded run is a clean, finished log. */
export function finalize(run: Run): Run {
  const branches = Object.fromEntries(
    Object.entries(run.branches).map(([id, b]) => [id, { ...b, plan: [] }]),
  );
  return { ...run, branches };
}

export { lineageActions };
