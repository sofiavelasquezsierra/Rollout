import type { Action, Hazard, Vec, WorldState } from "./types";

export const DELTAS: Record<Action, Vec> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
  WAIT: { x: 0, y: 0 },
};

export function isWall(state: Pick<WorldState, "grid" | "width" | "height">, p: Vec): boolean {
  if (p.x < 0 || p.y < 0 || p.x >= state.width || p.y >= state.height) return true;
  return state.grid[p.y][p.x] === "#";
}

export function inHazard(h: Hazard, p: Vec): boolean {
  return p.x >= h.x && p.x < h.x + h.w && p.y >= h.y && p.y < h.y + h.h;
}

export function hazardAt(state: Pick<WorldState, "hazards">, p: Vec): Hazard | undefined {
  return state.hazards.find((h) => inHazard(h, p));
}

export const sameVec = (a: Vec, b: Vec) => a.x === b.x && a.y === b.y;
export const manhattan = (a: Vec, b: Vec) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
