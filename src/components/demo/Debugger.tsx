"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { HAND_FEATURE_ENABLED } from "@/hand/intent";
import { EXAMPLES } from "@/examples";
import { prefersReducedMotion } from "@/lib/tokens";
import { LEVELS } from "@/sim";
import { useRollout } from "@/store/useRollout";
import { Badge, Button, IconButton, Kbd, Label } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Walkthrough } from "@/components/site/Walkthrough";
import { AgentModeToggle } from "./AgentModeToggle";
import { BranchGraph } from "./BranchGraph";
import { BranchList } from "./BranchList";
import { CompareView } from "./CompareView";
import { Director } from "./Director";
import { Inspector } from "./Inspector";
import { NoticeToast } from "./NoticeToast";
import { ShortcutSheet } from "./ShortcutSheet";
import { Timeline } from "./Timeline";
import { Transport } from "./Transport";
import { WorldCanvas } from "./world/WorldCanvas";
import { WorldHud } from "./WorldHud";
import { usePlaybackLoop } from "./usePlaybackLoop";
import { useShortcuts } from "./useShortcuts";

// Phase 2 — only bundled into a chunk that loads when the flag is on and the panel opens.
const HandControl = dynamic(() => import("./HandControl").then((m) => m.HandControl), { ssr: false });

