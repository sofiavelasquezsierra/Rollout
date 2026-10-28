import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  DeserializeError,
  LEVELS,
  ReplayCache,
  SNAPSHOT_EVERY,
  createWorld,
  deserialize,
  isWall,
  nextRandom,
  replay,
  routeHints,
  scriptedPolicy,
  serialize,
  step,
  stepMany,
  type Action,
  type WorldState,
} from "@/sim";

/** Test-only RNG so random action sequences are themselves reproducible. */
function randomActions(seed: number, n: number): Action[] {
  let r = seed >>> 0;
  const out: Action[] = [];
  for (let i = 0; i < n; i++) {
    let v: number;
    [v, r] = nextRandom(r);
    out.push(ACTIONS[Math.floor(v * ACTIONS.length)]);
  }
  return out;
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

/** A tiny custom world for precise step assertions. */
function tinyWorld(over: Partial<WorldState> = {}): WorldState {
  return {
    ...createWorld("crossing"),
    grid: ["#####", "#...#", "#...#", "#...#", "#####"],
    width: 5,
    height: 5,
    agent: { pos: { x: 1, y: 1 }, facing: "E" },
    objects: [{ id: "o1", pos: { x: 2, y: 1 }, collected: false }],
    hazards: [{ id: "h1", x: 1, y: 3, w: 1, h: 1, drift: null }],
    goal: { x: 3, y: 3 },
    maxTicks: 50,
    ...over,
  };
}

describe("rng", () => {
  it("is a pure function of its state", () => {
    expect(nextRandom(42)).toEqual(nextRandom(42));
    const [a, s1] = nextRandom(42);
    const [b] = nextRandom(s1);
    expect(a).not.toBe(b);
  });

  it("produces values in [0, 1)", () => {
    let s = 1;
    for (let i = 0; i < 5000; i++) {
      let v: number;
      [v, s] = nextRandom(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("levels", () => {
  it.each(LEVELS.map((l) => [l.id]))("%s is well formed and solvable", (id) => {
    const w = createWorld(id);
    expect(w.width).toBe(24);
    expect(w.height).toBe(16);
    expect(w.grid.every((r) => r.length === 24)).toBe(true);
    expect(isWall(w, w.agent.pos)).toBe(false);
    expect(isWall(w, w.goal)).toBe(false);
    for (const o of w.objects) expect(isWall(w, o.pos)).toBe(false);

    // Flood fill ignoring hazards: every object and the goal must be reachable.
    const seen = new Set<string>();
    const queue = [w.agent.pos];
    while (queue.length) {
      const p = queue.shift()!;
      const k = `${p.x},${p.y}`;
      if (seen.has(k) || isWall(w, p)) continue;
      seen.add(k);
      queue.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 });
    }
    for (const o of w.objects) expect(seen.has(`${o.pos.x},${o.pos.y}`)).toBe(true);
    expect(seen.has(`${w.goal.x},${w.goal.y}`)).toBe(true);
  });
});

describe("step", () => {
  it("does not mutate its input", () => {
    const s = deepFreeze(createWorld("rooms"));
    expect(() => stepMany(s, randomActions(3, 60))).not.toThrow();
  });

  it("moves the agent and advances the tick", () => {
    const s = step(tinyWorld({ objects: [] }), "S");
    expect(s.agent.pos).toEqual({ x: 1, y: 2 });
    expect(s.agent.facing).toBe("S");
    expect(s.tick).toBe(1);
  });

  it("WAIT keeps position and facing", () => {
    const s = step(tinyWorld(), "WAIT");
    expect(s.agent).toEqual({ pos: { x: 1, y: 1 }, facing: "E" });
    expect(s.tick).toBe(1);
  });

  it("blocks walls and records a wall violation", () => {
    const s = step(tinyWorld(), "N");
    expect(s.agent.pos).toEqual({ x: 1, y: 1 });
    expect(s.agent.facing).toBe("N");
    expect(s.violations).toEqual([{ tick: 1, kind: "wall", pos: { x: 1, y: 0 } }]);
  });

  it("auto-collects objects", () => {
    const s = step(tinyWorld(), "E");
    expect(s.objects[0].collected).toBe(true);
  });

  it("records hazard contact", () => {
    const s = stepMany(tinyWorld(), ["S", "S"]);
    expect(s.violations).toEqual([{ tick: 2, kind: "hazard", pos: { x: 1, y: 3 } }]);
  });

  it("ends with success only when all objects are collected", () => {
    const partial = stepMany(tinyWorld(), ["S", "S", "E", "E"]);
    expect(partial.outcome).toBe("partial");
    const success = stepMany(tinyWorld(), ["E", "S", "S", "E"]);
    expect(success.outcome).toBe("success");
  });

  it("is a no-op once the episode is over", () => {
    const done = stepMany(tinyWorld(), ["E", "S", "S", "E"]);
    expect(step(done, "W")).toBe(done);
  });

  it("times out at maxTicks", () => {
    const s = stepMany(tinyWorld({ maxTicks: 3 }), ["WAIT", "WAIT", "WAIT"]);
    expect(s.outcome).toBe("timeout");
    expect(s.tick).toBe(3);
  });

  it("drifts hazards on schedule within bounds using the seeded RNG", () => {
    let s = createWorld("crossing");
    const drifting = s.hazards.find((h) => h.drift)!;
    const xs = new Set<number>();
    for (let i = 0; i < 90; i++) {
      const before = s;
      s = step(s, "WAIT");
      const h = s.hazards.find((x) => x.id === drifting.id)!;
      xs.add(h.x);
      expect(h.x).toBeGreaterThanOrEqual(drifting.drift!.minX);
      expect(h.x).toBeLessThanOrEqual(drifting.drift!.maxX);
      if (s.tick % drifting.drift!.every !== 0) {
        expect(h.x).toBe(before.hazards.find((x) => x.id === drifting.id)!.x);
        expect(s.rng).toBe(before.rng);
      }
    }
    expect(xs.size).toBeGreaterThan(1);
  });

  it("is deterministic per seed and diverges across seeds", () => {
    const acts = Array<Action>(120).fill("WAIT");
    const a = stepMany(createWorld("field", 1), acts);
    const b = stepMany(createWorld("field", 1), acts);
    const c = stepMany(createWorld("field", 2), acts);
    expect(serialize(a)).toBe(serialize(b));
    expect(serialize(a)).not.toBe(serialize(c));
  });
});

describe("serialize / deserialize", () => {
  it("round-trips any reachable state", () => {
    for (const level of LEVELS) {
      const s = stepMany(createWorld(level.id), randomActions(11, 75));
      const back = deserialize(serialize(s));
      expect(back).toEqual(s);
      expect(serialize(back)).toBe(serialize(s));
    }
  });

  it("is canonical regardless of key order", () => {
    const s = createWorld("rooms");
    const reordered = Object.fromEntries(Object.entries(s).reverse()) as WorldState;
    expect(serialize(reordered)).toBe(serialize(s));
  });

  it("rejects malformed input", () => {
    expect(() => deserialize("{not json")).toThrow(DeserializeError);
    expect(() => deserialize(JSON.stringify({ hello: 1 }))).toThrow(DeserializeError);
    const bad = { ...createWorld("rooms"), version: 99 };
    expect(() => deserialize(JSON.stringify(bad))).toThrow(/version/);
  });
});

describe("replay equivalence", () => {
  const cases = LEVELS.flatMap((l) => [1, 2, 3, 4, 5].map((k) => [l.id, k] as const));

  it.each(cases)("%s / sequence %i: resuming from frame N equals a full replay", (levelId, k) => {
    const initial = createWorld(levelId);
    const actions = randomActions(k * 7919, 150);
    const full = replay(initial, actions);

    for (const n of [0, 1, 15, 16, 17, 63, 100, 149, 150]) {
      const atN = replay(initial, actions, n);
      // resume in-memory
      expect(replay(atN, actions.slice(n))).toEqual(full);
      // resume across a serialization boundary (this is what forking relies on)
      expect(replay(deserialize(serialize(atN)), actions.slice(n))).toEqual(full);
    }
  });

  it("ReplayCache matches naive replay at every frame, including after appends", () => {
    const initial = createWorld("field");
    const cache = new ReplayCache(initial);
    let actions = randomActions(99, 70);
    for (let f = 0; f <= actions.length; f += 3) {
      expect(cache.stateAt(actions, f)).toEqual(replay(initial, actions, f));
    }
    actions = [...actions, ...randomActions(100, 40)];
    for (let f = actions.length; f >= 0; f -= 5) {
      expect(cache.stateAt(actions, f)).toEqual(replay(initial, actions, f));
    }
    // A non-extension (different history) resets correctly.
    const other = randomActions(5, 50);
    expect(cache.stateAt(other, 50)).toEqual(replay(initial, other, 50));
    expect(SNAPSHOT_EVERY).toBe(16);
  });
});

describe("scripted policy", () => {
  function run(levelId: string, instructions: string[] = []) {
    let s = createWorld(levelId);
    let calls = 0;
    while (s.outcome === "running" && calls < 100) {
      const d = scriptedPolicy(s, instructions);
      expect(d.actions.length).toBeGreaterThan(0);
      expect(d.actions.length).toBeLessThanOrEqual(5);
      expect(d.reasoning.length).toBeGreaterThan(0);
      s = stepMany(s, d.actions);
      calls++;
    }
    return s;
  }

  it.each(LEVELS.map((l) => [l.id]))("solves %s", (id) => {
    expect(run(id).outcome).toBe("success");
  });

  it.each(LEVELS.map((l) => [l.id]))("'avoid the red zone' reduces hazard violations on %s", (id) => {
    const hz = (s: WorldState) => s.violations.filter((v) => v.kind === "hazard").length;
    const greedy = run(id);
    const careful = run(id, ["avoid the red zone"]);
    expect(careful.outcome).toBe("success");
    expect(hz(careful)).toBeLessThanOrEqual(hz(greedy));
  });

  it.each(LEVELS.map((l) => [l.id]))("'farthest first' still solves %s (no target flip-flopping)", (id) => {
    expect(run(id, ["collect the farthest crystal first"]).outcome).toBe("success");
  });

  it("'head straight for the goal' ends partial", () => {
    expect(run("crossing", ["head straight for the goal"]).outcome).toBe("partial");
  });

  it("is deterministic", () => {
    const s = createWorld("rooms");
    expect(scriptedPolicy(s, ["avoid red"])).toEqual(scriptedPolicy(s, ["avoid red"]));
  });
});

describe("routeHints", () => {
  it.each(LEVELS.map((l) => l.id))("gives wall-free routes that reach every target on %s", (id) => {
    const s0 = createWorld(id);
    for (const h of routeHints(s0)) {
      for (const r of [h.direct, h.careful]) {
        if (!r) continue;
        const end = stepMany(s0, r.moves);
        expect(end.violations.filter((v) => v.kind === "wall")).toEqual([]);
        if (h.target === "the dock") expect(end.agent.pos).toEqual(s0.goal);
        else expect(end.objects.find((o) => `parcel ${o.id}` === h.target)?.collected).toBe(true);
      }
    }
  });
});
