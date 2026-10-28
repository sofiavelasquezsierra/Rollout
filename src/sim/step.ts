import { DELTAS, hazardAt, isWall, sameVec } from "./geometry";
import { nextRandom } from "./rng";
import type { Action, Dir, Hazard, Outcome, Violation, WorldState } from "./types";

/**
 * Advance the world by one tick. Pure: never mutates `state`, never reads
 * the clock or Math.random. Order of resolution:
 *   1. move (walls block and count as a violation)
 *   2. auto-pickup
 *   3. hazards drift (seeded)
 *   4. hazard contact (violation)
 *   5. goal / timeout
 * A finished world (outcome !== "running") is returned unchanged.
 */
export function step(state: WorldState, action: Action): WorldState {
  if (state.outcome !== "running") return state;

  const tick = state.tick + 1;
  const violations: Violation[] = [];

  // 1. Move
  const d = DELTAS[action];
  const target = { x: state.agent.pos.x + d.x, y: state.agent.pos.y + d.y };
  const facing: Dir = action === "WAIT" ? state.agent.facing : action;
  let pos = state.agent.pos;
  if (action !== "WAIT") {
    if (isWall(state, target)) {
      violations.push({ tick, kind: "wall", pos: target });
    } else {
      pos = target;
    }
  }

  // 2. Pickup
  let objects = state.objects;
  if (objects.some((o) => !o.collected && sameVec(o.pos, pos))) {
    objects = objects.map((o) =>
      !o.collected && sameVec(o.pos, pos) ? { ...o, collected: true } : o,
    );
  }

  // 3. Drift
  let rng = state.rng;
  let hazards: Hazard[] = state.hazards;
  if (hazards.some((h) => h.drift && tick % h.drift.every === 0)) {
    hazards = hazards.map((h) => {
      if (!h.drift || tick % h.drift.every !== 0) return h;
      let r: number;
      [r, rng] = nextRandom(rng);
      const dir = r < 0.5 ? -1 : 1;
      let x = h.x + dir;
      if (x < h.drift.minX || x > h.drift.maxX) x = h.x - dir; // bounce
      return { ...h, x };
    });
  }

  // 4. Hazard contact
  if (hazardAt({ hazards }, pos)) violations.push({ tick, kind: "hazard", pos });

  // 5. Outcome
  let outcome: Outcome = state.outcome;
  if (sameVec(pos, state.goal)) {
    outcome = objects.every((o) => o.collected) ? "success" : "partial";
  } else if (tick >= state.maxTicks) {
    outcome = "timeout";
  }

  return {
    ...state,
    rng,
    tick,
    agent: { pos, facing },
    objects,
    hazards,
    violations: violations.length ? [...state.violations, ...violations] : state.violations,
    outcome,
  };
}

export function stepMany(state: WorldState, actions: readonly Action[]): WorldState {
  let s = state;
  for (const a of actions) s = step(s, a);
  return s;
}
