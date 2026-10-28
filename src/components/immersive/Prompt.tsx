"use client";

import { forwardRef, useState } from "react";
import { headFrame } from "@/store/run";
import { useRollout } from "@/store/useRollout";
import { Icon } from "@/components/ui/Icon";

const SUGGESTIONS = ["Avoid the caution zones", "Nearest parcel first", "Bottom parcels first", "Return to the dock now"];

/** Talk to the agent. In the past, speaking splits the world first. */
export const Prompt = forwardRef<HTMLInputElement>(function Prompt(_, ref) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const cursor = useRollout((s) => s.cursor);
  const direct = useRollout((s) => s.direct);
  const willFork = cursor < headFrame(run.branches[activeId]);

  const submit = (v = text) => {
    if (!v.trim()) return;
    direct(v);
    setText("");
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={`flex items-center gap-2 rounded-full border bg-white/[0.03] py-1 pl-4 pr-1 t-base transition-[border-color,box-shadow] ${
          focused ? "border-accent/60 shadow-[0_0_28px_var(--c-glow)]" : "border-[var(--c-glass-line)]"
        }`}
      >
        <span className="text-accent" aria-hidden>
          ◆
        </span>
        <label htmlFor="prompt" className="sr-only">
          Tell the agent what to do
        </label>
        <input
          id="prompt"
          ref={ref}
          value={text}
          maxLength={280}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
          placeholder={willFork ? `Tell the agent — this splits a new world at f${cursor}` : "Tell the agent what to do…"}
          className="h-8 min-w-0 flex-1 bg-transparent text-15 text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3.5 text-13 font-medium text-accent-ink t-fast transition-[filter,opacity] hover:brightness-110 disabled:opacity-30"
        >
          {willFork ? "Split + tell" : "Tell"}
          <Icon name="send" size={14} />
        </button>
      </form>
      <div className="mt-2 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]" aria-label="Suggestions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => submit(s)}
            className="shrink-0 rounded-full border border-[var(--c-glass-line)] px-2.5 py-0.5 text-12 text-ink-3 t-fast transition-colors hover:border-accent/40 hover:text-ink"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
});
