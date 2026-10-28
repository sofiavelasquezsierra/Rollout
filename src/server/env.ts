/**
 * Server-only configuration. The API key is read from process.env and never
 * leaves the server: routes return decisions, not credentials.
 */
export const AGENT_MODEL = process.env.ROLLOUT_AGENT_MODEL || "claude-haiku-5-5";
export const EVALUATOR_MODEL = process.env.ROLLOUT_EVALUATOR_MODEL || "claude-sonnet-5-5";

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Hard caps — the client has its own, but the server is the one that matters. */
export const LIMITS = {
  agentMaxTokens: 400,
  // Sonnet runs adaptive thinking; thinking tokens count toward this cap.
  evaluatorMaxTokens: 4000,
  agentTimeoutMs: 20_000,
  evaluatorTimeoutMs: 45_000,
  maxBodyBytes: 32_000,
  maxInstructions: 12,
  maxInstructionChars: 280,
  maxHistory: 4,
} as const;
