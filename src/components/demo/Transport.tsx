"use client";

import { headState } from "@/store/derive";
import { headFrame } from "@/store/run";
import { SPEEDS, useRollout } from "@/store/useRollout";
import { IconButton, Thinking } from "@/components/ui/primitives";

export function Transport() {
  const run = useRollout((s) => s.run);
  const activeId = useRollout((s) => s.activeBranchId);
  const cursor = useRollout((s) => s.cursor);
  const playing = useRollout((s) => s.playing);
  const speed = useRollout((s) => s.speed);
  const activity = useRollout((s) => s.activity);
  const { togglePlay, stepBy, setCursor, setPlaying, setSpeed } = useRollout.getState();

  const head = headFrame(run.branches[activeId]);
  const done = headState(run, activeId).outcome !== "running";
  const atHead = cursor >= head;
  const generating = playing && atHead && !done;
  const thinking = activity.branchId === activeId && (activity.status === "thinking" || activity.status === "streaming");

  return (
    <div className="flex items-center gap-1">
      <IconButton icon="toStart" label="Jump to start" shortcut="Home" onClick={() => (setPlaying(false), setCursor(0))} disabled={cursor === 0} />
      <IconButton icon="stepBack" label="Step back" shortcut="ArrowLeft" onClick={() => stepBy(-1)} disabled={cursor === 0} />
      <IconButton
        icon={playing ? "pause" : "play"}
        label={playing ? "Pause" : atHead && !done ? "Run agent" : "Play"}
        shortcut="Space"
        variant="accent"
        className="mx-0.5 size-9 rounded-full"
        onClick={togglePlay}
      />
      <IconButton icon="stepFwd" label="Step forward" shortcut="ArrowRight" onClick={() => stepBy(1)} disabled={atHead} />
      <IconButton icon="toEnd" label="Jump to head" shortcut="End" onClick={() => (setPlaying(false), setCursor(head))} disabled={atHead} />

      <div className="ml-2 flex min-w-[118px] flex-col leading-tight" aria-live="off">
        <span className="font-mono text-13 tabular text-ink">
          <span className="text-ink-3">f</span> {String(cursor).padStart(3, "0")}
          <span className="text-ink-3"> / {String(head).padStart(3, "0")}</span>
        </span>
        <span className="flex h-4 items-center gap-1.5 font-mono text-12 text-ink-3">
          {thinking ? (
            <>
              <Thinking className="text-accent" /> agent thinking
            </>
          ) : generating ? (
            <span className="text-accent">● live</span>
          ) : done && atHead ? (
            "episode ended"
          ) : playing ? (
            "replaying"
          ) : atHead ? (
            "at head"
          ) : (
            "scrubbing history"
          )}
        </span>
      </div>

      <div role="radiogroup" aria-label="Playback speed" className="ml-1 flex rounded-md border border-line p-0.5">
        {SPEEDS.map((sp) => (
          <button
            key={sp}
            type="button"
            role="radio"
            aria-checked={speed === sp}
            onClick={() => setSpeed(sp)}
            className={`h-6 rounded-sm px-1.5 font-mono text-12 tabular t-fast transition-colors ${
              speed === sp ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {sp}×
          </button>
        ))}
      </div>
    </div>
  );
}
