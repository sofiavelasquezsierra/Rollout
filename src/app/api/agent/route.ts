import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { describeError, getClient, partialReasoning } from "@/server/claude";
import { AGENT_MODEL, LIMITS, hasApiKey } from "@/server/env";
import { AGENT_SYSTEM, agentUserPrompt } from "@/server/prompts";
import { AGENT_LIMIT, clientIp, takeToken } from "@/server/rate-limit";
import { AgentDecision, AgentRequest, BodyError, readJson } from "@/server/schemas";

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

      const t0 = Date.now();
      const timeout = AbortSignal.timeout(LIMITS.agentTimeoutMs);
      const signal = AbortSignal.any([req.signal, timeout]);
      try {
        const ms = getClient().messages.stream(
          {
            model: AGENT_MODEL,
            max_tokens: LIMITS.agentMaxTokens,
            // Fast, cheap control loop: minimal thinking, schema-constrained JSON.
            thinking: { type: "disabled" },
            output_config: { effort: "low", format: zodOutputFormat(AgentDecision) },
            system: AGENT_SYSTEM,
            messages: [{ role: "user", content: agentUserPrompt(body) }],
          },
          { signal },
        );

        let json = "";
        let lastSent = "";
        for await (const event of ms) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            json += event.delta.text;
            const r = partialReasoning(json);
            if (r && r !== lastSent) {
              lastSent = r;
              send("delta", { reasoning: r });
            }
          }
        }
        const final = await ms.finalMessage();
        if (final.stop_reason === "refusal") {
          send("fallback", { reason: "the model declined this request" });
        } else if (final.stop_reason === "max_tokens") {
          send("fallback", { reason: "agent response was cut off" });
        } else {
          const decision = parseDecision(json);
          if (!decision) send("fallback", { reason: "agent returned an invalid plan" });
          else send("decision", { ...decision, model: final.model, latencyMs: Date.now() - t0 });
        }
      } catch (err) {
        if (!req.signal.aborted) {
          send("fallback", { reason: timeout.aborted ? "Claude API timed out" : describeError(err) });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // client already disconnected
        }
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

function parseDecision(json: string): AgentDecision | null {
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
