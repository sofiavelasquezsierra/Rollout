"use client";

import { create } from "zustand";
import { decide, type AgentMode } from "@/agent/decide";
import { getLevel } from "@/sim";
import { clearDerived, headState, stateAt } from "./derive";
import {
  activeInstructions,
  addEvent,
  appendAction,
  createRun,
  forkBranch,
  headFrame,
  lineageEvents,
  renameBranch,
  setEvaluation,
  setPlan,
} from "./run";
import type { DecisionEvent, Evaluation, Run } from "./types";

export type Speed = 0.5 | 1 | 2 | 4;
export const SPEEDS: Speed[] = [0.5, 1, 2, 4];
/** Milliseconds per frame at 1× speed. */
export const BASE_FRAME_MS = 150;
/** Hard caps per branch / session so a runaway loop can't burn API budget. */
export const MAX_DECISIONS_PER_BRANCH = 60;

export interface AgentActivity {
  status: "idle" | "thinking" | "streaming" | "error";
  branchId: string | null;
  text: string;
  error?: string;
}

export interface Notice {
  id: number;
  tone: "info" | "warn" | "error";
  text: string;
}

interface RolloutState {
  run: Run;
  activeBranchId: string;
  cursor: number;
  playing: boolean;
  speed: Speed;
  agentMode: AgentMode;
  activity: AgentActivity;
  /** Most recently created branch — drives the growth animation once. */
  freshBranchId: string | null;
  renamingId: string | null;
  compare: [string, string] | null;
  notice: Notice | null;

  loadRun(run: Run, opts?: { branchId?: string; cursor?: number; mode?: AgentMode }): void;
  newRun(levelId: string, mode?: AgentMode): void;
  setCursor(frame: number): void;
  stepBy(delta: number): void;
  togglePlay(): void;
  setPlaying(p: boolean): void;
  setSpeed(s: Speed): void;
  setAgentMode(m: AgentMode): void;
  setActiveBranch(id: string): void;
  cycleBranch(dir: 1 | -1): void;
  fork(name?: string): string;
  rename(id: string, name: string): void;
  setRenaming(id: string | null): void;
  direct(text: string): void;
  setEvaluation(id: string, e: Evaluation | null): void;
  setCompare(pair: [string, string] | null): void;
  notify(tone: Notice["tone"], text: string): void;
  dismissNotice(): void;
  tick(): void;
}

let inflight: AbortController | null = null;
let noticeSeq = 0;
let runSeq = 0;

function abortInflight() {
  inflight?.abort();
  inflight = null;
}

function blankRun(levelId: string): Run {
  const level = getLevel(levelId);
  return createRun({
    id: `session-${++runSeq}`,
    levelId,
    seed: level.seed,
    title: level.name,
    origin: "session",
  });
}

const idleActivity: AgentActivity = { status: "idle", branchId: null, text: "" };

