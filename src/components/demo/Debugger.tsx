"use client";

import { useMemo, useRef, useState } from "react";
import { LEVELS } from "@/sim";
import { useRollout } from "@/store/useRollout";
import { Button, Kbd, Label } from "@/components/ui/primitives";
import { BranchGraph } from "./BranchGraph";
import { BranchList } from "./BranchList";
import { NoticeToast } from "./NoticeToast";
import { Timeline } from "./Timeline";
import { Transport } from "./Transport";
import { WorldCanvas } from "./world/WorldCanvas";
import { WorldHud } from "./WorldHud";
import { usePlaybackLoop } from "./usePlaybackLoop";
import { useShortcuts } from "./useShortcuts";

export function Debugger() {
  usePlaybackLoop();
  const directorRef = useRef<HTMLTextAreaElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const handlers = useMemo(
    () => ({
      focusDirector: () => directorRef.current?.focus(),
      toggleHelp: () => setHelpOpen((v) => !v),
    }),
    [],
  );
  useShortcuts(handlers);

  const run = useRollout((s) => s.run);
  const cursor = useRollout((s) => s.cursor);
  const freshId = useRollout((s) => s.freshBranchId);
  const { newRun, fork } = useRollout.getState();

  return (
    <section
      aria-label="Rollout debugger"
      className="grid h-[calc(100dvh-48px)] min-h-[620px] grid-rows-[auto_1fr_auto] border-t border-line bg-bg"
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-2">
        <Label>Run</Label>
        <span className="text-13 text-ink">{run.title}</span>
        <select
          aria-label="Start a new run on level"
          value=""
          onChange={(e) => e.target.value && newRun(e.target.value)}
          className="ml-auto h-7 rounded-md border border-line bg-surface-2 px-2 text-12 text-ink-2"
        >
          <option value="">New run…</option>
          {LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid min-h-0 grid-cols-[1fr] lg:grid-cols-[248px_1fr_340px]">
        <aside aria-label="Branches" className="hidden min-h-0 grid-rows-[auto_minmax(120px,40%)_auto_1fr] border-r border-line lg:grid">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <Label>Branches</Label>
            <span className="font-mono text-12 text-ink-3">{run.order.length}</span>
          </div>
          <div className="px-4">
            <BranchGraph />
          </div>
          <div className="mx-4 my-3 h-px bg-line" />
          <div className="min-h-0 overflow-y-auto px-2 pb-3">
            <BranchList />
          </div>
        </aside>

        <div className="relative min-h-0 p-4">
          <WorldCanvas className="h-full w-full" />
          <WorldHud />
          {freshId && (
            <div
              key={freshId}
              aria-hidden
              className="pointer-events-none absolute inset-4 animate-fork-flash rounded-md ring-1 ring-accent/70"
            />
          )}
          <NoticeToast />
        </div>

        <aside aria-label="Inspector" className="hidden border-l border-line p-4 lg:block">
          <Label>Inspector</Label>
        </aside>
      </div>

      <div className="border-t border-line bg-surface-1 px-4 pb-3 pt-2">
        <div className="flex items-center gap-4">
          <Transport />
          <Button icon="fork" onClick={() => fork()} title="Fork the world at the playhead (F)" aria-keyshortcuts="F">
            Fork at f{cursor}
            <Kbd>F</Kbd>
          </Button>
        </div>
        <div className="mt-1">
          <Timeline />
        </div>
        <textarea ref={directorRef} className="sr-only" aria-label="Director (coming soon)" />
        {helpOpen && <p className="text-12 text-ink-3">Shortcuts panel coming soon.</p>}
      </div>
    </section>
  );
}
