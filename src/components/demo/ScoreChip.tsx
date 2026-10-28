import type { Evaluation } from "@/store/types";

export function scoreTone(score: number) {
  return score >= 7.5 ? "text-ok border-ok/40" : score >= 5 ? "text-accent border-accent/40" : "text-hazard border-hazard/40";
}

/** Compact overall score; dashed border when the branch has grown since it was scored. */
export function ScoreChip({ evaluation, stale }: { evaluation: Evaluation; stale?: boolean }) {
  return (
    <span
      title={`${evaluation.source === "claude" ? "Evaluator (Claude)" : "Heuristic score"}: ${evaluation.overall.toFixed(1)}/10${stale ? " — branch changed since scoring" : ""}`}
      className={`inline-flex h-5 items-center rounded-sm border px-1.5 font-mono text-12 tabular ${scoreTone(evaluation.overall)} ${stale ? "border-dashed opacity-70" : ""}`}
    >
      {evaluation.overall.toFixed(1)}
    </span>
  );
}