export function Debugger() {
  usePlaybackLoop();
  const [handOpen, setHandOpen] = useState(false);
  const directorRef = useRef<HTMLTextAreaElement>(null);
  const dialog = useRollout((s) => s.dialog);
  const setDialog = useRollout((s) => s.setDialog);
  const compare = useRollout((s) => s.compare);
  const handlers = useMemo(
    () => ({
      focusDirector: () => directorRef.current?.focus(),
      toggleHelp: () => {
        const { dialog: d, setDialog: set } = useRollout.getState();
        set(d === "shortcuts" ? null : "shortcuts");
      },
    }),
    [],
  );
  useShortcuts(handlers, !compare && !dialog);

  const run = useRollout((s) => s.run);
  const cursor = useRollout((s) => s.cursor);
  const freshId = useRollout((s) => s.freshBranchId);
  const live = useRollout((s) => s.live);
  const evaluating = useRollout((s) => s.evaluating);
  const activeBranchId = useRollout((s) => s.activeBranchId);
  const { newRun, loadExample, fork, fetchStatus, setPlaying, setCompare, evaluateAll } = useRollout.getState();

  useEffect(() => {
    void fetchStatus();
    // First visit: replay the focused example branch so the page is alive within a second.
    if (prefersReducedMotion()) return;
    const t = window.setTimeout(() => {
      const s = useRollout.getState();
      if (s.run.origin === "example" && !s.playing && s.cursor === s.run.focus?.cursor) {
        s.setSpeed(2);
        s.setPlaying(true);
      }
    }, 700);
    return () => window.clearTimeout(t);
  }, [fetchStatus]);

  const openCompare = () => {
    const other = run.order.find((id) => id !== activeBranchId);
    if (other) setCompare([activeBranchId, other]);
  };
  const runLive = () => {
    newRun(run.levelId, "claude");
    setPlaying(true);
  };
  const scoring = Object.keys(evaluating).length > 0;

  const branchesPanel = (
    <>
      <div className="flex items-center gap-2 px-4 pb-2 pt-3">
        <Label>Branches</Label>
        <span className="font-mono text-12 text-ink-3">{run.order.length}</span>
        <div className="ml-auto flex gap-1">
          <IconButton icon="scale" label={scoring ? "Scoring branches…" : "Score all branches"} onClick={() => void evaluateAll()} disabled={scoring} className="size-7" />
          <IconButton icon="compare" label="Compare two branches" shortcut="C" onClick={openCompare} disabled={run.order.length < 2} className="size-7" />
        </div>
      </div>
      <div className="h-[min(260px,32vh)] shrink-0 px-4">
        <BranchGraph />
      </div>
      <div className="mx-4 my-3 h-px shrink-0 bg-line" />
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {run.order.length === 1 && run.branches[run.order[0]].actions.length === 0 ? (
          <p className="px-2 text-12 leading-relaxed text-ink-3">
            One branch so far. Press <Kbd>Space</Kbd> to run the agent, then <Kbd>F</Kbd> at any frame to fork the world
            and explore a “what if”.
          </p>
        ) : (
          <BranchList />
        )}
      </div>
    </>
  );

  return (
    <section aria-label="Rollout debugger" className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] border-t border-line bg-bg">
      {/* Run header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2">
        <div className="flex min-w-[min(100%,320px)] flex-1 items-center gap-3">
          <Label>Run</Label>
          <span className="truncate text-13 text-ink" title={run.description}>
            {run.title}
          </span>
          {run.origin === "example" ? (
            <Badge>
              recorded · {run.recordedWith === "claude" ? "Claude agent" : run.recordedWith === "mixed" ? "Claude + fallback" : "scripted policy"}
            </Badge>
          ) : (
            <Badge tone="accent">session</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label className="hidden xl:inline">Agent</Label>
          <AgentModeToggle />
        </div>
        {HAND_FEATURE_ENABLED && (
          <Button
            size="sm"
            variant={handOpen ? "solid" : "quiet"}
            icon="hand"
            onClick={() => setHandOpen((v) => !v)}
            aria-pressed={handOpen}
            title="Hand control (prototype): a stand-in for sEMG wristband input"
          >
            Hand <span className="font-mono text-[10px] text-ink-3">beta</span>
          </Button>
        )}
        <Button
          variant="accent"
          size="sm"
          icon="spark"
          onClick={runLive}
          disabled={!live?.available}
          title={live?.available ? "Start a fresh rollout on this level with the live Claude agent" : "Live agent unavailable: this deployment has no API key"}
        >
          Run live
        </Button>
        <select
          aria-label="Load an example or start a new run"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("ex:")) loadExample(v.slice(3));
            else if (v.startsWith("lv:")) newRun(v.slice(3));
          }}
          className="h-7 max-w-48 rounded-md border border-line bg-surface-2 px-2 text-12 text-ink-2"
        >
          <option value="">Runs…</option>
          <optgroup label="Recorded examples">
            {EXAMPLES.map((r) => (
              <option key={r.id} value={`ex:${r.id}`}>
                {r.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="New blank run">
            {LEVELS.map((l) => (
              <option key={l.id} value={`lv:${l.id}`}>
                {l.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Body */}
      <div
        className="relative grid min-h-0 grid-cols-[1fr] md:grid-cols-[1fr_300px] lg:grid-cols-[248px_1fr_340px]"
        onKeyDown={(e) => e.key === "Escape" && compare && setCompare(null)}
      >
        {compare && <CompareView />}
        <aside aria-label="Branches" className="hidden min-h-0 flex-col border-r border-line lg:flex">
          {branchesPanel}
        </aside>

        <div className="relative min-h-0 p-4">
          <WorldCanvas className="h-full w-full" />
          <WorldHud />
          {freshId && (
            <div key={freshId} aria-hidden className="pointer-events-none absolute inset-4 animate-fork-flash rounded-md ring-1 ring-accent/70" />
          )}
          {HAND_FEATURE_ENABLED && handOpen && <HandControl onClose={() => setHandOpen(false)} />}
          <NoticeToast />
        </div>

        <aside aria-label="Inspector" className="hidden min-h-0 border-l border-line md:block">
          <div className="hidden h-full lg:block">
            <Inspector />
          </div>
          <TabletPanel branches={branchesPanel} />
        </aside>
      </div>

      {/* Controls */}
      <div id="playback" tabIndex={-1} aria-label="Playback controls" role="group" className="border-t border-line bg-surface-1 px-4 pb-3 pt-2 outline-none">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <Transport />
          <Button icon="fork" onClick={() => fork()} title="Fork the world at the playhead (F)" aria-keyshortcuts="F" className="mt-0.5">
            Fork at f{cursor}
            <Kbd>F</Kbd>
          </Button>
          <Director ref={directorRef} />
        </div>
        <div className="mt-1">
          <Timeline />
        </div>
      </div>

      <Modal open={dialog === "shortcuts"} onClose={() => setDialog(null)} title="Keyboard shortcuts">
        <ShortcutSheet />
      </Modal>
      <Modal open={dialog === "how"} onClose={() => setDialog(null)} title="How this works" wide>
        <HowItWorks />
      </Modal>
      <Modal open={dialog === "walkthrough"} onClose={() => setDialog(null)} title="60-second walkthrough" wide>
        <Walkthrough />
      </Modal>
    </section>
  );
}

/** 768–1023px: one side panel that switches between branches and the inspector. */
function TabletPanel({ branches }: { branches: React.ReactNode }) {
  const [view, setView] = useState<"branches" | "inspector">("inspector");
  return (
    <div className="flex h-full min-h-0 flex-col lg:hidden">
      <div role="radiogroup" aria-label="Side panel" className="m-2 flex rounded-md border border-line p-0.5">
        {(["inspector", "branches"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={view === v}
            onClick={() => setView(v)}
            className={`h-6 flex-1 rounded-sm text-12 capitalize ${view === v ? "bg-surface-3 text-ink" : "text-ink-3"}`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{view === "inspector" ? <Inspector /> : branches}</div>
    </div>
  );
}
