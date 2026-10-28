import { z } from "zod";
import { isWorldState, type WorldState } from "@/sim";
import { LIMITS } from "./env";

const action = z.enum(["N", "S", "E", "W", "WAIT"]);

const worldState = z.custom<WorldState>((v) => isWorldState(v), "Invalid world state").refine(
  (s) => s.width <= 64 && s.height <= 64 && s.objects.length <= 32 && s.hazards.length <= 16 && s.violations.length <= 1000,
  "World state too large",
);

const instruction = z.string().trim().min(1).max(LIMITS.maxInstructionChars);

export const AgentRequest = z.object({
  state: worldState,
  instructions: z.array(instruction).max(LIMITS.maxInstructions).default([]),
  history: z
    .array(
      z.object({
        frame: z.number().int().min(0).max(10_000),
        actions: z.array(action).max(8),
        reasoning: z.string().max(600),
      }),
    )
    .max(LIMITS.maxHistory)
    .default([]),
});
export type AgentRequest = z.infer<typeof AgentRequest>;

/** What we ask the agent model to return (structured output). */
export const AgentDecision = z.object({
  reasoning: z.string().describe("One or two short sentences: what you are doing next and why."),
  actions: z.array(action).describe("The next 3 to 5 actions, in order."),
});
export type AgentDecision = z.infer<typeof AgentDecision>;

const rubricScore = z.object({
  score: z.number().min(0).max(10),
  rationale: z.string().max(600),
});

export const EvaluateRequest = z.object({
  branchName: z.string().trim().min(1).max(60),
  levelName: z.string().max(60),
  finalState: worldState,
  ticks: z.number().int().min(0).max(10_000),
  instructions: z.array(z.object({ frame: z.number().int(), text: instruction })).max(LIMITS.maxInstructions),
  decisions: z.number().int().min(0).max(1000),
  /** Shortest clean path length from start, computed client-side by the planner, as a reference. */
  referenceTicks: z.number().int().min(0).max(10_000).nullable(),
  /** Compact path trace: agent position every few frames. */
  trace: z.array(z.tuple([z.number().int(), z.number().int()])).max(400),
});
export type EvaluateRequest = z.infer<typeof EvaluateRequest>;

export const EvaluationOutput = z.object({
  progress: rubricScore,
  efficiency: rubricScore,
  safety: rubricScore,
  overall: z.number().min(0).max(10),
  summary: z.string().max(400),
});
export type EvaluationOutput = z.infer<typeof EvaluationOutput>;

/** Read a JSON body with a hard byte cap before parsing. */
export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new BodyError(413, "Request body too large");
  const text = await req.text();
  if (text.length > maxBytes) throw new BodyError(413, "Request body too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new BodyError(400, "Body is not valid JSON");
  }
}

export class BodyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
