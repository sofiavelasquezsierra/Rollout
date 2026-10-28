"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EXAMPLES } from "@/examples";
import { HAND_FEATURE_ENABLED } from "@/hand/intent";
import { prefersReducedMotion } from "@/lib/tokens";
import { LEVELS } from "@/sim";
import { headState } from "@/store/derive";
import { headFrame } from "@/store/run";
import { SPEEDS, useRollout } from "@/store/useRollout";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Kbd, Thinking } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Walkthrough } from "@/components/site/Walkthrough";
import { AgentModeToggle } from "@/components/demo/AgentModeToggle";
import { Inspector } from "@/components/demo/Inspector";
import { NoticeToast } from "@/components/demo/NoticeToast";
import { ShortcutSheet } from "@/components/demo/ShortcutSheet";
import { usePlaybackLoop } from "@/components/demo/usePlaybackLoop";
import { useShortcuts } from "@/components/demo/useShortcuts";
import { HeroLine, ScoreCards, ThoughtBubble, WorldTags } from "./Overlays";
import { Prompt } from "./Prompt";
import { Stage } from "./Stage";
import { TimeArc } from "./TimeArc";

const HandControl = dynamic(() => import("@/components/demo/HandControl").then((m) => m.HandControl), { ssr: false });

/**
 * The immersive demo: parallel worlds floating in space, with a minimal
 * glass HUD. Everything a first-time visitor needs is on the dock — play,
 * the time arc, "split world", and a single prompt to talk to the agent.
 */
export function Immersive() {
  usePlaybackLoop();
  const promptRef = useRef<HTMLInputElement>(null);
  const [handOpen, setHandOpen] = useState(false);
  // The agent's thought bubble waits until the opening headline has faded, so they never overlap.
  const [heroGone, setHeroGone] = useState(false);
  const hideHero = useCallback(() => setHeroGone(true), []);
  const dialog = useRollout((s) => s.dialog);
  const setDialog = useRollout((s) => s.setDialog);
  const detailsOpen = useRollout((s) => s.detailsOpen);
  const handlers = useMemo(
    () => ({
      focusDirector: () => promptRef.current?.focus(),
      toggleHelp: () => {
        const s = useRollout.getState();
        s.setDialog(s.dialog === "shortcuts" ? null : "shortcuts");
      },
    }),
    [],
  );
  useShortcuts(handlers, !dialog);

  const fetchStatus = useRollout((s) => s.fetchStatus);
  useEffect(() => {
    void fetchStatus();
    if (prefersReducedMotion()) return;
    // First visit: the example comes alive on its own within a second.
    const t = window.setTimeout(() => {
      const s = useRollout.getState();
      if (s.run.origin === "example" && !s.playing && s.cursor === s.run.focus?.cursor) {
        s.setSpeed(2);
        s.setPlaying(true);
      }
    }, 900);
    return () => window.clearTimeout(t);
  }, [fetchStatus]);

  return (
    <div className="relative h-dvh min-h-[600px] w-full overflow-hidden bg-space">
      <Stage>
        <WorldTags />
        <ThoughtBubble hidden={!heroGone} />
        <ScoreCards />
      </Stage>

      <HeroLine gone={heroGone} onGone={hideHero} onWalkthrough={() => setDialog("walkthrough")} onHow={() => setDialog("how")} />
      <TopCluster onHand={() => setHandOpen((v) => !v)} handOpen={handOpen} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-3 md:pb-5">
        <Dock promptRef={promptRef} />
      </div>

      <DetailsDrawer open={detailsOpen} />
      {HAND_FEATURE_ENABLED && handOpen && (
        <div className="absolute bottom-48 left-4 z-30 w-[min(440px,calc(100%-32px))] [&>section]:static">
          <HandControl onClose={() => setHandOpen(false)} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-16 z-30">
        <div className="relative h-24">
          <NoticeToast />
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
    </div>
  );
}

function Dock({ promptRef }: { promptRef: React.RefObject<HTMLInputElement | null> }) {
  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const cursor = useRollout((s) => s.cursor);
  const playing = useRollout((s) => s.playing);
  const speed = useRollout((s) => s.speed);
  const view = useRollout((s) => s.view);
  const detailsOpen = useRollout((s) => s.detailsOpen);
  const activity = useRollout((s) => s.activity);
  const { togglePlay, stepBy, fork, setView, setDetailsOpen, setSpeed, evaluateAll } = useRollout.getState();
  const head = headFrame(run.branches[activeId]);
  const done = headState(run, activeId).outcome !== "running";
  const atHead = cursor >= head;
  const thinking = activity.branchId === activeId && (activity.status === "thinking" || activity.status === "streaming");

  const status = thinking ? (
    <span className="flex items-center gap-1.5 text-accent">
      <Thinking /> agent thinking
    </span>
  ) : playing && atHead && !done ? (
    <span className="text-accent">● live</span>
  ) : done && atHead ? (
    "episode ended"
  ) : playing ? (
    "replaying"
  ) : atHead ? (
    "press play to continue"
  ) : (
    "in the past"
  );

  return (
    <section aria-label="Controls" id="playback" tabIndex={-1} className="glass pointer-events-auto w-full max-w-[920px] rounded-[28px] p-3 outline-none md:p-4">
      <Prompt ref={promptRef} />
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 md:flex-nowrap">
        <div className="flex items-center gap-1">
          <DockIcon icon="stepBack" label="Step back" kbd="←" onClick={() => stepBy(-1)} disabled={cursor === 0} />
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : atHead && !done ? "Play — the agent continues" : "Play"}
            title={playing ? "Pause (Space)" : "Play (Space)"}
            className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[0_0_30px_var(--c-glow)] t-fast transition-transform hover:scale-105 active:scale-95"
          >
            <Icon name={playing ? "pause" : "play"} size={18} />
          </button>
          <DockIcon icon="stepFwd" label="Step forward" kbd="→" onClick={() => stepBy(1)} disabled={atHead} />
        </div>

        <div className="order-last w-full min-w-0 md:order-none md:flex-1">
          <div className="flex items-baseline justify-between px-2.5 font-mono text-[11px] text-ink-3">
            <span>
              <span className="text-13 text-ink tabular">f{String(cursor).padStart(3, "0")}</span> / {head}
            </span>
            <span>{status}</span>
            <button type="button" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])} className="rounded px-1 hover:text-ink" aria-label={`Playback speed ${speed}×, click to change`}>
              {speed}×
            </button>
          </div>
          <TimeArc />
        </div>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <button
            type="button"
            onClick={() => fork()}
            title="Split the world at this moment (F)"
            aria-keyshortcuts="F"
            className="group inline-flex h-10 items-center gap-2 rounded-full border border-accent/50 bg-accent-soft px-4 text-13 text-accent t-fast transition-[background-color,box-shadow] hover:shadow-[0_0_26px_var(--c-glow)]"
          >
            <Icon name="fork" />
            Split world
            <Kbd className="border-accent/30 bg-transparent text-accent/80">F</Kbd>
          </button>
          <DockIcon
            icon="compare"
            label={view === "overview" ? "Back to one world" : "See all worlds side by side"}
            kbd="O"
            active={view === "overview"}
            onClick={() => {
              const next = view === "overview" ? "focus" : "overview";
              setView(next);
              if (next === "overview") void evaluateAll();
            }}
          />
          <DockIcon icon="info" label="Details" kbd="I" active={detailsOpen} onClick={() => setDetailsOpen(!detailsOpen)} />
        </div>
      </div>
    </section>
  );
}

