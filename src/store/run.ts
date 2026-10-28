import type { Action } from "@/sim";
import { BRANCH_COLORS, type Branch, type Evaluation, type Run, type RunEvent } from "./types";

/** Pure, immutable operations on a Run. Every function returns a new Run. */

export function createRun(opts: {
  id: string;
  levelId: string;
  seed: number;
  title: string;
  origin: Run["origin"];
}): Run {
  const root: Branch = {
    id: "b0",
    name: "main",
    parentId: null,
    forkFrame: 0,
    colorIndex: 0,
    actions: [],
    events: [],
    plan: [],
    evaluation: null,
    seq: 0,
  };
  return { ...opts, branches: { b0: root }, order: ["b0"], nextSeq: 1 };
}

export const headFrame = (b: Branch) => b.forkFrame + b.actions.length;

function patch(run: Run, id: string, fn: (b: Branch) => Branch): Run {
  const b = run.branches[id];
  if (!b) return run;
  return { ...run, branches: { ...run.branches, [id]: fn(b) } };
}

/** The branch whose own segment contains `frame`, walking up from `branchId`. */
export function ownerOf(run: Run, branchId: string, frame: number): Branch {
  let b = run.branches[branchId];
  while (b.parentId && frame < b.forkFrame) b = run.branches[b.parentId];
  return b;
}

export function forkBranch(
  run: Run,
  fromId: string,
  frame: number,
  name?: string,
): { run: Run; branchId: string } {
  const from = run.branches[fromId];
  const f = Math.max(0, Math.min(frame, headFrame(from)));
  const parent = ownerOf(run, fromId, f);
  const seq = run.nextSeq;
  const id = `b${seq}`;
  const branch: Branch = {
    id,
    name: name ?? `fork-${seq}`,
    parentId: parent.id,
    forkFrame: f,
    colorIndex: seq % BRANCH_COLORS,
    actions: [],
    events: [],
    plan: [],
    evaluation: null,
    seq,
  };
  return {
    run: { ...run, branches: { ...run.branches, [id]: branch }, order: [...run.order, id], nextSeq: seq + 1 },
    branchId: id,
  };
}

export const appendAction = (run: Run, id: string, action: Action): Run =>
  patch(run, id, (b) => ({ ...b, actions: [...b.actions, action] }));

export const addEvent = (run: Run, id: string, event: RunEvent): Run =>
  patch(run, id, (b) => ({ ...b, events: [...b.events, event] }));

export const setPlan = (run: Run, id: string, plan: Action[]): Run =>
  patch(run, id, (b) => ({ ...b, plan }));

export const renameBranch = (run: Run, id: string, name: string): Run =>
  patch(run, id, (b) => ({ ...b, name: name.trim().slice(0, 40) || b.name }));

export const setEvaluation = (run: Run, id: string, evaluation: Evaluation | null): Run =>
  patch(run, id, (b) => ({ ...b, evaluation }));

/** Ancestors from root to `id` inclusive. */
export function lineage(run: Run, id: string): Branch[] {
  const out: Branch[] = [];
  let b: Branch | undefined = run.branches[id];
  while (b) {
    out.unshift(b);
    b = b.parentId ? run.branches[b.parentId] : undefined;
  }
  return out;
}

/** Events visible from a branch: each ancestor's events before its child's fork point, plus its own. */
export function lineageEvents(run: Run, id: string): RunEvent[] {
  const chain = lineage(run, id);
  const out: RunEvent[] = [];
  chain.forEach((b, i) => {
    const cut = i < chain.length - 1 ? chain[i + 1].forkFrame : Infinity;
    for (const e of b.events) if (e.frame < cut) out.push(e);
  });
  return out;
}

/** Director instructions in effect at the head of a branch, oldest first. */
export function activeInstructions(run: Run, id: string): string[] {
  return lineageEvents(run, id)
    .filter((e) => e.kind === "director")
    .map((e) => (e as Extract<RunEvent, { kind: "director" }>).text);
}

export function children(run: Run, id: string): Branch[] {
  return run.order.map((k) => run.branches[k]).filter((b) => b.parentId === id);
}
