import { ReplayCache, createWorld, step, type Action, type Vec, type WorldState } from "@/sim";
import { headFrame, lineage } from "./run";
import type { Branch, Run } from "./types";

/**
 * Derived world state. Each branch gets a ReplayCache over its full lineage of
 * actions (root → branch), so scrubbing anywhere costs ≤ 16 sim steps.
 * Caches live outside the store: they are pure memoization, not state.
 */

interface Entry {
  runId: string;
  initial: WorldState;
  cache: ReplayCache;
  lineageKey: Branch[];
  lineageActions: Action[];
}

const entries = new Map<string, Entry>();
const initials = new Map<string, WorldState>();

export function initialWorld(run: Run): WorldState {
  const key = `${run.levelId}:${run.seed}`;
  let w = initials.get(key);
  if (!w) {
    w = createWorld(run.levelId, run.seed);
    initials.set(key, w);
  }
  return w;
}

export function lineageActions(run: Run, branchId: string): Action[] {
  const chain = lineage(run, branchId);
  const key = `${run.id}/${branchId}`;
  const hit = entries.get(key);
  if (hit && hit.lineageKey.length === chain.length && hit.lineageKey.every((b, i) => b === chain[i])) {
    return hit.lineageActions;
  }
  const actions: Action[] = [];
  chain.forEach((b, i) => {
    const take = i < chain.length - 1 ? chain[i + 1].forkFrame - b.forkFrame : b.actions.length;
    for (let k = 0; k < take; k++) actions.push(b.actions[k]);
  });
  const initial = initialWorld(run);
  const entry: Entry =
    hit && hit.initial === initial
      ? { ...hit, lineageKey: chain, lineageActions: actions }
      : { runId: run.id, initial, cache: new ReplayCache(initial), lineageKey: chain, lineageActions: actions };
  entries.set(key, entry);
  return actions;
}

export function stateAt(run: Run, branchId: string, frame: number): WorldState {
  const actions = lineageActions(run, branchId);
  const entry = entries.get(`${run.id}/${branchId}`)!;
  return entry.cache.stateAt(actions, Math.max(0, Math.min(frame, actions.length)));
}

export function headState(run: Run, branchId: string): WorldState {
  const b = run.branches[branchId];
  return stateAt(run, branchId, headFrame(b));
}

/** Agent positions for frames [from, to] on a branch — used for trails and ghost paths. */
export function pathOf(run: Run, branchId: string, from: number, to: number): Vec[] {
  const actions = lineageActions(run, branchId);
  const start = Math.max(0, Math.min(from, actions.length));
  const end = Math.min(to, actions.length);
  let s = stateAt(run, branchId, start);
  const out: Vec[] = [s.agent.pos];
  for (let f = start; f < end; f++) {
    s = step(s, actions[f]);
    out.push(s.agent.pos);
  }
  return out;
}

export function clearDerived(runId?: string) {
  for (const [k, e] of entries) if (!runId || e.runId === runId) entries.delete(k);
}
