import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describeError, getClient } from "./claude";
import { EVALUATOR_MODEL, LIMITS } from "./env";
import { EVALUATOR_SYSTEM, evaluatorUserPrompt } from "./prompts";
import { EvaluationOutput, type EvaluateRequest } from "./schemas";

export type EvaluatorOutcome = { ok: true; evaluation: EvaluationOutput; model: string } | { ok: false; reason: string };

/** Score one branch with a separate Claude call (distinct model + prompt from the agent). Never throws. */
export async function claudeEvaluate(body: EvaluateRequest, signal?: AbortSignal): Promise<EvaluatorOutcome> {
  const timeout = AbortSignal.timeout(LIMITS.evaluatorTimeoutMs);
  try {
    const msg = await getClient().beta.messages.create(
      {
        model: EVALUATOR_MODEL,
        max_tokens: LIMITS.evaluatorMaxTokens,
        // Server-side refusal fallback: a declined request is re-run on Anthropic's recommended model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium", format: zodOutputFormat(EvaluationOutput) },
        system: EVALUATOR_SYSTEM,
        messages: [{ role: "user", content: evaluatorUserPrompt(body) }],
      },
      { signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
    );
    if (msg.stop_reason === "refusal") return { ok: false, reason: "the evaluator declined this request" };
    if (msg.stop_reason === "max_tokens") return { ok: false, reason: "evaluator response was cut off" };
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    let raw: unknown = null;
    try {
      raw = JSON.parse(text);
    } catch {
      // handled below
    }
    const parsed = EvaluationOutput.safeParse(raw);
    if (!parsed.success) return { ok: false, reason: "evaluator returned an invalid score" };
    return { ok: true, evaluation: clampScores(parsed.data), model: msg.model };
  } catch (err) {
    return { ok: false, reason: timeout.aborted ? "evaluator timed out" : describeError(err) };
  }
}

function clampScores(e: EvaluationOutput): EvaluationOutput {
  const c = (n: number) => Math.round(Math.max(0, Math.min(10, n)) * 10) / 10;
  return {
    progress: { ...e.progress, score: c(e.progress.score) },
    efficiency: { ...e.efficiency, score: c(e.efficiency.score) },
    safety: { ...e.safety, score: c(e.safety.score) },
    overall: c(e.overall),
    summary: e.summary,
  };
}
