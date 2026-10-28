import { scriptedPolicy, type Action, type WorldState } from "@/sim";
import type { DecisionSource } from "@/store/types";

export type AgentMode = "scripted" | "claude";

export interface DecideRequest {
  state: WorldState;
  instructions: string[];
  /** Recent decisions on this lineage, newest last — gives the model short-term memory. */
  history: { frame: number; actions: Action[]; reasoning: string }[];
}

export interface DecideResult {
  actions: Action[];
  reasoning: string;
  source: DecisionSource;
  model?: string;
  latencyMs: number;
  fallbackReason?: string;
}

export interface DecideHooks {
  signal?: AbortSignal;
  /** Streamed reasoning text so far (Claude only). */
  onText?: (text: string) => void;
}

export function decideScripted(req: DecideRequest, fallbackReason?: string): DecideResult {
  const t0 = performance.now();
  const d = scriptedPolicy(req.state, req.instructions);
  return {
    actions: d.actions,
    reasoning: d.reasoning,
    source: "scripted",
    latencyMs: Math.round(performance.now() - t0),
    fallbackReason,
  };
}

export async function decide(mode: AgentMode, req: DecideRequest, hooks: DecideHooks = {}): Promise<DecideResult> {
  if (mode === "scripted") return decideScripted(req);
  const { decideClaude } = await import("./claude-client");
  return decideClaude(req, hooks);
}
