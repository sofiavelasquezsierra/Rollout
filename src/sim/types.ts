/**
 * World model types. Everything here is plain JSON: a WorldState can be
 * serialized at any tick and resumed elsewhere with identical results.
 */

export const SIM_VERSION = 1;

export type Dir = "N" | "S" | "E" | "W";
/** Agent actions. Pickup is automatic when the agent enters an object's cell. */
export type Action = Dir | "WAIT";
export const ACTIONS: readonly Action[] = ["N", "S", "E", "W", "WAIT"];

export interface Vec {
  x: number;
  y: number;
}

export interface WorldObject {
  id: string;
  pos: Vec;
  collected: boolean;
}

/** A rectangular caution zone (hazard). If `drift` is set it moves horizontally on a seeded schedule. */
export interface Hazard {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  drift: { minX: number; maxX: number; every: number } | null;
}

export type ViolationKind = "hazard" | "wall";
export interface Violation {
  tick: number;
  kind: ViolationKind;
  pos: Vec;
}

export type Outcome = "running" | "success" | "partial" | "timeout";

export interface WorldState {
  version: number;
  levelId: string;
  seed: number;
  /** mulberry32 internal state — carried in the world so snapshots are self-contained. */
  rng: number;
  tick: number;
  maxTicks: number;
  width: number;
  height: number;
  /** Row strings, '#' = wall, '.' = floor. Static, but kept here for self-containment. */
  grid: string[];
  agent: { pos: Vec; facing: Dir };
  objects: WorldObject[];
  hazards: Hazard[];
  goal: Vec;
  violations: Violation[];
  outcome: Outcome;
}
