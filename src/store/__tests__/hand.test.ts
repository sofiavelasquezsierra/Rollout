import { describe, expect, it } from "vitest";
import { useRollout } from "../useRollout";

describe("hand steering in the playback loop", () => {
  it("drives the agent at the head and logs one decision per direction change", () => {
    const s = useRollout.getState();
    s.newRun("crossing", "scripted");
    s.setHand({ active: true, dir: "E" });
    s.setPlaying(true);
    for (let i = 0; i < 3; i++) useRollout.getState().tick();
    useRollout.getState().setHand({ dir: "S" });
    for (let i = 0; i < 2; i++) useRollout.getState().tick();

    const { run, cursor } = useRollout.getState();
    const b = run.branches.b0;
    expect(b.actions).toEqual(["E", "E", "E", "S", "S"]);
    expect(cursor).toBe(5);
    const decisions = b.events.filter((e) => e.kind === "decision");
    expect(decisions.map((d) => (d.kind === "decision" ? [d.source, d.actions[0], d.frame] : null))).toEqual([
      ["hand", "E", 0],
      ["hand", "S", 3],
    ]);

    useRollout.getState().setHand({ active: false });
    expect(useRollout.getState().hand).toEqual({ active: false, dir: null });
  });
});
