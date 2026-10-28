"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { LEVELS } from "@/sim";
import { useRollout } from "@/store/useRollout";
import { Label } from "@/components/ui/primitives";
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
  const newRun = useRollout((s) => s.newRun);
  const run = useRollout((s) => s.run);
  const onLevel = useCallback((id: string) => newRun(id), [newRun]);

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
          onChange={(e) => e.target.value && onLevel(e.target.value)}
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

      <div className="grid min-h-0 grid-cols-[1fr] lg:grid-cols-[240px_1fr_340px]">
        <aside className="hidden border-r border-line p-4 lg:block">
          <Label>Branches</Label>
        </aside>
        <div className="relative min-h-0 p-4">
          <WorldCanvas className="h-full w-full" />
          <WorldHud />
        </div>
        <aside className="hidden border-l border-line p-4 lg:block">
          <Label>Inspector</Label>
        </aside>
      </div>

      <div className="border-t border-line bg-surface-1 px-4 pb-3 pt-2">
        <div className="flex items-center gap-4">
          <Transport />
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
