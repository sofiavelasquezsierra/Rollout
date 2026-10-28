"use client";

import { useRollout } from "@/store/useRollout";

/** Scripted ↔ Claude switch. Claude is disabled (with an explanation) when the server has no key. */
export function AgentModeToggle() {
  const mode = useRollout((s) => s.agentMode);
  const live = useRollout((s) => s.live);
  const setMode = useRollout((s) => s.setAgentMode);
  const liveOk = live?.available ?? false;

  const opt = (value: "scripted" | "claude", label: string, sub: string, disabled = false) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      disabled={disabled}
      onClick={() => setMode(value)}
      title={disabled ? "No API key on this deployment — the live agent is unavailable" : sub}
      className={`flex h-6 items-center gap-1.5 rounded-sm px-2 text-12 t-fast transition-colors ${
        mode === value ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink-2"
      }`}
    >
      {value === "claude" && (
        <span
          aria-hidden
          className={`size-1.5 rounded-full ${live === null ? "bg-ink-3" : liveOk ? "bg-ok" : "bg-hazard/70"}`}
        />
      )}
      {label}
    </button>
  );

  return (
    <div role="radiogroup" aria-label="Agent" className="flex items-center rounded-md border border-line p-0.5">
      {opt("scripted", "Scripted", "Deterministic planner — no API calls")}
      {opt("claude", `Claude${live?.agentModel ? ` · ${live.agentModel.replace("claude-", "")}` : ""}`, "Live Claude agent via the server route", live !== null && !liveOk)}
    </div>
  );
}
