/**
 * Records the bundled example runs into src/examples/<id>.json.
 *
 *   npm run record:examples            # scripted policy + heuristic evaluator (deterministic)
 *   ANTHROPIC_API_KEY=... npm run record:examples -- --live
 *                                      # live Claude agent + Claude evaluator
 *
 * Each recording is labeled with how it was produced, and the UI shows that label.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { decideScripted, type DecideRequest, type DecideResult } from "@/agent/decide";
import { evaluationInput, heuristicEvaluation } from "@/agent/evaluate";
import { advance, directAtHead, finalize, fork, type Decider } from "@/agent/headless";
import { SCENARIOS } from "@/examples/scenarios";
import { claudeAgentDecision } from "@/server/agent";
import { hasApiKey } from "@/server/env";
import { claudeEvaluate } from "@/server/evaluator";
import { getLevel } from "@/sim";
import { createRun, headFrame, setEvaluation } from "@/store/run";
import type { Evaluation, Run } from "@/store/types";

const live = process.argv.includes("--live");
if (live && !hasApiKey()) {
  console.error("--live needs ANTHROPIC_API_KEY in the environment.");
  process.exit(1);
}

const scripted: Decider = async (req) => decideScripted(req);
const claude: Decider = async (req: DecideRequest): Promise<DecideResult> => {
  const out = await claudeAgentDecision(req);
  if (out.ok) return { ...out.decision, source: "claude", model: out.model, latencyMs: out.latencyMs };
  return decideScripted(req, out.reason);
};

async function record(id: string) {
  const sc = SCENARIOS.find((s) => s.id === id)!;
  const level = getLevel(sc.levelId);
  let run: Run = createRun({ id: `example-${sc.id}`, levelId: sc.levelId, seed: level.seed, title: sc.title, origin: "example" });
  run = { ...run, description: sc.description };
  const alias: Record<string, string> = { main: "b0" };
  const decider = live ? claude : scripted;

  for (const step of sc.steps) {
    if (step.op === "run") run = await advance(run, alias[step.branch], decider, { untilFrame: step.until });
    if (step.op === "direct") run = directAtHead(run, alias[step.branch], step.text);
    if (step.op === "fork") {
      const res = fork(run, alias[step.from], step.frame, step.name);
      run = res.run;
      alias[step.as] = res.branchId;
    }
  }
  run = finalize(run);

  for (const bid of run.order) {
    const input = evaluationInput(run, bid);
    const atFrame = headFrame(run.branches[bid]);
    let evaluation: Evaluation = { ...heuristicEvaluation(input), atFrame };
    if (live) {
      const out = await claudeEvaluate(input);
      if (out.ok) evaluation = { ...out.evaluation, source: "claude", model: out.model, atFrame };
      else console.warn(`  evaluator fell back for ${bid}: ${out.reason}`);
    }
    run = setEvaluation(run, bid, evaluation);
  }

  const decisions = Object.values(run.branches).flatMap((b) => b.events.filter((e) => e.kind === "decision"));
  const sources = new Set(decisions.map((d) => (d.kind === "decision" ? d.source : "")));
  run = { ...run, recordedWith: sources.size > 1 ? "mixed" : live && sources.has("claude") ? "claude" : "scripted" };

  const focusId = alias[sc.focus.branch];
  const fb = run.branches[focusId];
  const cursor = sc.focus.cursor === "start" ? 0 : sc.focus.cursor === "fork" ? fb.forkFrame : headFrame(fb);
  const out = { ...run, focus: { branchId: focusId, cursor } };

  const file = path.join(process.cwd(), "src/examples", `${sc.id}.json`);
  writeFileSync(file, JSON.stringify(out) + "\n");
  console.log(`✓ ${sc.id}: ${run.order.length} branches, ${decisions.length} decisions (${run.recordedWith}) → ${path.relative(process.cwd(), file)}`);
}

for (const sc of SCENARIOS) await record(sc.id);
