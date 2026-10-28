import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describeError, getClient, partialReasoning } from "./claude";
import { AGENT_MODEL, LIMITS } from "./env";
import { AGENT_SYSTEM, agentUserPrompt } from "./prompts";
import { AgentDecision, type AgentRequest } from "./schemas";

export type AgentOutcome =
  | { ok: true; decision: AgentDecision; model: string; latencyMs: number }
  | { ok: false; reason: string };

/**
 * One agent decision from Claude. Streams the reasoning field as it is
 * generated via `onReasoning`. Never throws: failures become { ok: false }.
 */
export async function claudeAgentDecision(
  body: AgentRequest,
  opts: { signal?: AbortSignal; onReasoning?: (text: string) => void } = {},
): Promise<AgentOutcome> {
  const t0 = Date.now();
  const timeout = AbortSignal.timeout(LIMITS.agentTimeoutMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  try {
    const ms = getClient().messages.stream(
      {
        model: AGENT_MODEL,
        max_tokens: LIMITS.agentMaxTokens,
        // Fast, cheap control loop: no extended thinking, schema-constrained JSON.
        thinking: { type: "disabled" },
        output_config: { effort: "low", format: zodOutputFormat(AgentDecision) },
        system: AGENT_SYSTEM,
        messages: [{ role: "user", content: agentUserPrompt(body) }],
      },
      { signal },
    );

    let json = "";
    let last = "";
    for await (const event of ms) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        json += event.delta.text;
        const r = partialReasoning(json);
        if (r && r !== last) {
          last = r;
          opts.onReasoning?.(r);
        }
      }
    }
    const final = await ms.finalMessage();
    if (final.stop_reason === "refusal") return { ok: false, reason: "the model declined this request" };
    if (final.stop_reason === "max_tokens") return { ok: false, reason: "agent response was cut off" };
    const decision = parseDecision(json);
    if (!decision) return { ok: false, reason: "agent returned an invalid plan" };
    return { ok: true, decision, model: final.model, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, reason: timeout.aborted ? "Claude API timed out" : describeError(err) };
  }
}

export function parseDecision(json: string): AgentDecision | null {
  try {
    const parsed = AgentDecision.safeParse(JSON.parse(json));
    if (!parsed.success || parsed.data.actions.length === 0) return null;
    return {
      reasoning: parsed.data.reasoning.trim().slice(0, 400),
      actions: parsed.data.actions.slice(0, 5),
    };
  } catch {
    return null;
  }
}