export const useRollout = create<RolloutState>((set, get) => ({
  run: blankRun("crossing"),
  activeBranchId: "b0",
  cursor: 0,
  playing: false,
  speed: 1,
  agentMode: "scripted",
  activity: idleActivity,
  freshBranchId: null,
  renamingId: null,
  compare: null,
  notice: null,

  loadRun(run, opts = {}) {
    abortInflight();
    clearDerived(get().run.id);
    const branchId = opts.branchId ?? run.order[0];
    const b = run.branches[branchId];
    set({
      run,
      activeBranchId: branchId,
      cursor: Math.min(opts.cursor ?? headFrame(b), headFrame(b)),
      playing: false,
      activity: idleActivity,
      freshBranchId: null,
      renamingId: null,
      compare: null,
      agentMode: opts.mode ?? get().agentMode,
    });
  },

  newRun(levelId, mode) {
    get().loadRun(blankRun(levelId), { mode });
  },

  setCursor(frame) {
    const { run, activeBranchId } = get();
    const head = headFrame(run.branches[activeBranchId]);
    set({ cursor: Math.max(0, Math.min(Math.round(frame), head)) });
  },

  stepBy(delta) {
    set({ playing: false });
    get().setCursor(get().cursor + delta);
  },

  togglePlay() {
    get().setPlaying(!get().playing);
  },

  setPlaying(p) {
    if (p) {
      const { run, activeBranchId, cursor } = get();
      const b = run.branches[activeBranchId];
      // Pressing play on a finished branch at its end restarts the replay.
      if (cursor >= headFrame(b) && headState(run, activeBranchId).outcome !== "running") {
        set({ cursor: 0 });
      }
    }
    set({ playing: p });
  },

  setSpeed(speed) {
    set({ speed });
  },

  setAgentMode(agentMode) {
    abortInflight();
    set({ agentMode, activity: idleActivity });
  },

  setActiveBranch(id) {
    const { run, cursor, activeBranchId } = get();
    if (!run.branches[id] || id === activeBranchId) return;
    abortInflight();
    // Keep the playhead where it is when it's inside the target's history: that
    // makes "same frame, other branch" a one-key comparison.
    const head = headFrame(run.branches[id]);
    set({
      activeBranchId: id,
      cursor: Math.min(cursor, head),
      activity: idleActivity,
      renamingId: null,
    });
  },

  cycleBranch(dir) {
    const { run, activeBranchId } = get();
    const i = run.order.indexOf(activeBranchId);
    const next = run.order[(i + dir + run.order.length) % run.order.length];
    get().setActiveBranch(next);
  },

  fork(name) {
    const { run, activeBranchId, cursor } = get();
    abortInflight();
    const res = forkBranch(run, activeBranchId, cursor, name);
    set({
      run: res.run,
      activeBranchId: res.branchId,
      cursor,
      playing: false,
      freshBranchId: res.branchId,
      activity: idleActivity,
    });
    const b = res.run.branches[res.branchId];
    const parent = res.run.branches[b.parentId!];
    get().notify("info", `Forked “${b.name}” from ${parent.name} at f${b.forkFrame}. Press Space to let the agent explore it.`);
    return res.branchId;
  },

  rename(id, name) {
    set({ run: renameBranch(get().run, id, name), renamingId: null });
  },

  setRenaming(renamingId) {
    set({ renamingId });
  },

  direct(raw) {
    const text = raw.trim().slice(0, 280);
    if (!text) return;
    let { run, activeBranchId } = get();
    const { cursor } = get();
    const b = run.branches[activeBranchId];
    // Redirecting from the past can't rewrite history — it forks a new branch at the playhead.
    if (cursor < headFrame(b)) {
      const label = text.length > 22 ? `${text.slice(0, 22).trimEnd()}…` : text;
      activeBranchId = get().fork(label);
      run = get().run;
    }
    abortInflight();
    const head = headFrame(run.branches[activeBranchId]);
    run = addEvent(run, activeBranchId, {
      kind: "director",
      id: `d-${activeBranchId}-${head}-${run.branches[activeBranchId].events.length}`,
      frame: head,
      text,
    });
    run = setPlan(run, activeBranchId, []); // the next agent call sees the instruction
    set({ run, cursor: head, playing: true, activity: idleActivity });
  },

  setEvaluation(id, e) {
    set({ run: setEvaluation(get().run, id, e) });
  },

  setCompare(compare) {
    set({ compare });
  },

  notify(tone, text) {
    if (get().notice?.text === text) return;
    set({ notice: { id: ++noticeSeq, tone, text } });
  },

  dismissNotice() {
    set({ notice: null });
  },

  tick() {
    const s = get();
    if (!s.playing) return;
    const { run, activeBranchId: id, cursor } = s;
    const b = run.branches[id];
    const head = headFrame(b);

    // 1. Replaying recorded history.
    if (cursor < head) {
      set({ cursor: cursor + 1 });
      return;
    }

    // 2. At the head: the episode may be over.
    const state = headState(run, id);
    if (state.outcome !== "running") {
      set({ playing: false });
      return;
    }

    // 3. Execute the current plan one action per frame.
    if (b.plan.length) {
      let next = appendAction(run, id, b.plan[0]);
      next = setPlan(next, id, b.plan.slice(1));
      set({ run: next, cursor: head + 1 });
      return;
    }

    // 4. Need a new decision.
    if (s.activity.status === "thinking" || s.activity.status === "streaming") return;
    const decisions = b.events.filter((e) => e.kind === "decision").length;
    if (decisions >= MAX_DECISIONS_PER_BRANCH) {
      set({ playing: false });
      get().notify("warn", `Step cap reached on “${b.name}” (${MAX_DECISIONS_PER_BRANCH} agent calls).`);
      return;
    }
    void requestDecision(id);
  },
}));

async function requestDecision(branchId: string) {
  const { run, agentMode } = useRollout.getState();
  const b = run.branches[branchId];
  const frame = headFrame(b);
  const state = stateAt(run, branchId, frame);
  const history = lineageEvents(run, branchId)
    .filter((e): e is DecisionEvent => e.kind === "decision")
    .slice(-3)
    .map((e) => ({ frame: e.frame, actions: e.actions, reasoning: e.reasoning }));

  abortInflight();
  const ctrl = new AbortController();
  inflight = ctrl;
  useRollout.setState({ activity: { status: "thinking", branchId, text: "" } });

  try {
    const res = await decide(
      agentMode,
      { state, instructions: activeInstructions(run, branchId), history },
      {
        signal: ctrl.signal,
        onText: (text) => {
          if (ctrl.signal.aborted) return;
          useRollout.setState({ activity: { status: "streaming", branchId, text } });
        },
      },
    );
    if (ctrl.signal.aborted) return;

    const cur = useRollout.getState();
    const branch = cur.run.branches[branchId];
    // The world moved on (fork, redirect, reload) while we were thinking: discard.
    if (!branch || headFrame(branch) !== frame) return;

    const actions = res.actions.length ? res.actions : (["WAIT"] as const).slice();
    let next = addEvent(cur.run, branchId, {
      kind: "decision",
      id: `a-${branchId}-${frame}-${branch.events.length}`,
      frame,
      source: res.source,
      reasoning: res.reasoning,
      actions: [...actions],
      model: res.model,
      latencyMs: res.latencyMs,
      fallbackReason: res.fallbackReason,
    });
    next = setPlan(next, branchId, [...actions]);
    useRollout.setState({ run: next, activity: { status: "idle", branchId, text: res.reasoning } });
    if (res.fallbackReason && cur.agentMode === "claude") {
      cur.notify("warn", `Live agent unavailable — ${res.fallbackReason}. Using the scripted policy.`);
    }
  } catch (err) {
    if (ctrl.signal.aborted) return;
    useRollout.setState({
      playing: false,
      activity: { status: "error", branchId, text: "", error: err instanceof Error ? err.message : "Agent failed" },
    });
  } finally {
    if (inflight === ctrl) inflight = null;
  }
}
