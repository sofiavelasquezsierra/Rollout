import { claudeAgentDecision } from "@/server/agent";
import { LIMITS, hasApiKey } from "@/server/env";
import { AGENT_LIMIT, clientIp, takeToken } from "@/server/rate-limit";
import { AgentRequest, BodyError, readJson } from "@/server/schemas";

/**
 * POST /api/agent — one agent decision, streamed as Server-Sent Events:
 *   event: delta     data: {"reasoning": "<text so far>"}
 *   event: decision  data: {"actions": [...], "reasoning": "...", "model": "...", "latencyMs": n}
 *   event: fallback  data: {"reason": "..."}   ← client switches to the scripted policy
 * Validation failures are 400/413; rate limiting is 429 with {fallback: true}.
 */
export async function POST(req: Request) {
  let body: AgentRequest;
  try {
    const parsed = AgentRequest.safeParse(await readJson(req, LIMITS.maxBodyBytes));
    if (!parsed.success) {
      return Response.json({ error: "Invalid request", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
    }
    body = parsed.data;
  } catch (e) {
    const status = e instanceof BodyError ? e.status : 400;
    return Response.json({ error: e instanceof Error ? e.message : "Bad request" }, { status });
  }

  if (body.state.outcome !== "running") {
    return Response.json({ error: "Episode is already over" }, { status: 400 });
  }

  const limit = takeToken("agent", clientIp(req), AGENT_LIMIT);
  if (!limit.ok) {
    return Response.json(
      { fallback: true, reason: limit.reason },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      if (!hasApiKey()) {
        send("fallback", { reason: "no API key configured on this deployment" });
        controller.close();
        return;
      }

      const out = await claudeAgentDecision(body, {
        signal: req.signal,
        onReasoning: (reasoning) => send("delta", { reasoning }),
      });
      if (!req.signal.aborted) {
        if (out.ok) send("decision", { ...out.decision, model: out.model, latencyMs: out.latencyMs });
        else send("fallback", { reason: out.reason });
      }
      try {
        controller.close();
      } catch {
        // client already disconnected
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
