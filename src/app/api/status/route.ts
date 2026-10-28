import { connection } from "next/server";
import { AGENT_MODEL, EVALUATOR_MODEL, hasApiKey } from "@/server/env";

/** GET /api/status — whether live Claude calls are available. Never reveals the key. */
export async function GET() {
  await connection(); // evaluate at request time, not at build
  return Response.json(
    { live: hasApiKey(), agentModel: AGENT_MODEL, evaluatorModel: EVALUATOR_MODEL },
    { headers: { "Cache-Control": "no-store" } },
  );
}
