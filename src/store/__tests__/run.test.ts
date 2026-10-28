import { describe, expect, it } from "vitest";
import { EXAMPLES } from "@/examples";
import { scriptedPolicy } from "@/sim";
import { headState, lineageActions, stateAt } from "../derive";
import { activeInstructions, addEvent, appendAction, createRun, forkBranch, headFrame, lineageEvents } from "../run";
import type { DecisionEvent } from "../types";

describe("run event log", () => {
  it("forks share history up to the fork frame and diverge after", () => {
    let run = createRun({ id: "t", levelId: "crossing", seed: 7, title: "t", origin: "session" });
    for (const a of ["E", "E", "S", "S", "E"] as const) run = appendAction(run, "b0", a);
    const { run: r2, branchId } = forkBranch(run, "b0", 3, "alt");
    let r = appendAction(r2, branchId, "W");
    expect(lineageActions(r, branchId)).toEqual(["E", "E", "S", "W"]);
    expect(stateAt(r, branchId, 3)).toEqual(stateAt(r, "b0", 3));
    expect(stateAt(r, branchId, 4)).not.toEqual(stateAt(r, "b0", 4));
    // forking from a frame inside an ancestor attaches to that ancestor
    r = forkBranch(r, branchId, 1, "deep").run;
    expect(r.branches.b2.parentId).toBe("b0");
  });

  it("director events before a fork are inherited; parent's later ones are not", () => {
    let run = createRun({ id: "t2", levelId: "rooms", seed: 21, title: "t", origin: "session" });
    run = addEvent(run, "b0", { kind: "director", id: "d1", frame: 0, text: "avoid red" });
    for (let i = 0; i < 4; i++) run = appendAction(run, "b0", "WAIT");
    run = addEvent(run, "b0", { kind: "director", id: "d2", frame: 4, text: "go to goal" });
    const { run: r, branchId } = forkBranch(run, "b0", 2);
    expect(activeInstructions(r, branchId)).toEqual(["avoid red"]);
    expect(activeInstructions(r, "b0")).toEqual(["avoid red", "go to goal"]);
  });
});

describe.each(EXAMPLES.map((e) => [e.id, e] as const))("bundled example %s", (_id, run) => {
  it("is internally consistent", () => {
    for (const id of run.order) {
      const b = run.branches[id];
      expect(b.plan).toEqual([]);
      expect(b.evaluation?.atFrame).toBe(headFrame(b));
      expect(headState(run, id).outcome).not.toBe("running");
    }
    expect(run.focus && run.branches[run.focus.branchId]).toBeTruthy();
  });

  it("replays: every scripted decision matches the current simulator + policy", () => {
    if (run.recordedWith !== "scripted") return;
    for (const id of run.order) {
      const own = run.branches[id].events.filter((e): e is DecisionEvent => e.kind === "decision");
      for (const d of own) {
        const s = stateAt(run, id, d.frame);
        const instr = lineageEvents(run, id)
          .filter((e) => e.kind === "director" && e.frame <= d.frame)
          .map((e) => (e.kind === "director" ? e.text : ""));
        expect(scriptedPolicy(s, instr).actions).toEqual(d.actions);
      }
    }
  });
});
