"use client";

import { useEffect } from "react";
import { BASE_FRAME_MS, useRollout } from "@/store/useRollout";

/** Drives the store's tick() at the current playback speed while playing. */
export function usePlaybackLoop() {
  const playing = useRollout((s) => s.playing);
  const speed = useRollout((s) => s.speed);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => useRollout.getState().tick(), BASE_FRAME_MS / speed);
    return () => window.clearInterval(id);
  }, [playing, speed]);

  // Pause when the tab is hidden so a live run doesn't keep calling the API.
  useEffect(() => {
    const onVis = () => document.hidden && useRollout.getState().setPlaying(false);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
}
