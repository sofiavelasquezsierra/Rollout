import { LIMITS, hasApiKey } from "@/server/env";
import { claudeEvaluate } from "@/server/evaluator";
import { EVAL_LIMIT, clientIp, takeToken } from "@/server/rate-limit";
import { BodyError, EvaluateRequest, readJson } from "@/server/schemas";

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

  const out = await claudeEvaluate(body, req.signal);
  return Response.json(out.ok ? { evaluation: out.evaluation, model: out.model } : { fallback: true, reason: out.reason });
}
