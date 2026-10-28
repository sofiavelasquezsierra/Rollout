"use client";

import Link from "next/link";
import { useRollout } from "@/store/useRollout";
import { Icon } from "@/components/ui/Icon";
import { Kbd } from "@/components/ui/primitives";

export function IntroBand() {
  const setDialog = useRollout((s) => s.setDialog);
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-4 pb-4 pt-5 md:px-6 [@media(max-height:860px)]:pb-3 [@media(max-height:860px)]:pt-3">
      <div className="max-w-2xl">
        <h1 className="text-24 font-medium tracking-[-0.02em] text-ink">
          Debugging agents in <span className="font-serif text-[1.08em] italic">simulated worlds</span>
        </h1>
        <p className="mt-1.5 text-15 text-ink-2 [@media(max-height:860px)]:hidden">
          Watch an agent act, scrub its rollout, fork the world at any frame, redirect it in plain language, and compare
          branches scored by a separate evaluator.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDialog("walkthrough")}
          className="group inline-flex h-9 items-center gap-2.5 rounded-md border border-line-strong bg-surface-2 pl-1.5 pr-3.5 text-13 text-ink t-fast transition-colors hover:bg-surface-3"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-ink t-base transition-transform group-hover:scale-105">
            <Icon name="play" size={12} />
          </span>
          Watch the 60-second walkthrough
        </button>
        <button
          type="button"
          onClick={() => setDialog("how")}
          className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-13 text-ink-2 t-fast transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Icon name="info" /> How this works
        </button>
        <Link
          href="/case-study"
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-13 text-ink-2 t-fast transition-colors hover:bg-surface-2 hover:text-ink"
        >
          Case study <Icon name="arrowRight" size={14} />
        </Link>
        <span className="ml-2 hidden items-center gap-1.5 text-12 text-ink-3 xl:flex">
          <Kbd>?</Kbd> shortcuts
        </span>
      </div>
    </div>
  );
}
