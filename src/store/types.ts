import type { Action } from "@/sim";

/**
 * The run is an append-only event log. World state is never stored —
 * it is derived by replaying a branch's lineage of actions from the level's
 * initial world (see derive.ts). Forking is therefore just a new pointer.
 */

export type DecisionSource = "claude" | "scripted";

export interface DecisionEvent {
  kind: "decision";
  id: string;
  /** Global frame at which the decision was made (actions start here). */
  frame: number;
  source: DecisionSource;
  reasoning: string;
  actions: Action[];
  model?: string;
  latencyMs?: number;
  /** Why we fell back to the scripted policy, if we did. */
  fallbackReason?: string;
}

export interface DirectorEvent {
  kind: "director";
  id: string;
  frame: number;
  text: string;
}

export type RunEvent = DecisionEvent | DirectorEvent;

export interface RubricScore {
  score: number; // 0–10
  rationale: string;
}

export interface Evaluation {
  progress: RubricScore;
  efficiency: RubricScore;
  safety: RubricScore;
  overall: number; // 0–10
  summary: string;
  source: "claude" | "heuristic";
  model?: string;
  /** Head frame of the branch when it was scored (stale if the branch grew since). */
  atFrame: number;
}

export interface Branch {
  id: string;
  name: string;
  parentId: string | null;
  /** Global frame where this branch diverges from its parent (0 for the root). */
  forkFrame: number;
  colorIndex: number;
  /** Actions taken on this branch only, starting at forkFrame. */
  actions: Action[];
  events: RunEvent[];
  /** Remaining actions from the last decision, not yet executed. */
  plan: Action[];
  evaluation: Evaluation | null;
  seq: number;
}

export interface Run {
  id: string;
  title: string;
  description?: string;
  levelId: string;
  seed: number;
  origin: "example" | "session";
  /** How the example was produced, for honest labeling. */
  recordedWith?: DecisionSource | "mixed";
  branches: Record<string, Branch>;
  order: string[];
  nextSeq: number;
}

export const BRANCH_COLORS = 6;
