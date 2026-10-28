import { decideScripted, type DecideHooks, type DecideRequest, type DecideResult } from "./decide";

/** Placeholder until the live agent route lands (Phase 4): always falls back. */
export async function decideClaude(req: DecideRequest, hooks: DecideHooks): Promise<DecideResult> {
  void hooks;
  return decideScripted(req, "Live agent not wired yet");
}
