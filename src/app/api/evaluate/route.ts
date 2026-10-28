import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describeError, getClient } from "@/server/claude";
import { EVALUATOR_MODEL, LIMITS, hasApiKey } from "@/server/env";
import { EVALUATOR_SYSTEM, evaluatorUserPrompt } from "@/server/prompts";
import { EVAL_LIMIT, clientIp, takeToken } from "@/server/rate-limit";
import { BodyError, EvaluateRequest, EvaluationOutput, readJson } from "@/server/schemas";

/**
 * POST /api/evaluate — a separate Claude call (distinct model and prompt from
 * the agent) that scores one branch against a fixed rubric.
 * Returns { evaluation, model } or { fallback: true, reason } — the client then
 * computes a clearly labeled heuristic score instead.
 */
export async function POST(req: Request) {
  let body: EvaluateRequest;
  try {
    const parsed = EvaluateRequest.safeParse(await readJson(req, LIMITS.maxBodyBytes));
    if (!parsed.success) {
      return Response.json({ error: "Invalid request", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
    }
    body = parsed.data;
  } catch (e) {
    const status = e instanceof BodyError ? e.status : 400;
    return Response.json({ error: e instanceof Error ? e.message : "Bad request" }, { status });
  }

  if (!hasApiKey()) {
    return Response.json({ fallback: true, reason: "no API key configured on this deployment" });
  }

  const limit = takeToken("evaluate", clientIp(req), EVAL_LIMIT);
  if (!limit.ok) {
    return Response.json(
      { fallback: true, reason: limit.reason },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  try {
    const msg = await getClient().beta.messages.create(
      {
        model: EVALUATOR_MODEL,
        max_tokens: LIMITS.evaluatorMaxTokens,
        // Server-side refusal fallback: routes a declined request to Anthropic's recommended model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium", format: zodOutputFormat(EvaluationOutput) },
        system: EVALUATOR_SYSTEM,
        messages: [{ role: "user", content: evaluatorUserPrompt(body) }],
      },
      { signal: AbortSignal.any([req.signal, AbortSignal.timeout(LIMITS.evaluatorTimeoutMs)]) },
    );

    if (msg.stop_reason === "refusal") {
      return Response.json({ fallback: true, reason: "the evaluator declined this request" });
    }
    if (msg.stop_reason === "max_tokens") {
      return Response.json({ fallback: true, reason: "evaluator response was cut off" });
    }
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = EvaluationOutput.safeParse(safeParse(text));
    if (!parsed.success) {
      return Response.json({ fallback: true, reason: "evaluator returned an invalid score" });
    }
    return Response.json({ evaluation: clampScores(parsed.data), model: msg.model });
  } catch (err) {
    return Response.json({ fallback: true, reason: describeError(err) });
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
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
