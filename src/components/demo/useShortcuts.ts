"use client";

import { useEffect } from "react";
import { headFrame } from "@/store/run";
import { useRollout } from "@/store/useRollout";

export interface ShortcutHandlers {
  focusDirector(): void;
  toggleHelp(): void;
  /** Fork, then let the UI animate / prompt for a name. */
  onFork?(id: string): void;
}

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Space"], label: "Play / pause" },
  { keys: ["←", "→"], label: "Step one frame" },
  { keys: ["⇧", "← / →"], label: "Step ten frames" },
  { keys: ["Home", "End"], label: "Jump to start / head" },
  { keys: ["F"], label: "Fork at the playhead" },
  { keys: ["R"], label: "Rename the active branch" },
  { keys: ["[", "]"], label: "Previous / next branch" },
  { keys: ["/"], label: "Focus the director input" },
  { keys: ["C"], label: "Compare branches" },
  { keys: ["?"], label: "Show shortcuts" },
];

export function useShortcuts(h: ShortcutHandlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      // Let focused buttons/links handle Space/Enter natively.
      const onControl = e.target instanceof HTMLElement && e.target.closest("button, a, [role=tab]");
      const s = useRollout.getState();
      const head = headFrame(s.run.branches[s.activeBranchId]);

      switch (e.key) {
        case " ":
          if (onControl) return;
          e.preventDefault();
          s.togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          s.stepBy(e.shiftKey ? -10 : -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          s.stepBy(e.shiftKey ? 10 : 1);
          break;
        case "Home":
          e.preventDefault();
          s.setPlaying(false);
          s.setCursor(0);
          break;
        case "End":
          e.preventDefault();
          s.setPlaying(false);
          s.setCursor(head);
          break;
        case "f":
        case "F": {
          e.preventDefault();
          const id = s.fork();
          h.onFork?.(id);
          break;
        }
        case "r":
        case "R":
          e.preventDefault();
          s.setRenaming(s.activeBranchId);
          break;
        case "[":
          s.cycleBranch(-1);
          break;
        case "]":
          s.cycleBranch(1);
          break;
        case "c":
        case "C":
          if (s.run.order.length >= 2) {
            const other = s.run.order.find((id) => id !== s.activeBranchId)!;
            s.setCompare(s.compare ? null : [s.activeBranchId, other]);
          }
          break;
        case "/":
          e.preventDefault();
          h.focusDirector();
          break;
        case "?":
          h.toggleHelp();
          break;
        case "Escape":
          if (s.compare) s.setCompare(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [h, enabled]);
}
