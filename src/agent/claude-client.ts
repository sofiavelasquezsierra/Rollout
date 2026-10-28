import type { Action } from "@/sim";
import { decideScripted, type DecideHooks, type DecideRequest, type DecideResult } from "./decide";
import { readSse } from "./sse";

/** Per-tab budget for live calls, on top of the server's per-IP limits. */
export const MAX_LIVE_CALLS_PER_SESSION = 120;
let liveCalls = 0;

/**
 * Ask the server route for a Claude decision. Every failure path resolves to
 * the scripted policy with a human-readable reason, so the rollout never stalls.
 */
export async function decideClaude(req: DecideRequest, hooks: DecideHooks): Promise<DecideResult> {
  if (liveCalls >= MAX_LIVE_CALLS_PER_SESSION) {
    return decideScripted(req, "session call budget used up");
  }
  liveCalls++;

  let res: Response;
  try {
    res = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: hooks.signal,
    });
  } catch (err) {
    if (hooks.signal?.aborted) throw err;
    return decideScripted(req, "network error");
  }

  if (!res.ok || !res.body) {
    const reason =
      res.status === 429 ? ((await safeJson(res))?.reason ?? "rate limited") : `server returned ${res.status}`;
    return decideScripted(req, reason);
  }

  try {
    for await (const { event, data } of readSse(res.body, hooks.signal)) {
      if (event === "delta") hooks.onText?.(String((data as { reasoning?: string }).reasoning ?? ""));
      if (event === "decision") {
        const d = data as { actions: Action[]; reasoning: string; model?: string; latencyMs?: number };
        return { actions: d.actions, reasoning: d.reasoning, source: "claude", model: d.model, latencyMs: d.latencyMs ?? 0 };
      }
      if (event === "fallback") {
        return decideScripted(req, String((data as { reason?: string }).reason ?? "live agent unavailable"));
      }
    }
  } catch (err) {
    if (hooks.signal?.aborted) throw err;
    return decideScripted(req, "stream interrupted");
  }
  return decideScripted(req, "stream ended without a decision");
}

async function safeJson(res: Response): Promise<{ reason?: string } | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
