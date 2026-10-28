"use client";

import { useEffect, useRef } from "react";
import { branchVar } from "@/lib/tokens";
import { summarize } from "@/store/selectors";
import { useRollout } from "@/store/useRollout";
import { Icon } from "@/components/ui/Icon";
import { ScoreChip } from "./ScoreChip";

const OUTCOME_STYLE: Record<string, string> = {
  running: "text-ink-3",
  success: "text-ok",
  partial: "text-accent",
  timeout: "text-hazard",
};

export function BranchList() {
  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const renamingId = useRollout((s) => s.renamingId);
  const { setActiveBranch, rename, setRenaming } = useRollout.getState();

  return (
    <ul className="flex flex-col gap-0.5" aria-label="Branches">
      {run.order.map((id) => {
        const sum = summarize(run, id);
        const b = sum.branch;
        const active = id === activeId;
        const parent = b.parentId ? run.branches[b.parentId] : null;
        return (
          <li key={id}>
            <div
              className={`group relative flex items-start gap-2.5 rounded-md px-2 py-1.5 t-fast transition-colors ${
                active ? "bg-surface-3" : "hover:bg-surface-2"
              }`}
            >
              <span
                aria-hidden
                className="mt-[5px] size-2.5 shrink-0 rounded-full"
                style={{ background: branchVar(b.colorIndex), boxShadow: active ? `0 0 0 3px color-mix(in srgb, ${branchVar(b.colorIndex)} 25%, transparent)` : undefined }}
              />
              <div className="min-w-0 flex-1">
                {renamingId === id ? (
                  <RenameInput
                    initial={b.name}
                    onDone={(v) => (v === null ? setRenaming(null) : rename(id, v))}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveBranch(id)}
                    onDoubleClick={() => setRenaming(id)}
                    aria-current={active ? "true" : undefined}
                    className="block w-full truncate text-left text-13 text-ink after:absolute after:inset-0"
                  >
                    {b.name}
                  </button>
                )}
                <div className="mt-0.5 flex items-center gap-1.5 font-mono text-12 text-ink-3 tabular">
                  <span>
                    {parent ? `⑂ ${parent.name}@${b.forkFrame}` : "root"} · f{sum.head}
                  </span>
                  <span className={OUTCOME_STYLE[sum.outcome]}>{sum.outcome}</span>
                </div>
              </div>
              <div className="relative z-10 flex shrink-0 items-center gap-1 pt-0.5">
                {b.evaluation && <ScoreChip evaluation={b.evaluation} stale={b.evaluation.atFrame !== sum.head} />}
                {renamingId !== id && (
                  <button
                    type="button"
                    onClick={() => setRenaming(id)}
                    aria-label={`Rename ${b.name}`}
                    title="Rename (R)"
                    className="rounded-sm p-0.5 text-ink-3 opacity-0 t-fast transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Icon name="pencil" size={14} />
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (v: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const settled = useRef(false);
  const finish = (v: string | null) => {
    if (settled.current) return;
    settled.current = true;
    onDone(v);
  };
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <input
      ref={ref}
      defaultValue={initial}
      maxLength={40}
      aria-label="Branch name"
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(e.currentTarget.value);
        if (e.key === "Escape") finish(null);
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
      className="h-6 w-full rounded-sm border border-accent/60 bg-surface-1 px-1.5 text-13 text-ink outline-none"
    />
  );
}