function DockIcon({ icon, label, kbd, onClick, disabled, active }: { icon: IconName; label: string; kbd?: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={kbd ? `${label} (${kbd})` : label}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-10 items-center justify-center rounded-full t-fast transition-colors disabled:opacity-30 ${
        active ? "bg-white/10 text-ink" : "text-ink-2 hover:bg-white/[0.07] hover:text-ink"
      }`}
    >
      <Icon name={icon} />
    </button>
  );
}

function TopCluster({ onHand, handOpen }: { onHand: () => void; handOpen: boolean }) {
  const run = useRollout((s) => s.run);
  const live = useRollout((s) => s.live);
  const { loadExample, newRun, setPlaying } = useRollout.getState();
  return (
    <div className="absolute left-3 top-[68px] z-20 flex flex-wrap items-center gap-2 md:left-5">
      <div className="glass flex items-center gap-2 rounded-full py-1 pl-1 pr-3">
        <select
          aria-label="Load an example or start a new world"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("ex:")) loadExample(v.slice(3));
            else if (v.startsWith("lv:")) newRun(v.slice(3));
          }}
          className="h-7 max-w-60 truncate rounded-full border border-[var(--c-glass-line)] bg-transparent px-2.5 text-12 text-ink"
        >
          <option value="">{run.title}</option>
          <optgroup label="Recorded examples">
            {EXAMPLES.map((r) => (
              <option key={r.id} value={`ex:${r.id}`}>
                {r.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="New empty world">
            {LEVELS.map((l) => (
              <option key={l.id} value={`lv:${l.id}`}>
                {l.name}
              </option>
            ))}
          </optgroup>
        </select>
        <span className="hidden font-mono text-[11px] text-ink-3 sm:inline" title={run.description}>
          {run.origin === "example" ? `recorded · ${run.recordedWith === "claude" ? "Claude" : "scripted"}` : "live session"}
        </span>
      </div>
      <div className="glass flex items-center gap-1 rounded-full p-1">
        <AgentModeToggle />
        <button
          type="button"
          disabled={!live?.available}
          onClick={() => {
            newRun(run.levelId, "claude");
            setPlaying(true);
          }}
          title={live?.available ? "Fresh world with the live Claude agent" : "Live agent unavailable: this deployment has no API key"}
          className="h-7 rounded-full bg-accent px-3 text-12 font-medium text-accent-ink disabled:opacity-35"
        >
          Run live
        </button>
        {HAND_FEATURE_ENABLED && (
          <button
            type="button"
            onClick={onHand}
            aria-pressed={handOpen}
            title="Hand control: a stand-in for sEMG wristband input"
            className={`flex h-7 items-center gap-1 rounded-full px-2.5 text-12 ${handOpen ? "bg-white/10 text-ink" : "text-ink-2 hover:text-ink"}`}
          >
            <Icon name="hand" size={14} /> Hand
          </button>
        )}
      </div>
    </div>
  );
}

function DetailsDrawer({ open }: { open: boolean }) {
  const setOpen = useRollout((s) => s.setDetailsOpen);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  return (
    <aside
      ref={ref}
      tabIndex={-1}
      aria-label="Details"
      aria-hidden={!open}
      inert={!open}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      className={`glass-strong absolute bottom-3 right-3 top-28 z-30 flex w-[min(380px,calc(100%-24px))] flex-col overflow-hidden rounded-3xl outline-none t-slow transition-[transform,opacity] md:right-5 ${
        open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[110%] opacity-0"
      }`}
    >
      <div className="flex items-center justify-between border-b border-[var(--c-glass-line)] px-4 py-2.5">
        <span className="text-13 text-ink">Under the hood</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close details" className="rounded-full p-1.5 text-ink-3 hover:bg-white/10 hover:text-ink">
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1">{open && <Inspector />}</div>
    </aside>
  );
}
