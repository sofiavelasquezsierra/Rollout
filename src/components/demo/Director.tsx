"use client";

import { forwardRef, useState } from "react";
import { headFrame } from "@/store/run";
import { useRollout } from "@/store/useRollout";
import { Icon } from "@/components/ui/Icon";
import { Kbd } from "@/components/ui/primitives";

const SUGGESTIONS = [
  "Avoid the red zone",
  "Collect the nearest crystal first",
  "Bottom crystals first",
  "Head straight for the goal",
];

/** Natural-language redirect. Injected into the next agent call; forks if you're in the past. */
export const Director = forwardRef<HTMLTextAreaElement>(function Director(_, ref) {
  const [text, setText] = useState("");
  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const cursor = useRollout((s) => s.cursor);
  const direct = useRollout((s) => s.direct);
  const head = headFrame(run.branches[activeId]);
  const willFork = cursor < head;

  const submit = (value = text) => {
    if (!value.trim()) return;
    direct(value);
    setText("");
    // Hand the keyboard back to playback shortcuts.
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5 xl:w-auto xl:flex-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-start gap-2 rounded-md border border-line bg-surface-2 p-1 pl-3 t-fast transition-colors focus-within:border-accent/60"
      >
        <span className="pt-1.5 text-accent" aria-hidden>
          ◆
        </span>
        <label htmlFor="director" className="sr-only">
          Director instruction
        </label>
        <textarea
          id="director"
          ref={ref}
          rows={1}
          value={text}
          maxLength={280}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") e.currentTarget.blur();
          }}
          placeholder={willFork ? `Redirect from f${cursor} — this forks a new branch…` : "Redirect the agent… e.g. “stay out of the red zone”"}
          className="min-h-7 flex-1 resize-none bg-transparent py-1 text-13 text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none"
          aria-describedby="director-hint"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm bg-accent px-2.5 text-12 font-medium text-accent-ink t-fast transition-[filter,opacity] hover:brightness-110 disabled:opacity-30"
        >
          {willFork ? "Fork + redirect" : "Redirect"}
          <Icon name="send" size={14} />
        </button>
      </form>
      <div className="flex min-w-0 items-center gap-2">
        <p id="director-hint" className="shrink-0 font-mono text-[11px] text-ink-3">
          {willFork ? `forks at f${cursor}` : `applies at f${head}`} · <Kbd className="h-4 min-w-4 text-[10px]">/</Kbd> focus
        </p>
        <div className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none]">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => submit(s)}
              className="shrink-0 rounded-full border border-line px-2 py-0.5 text-12 text-ink-3 t-fast transition-colors hover:border-line-strong hover:text-ink-2"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
