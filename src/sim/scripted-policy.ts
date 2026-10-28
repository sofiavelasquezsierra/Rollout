import { DELTAS, hazardAt, inHazard, isWall, manhattan, sameVec } from "./geometry";
import { step } from "./step";
import type { Action, Dir, Vec, WorldState } from "./types";

/**
 * Deterministic fallback agent. Used when no API key is configured, when the
 * live agent is rate limited or fails, and to record the bundled examples.
 * It understands a small vocabulary of director instructions via keywords.
 */

export interface Directives {
  avoidHazards: boolean;
  order: "nearest" | "farthest";
  region: "north" | "south" | "east" | "west" | null;
  goalNow: boolean;
}

export interface PolicyDecision {
  actions: Action[];
  reasoning: string;
}

export function parseDirectives(instructions: readonly string[]): Directives {
  const d: Directives = { avoidHazards: false, order: "nearest", region: null, goalNow: false };
  for (const raw of instructions) {
    const t = raw.toLowerCase();
    if (/\b(ignore|don'?t care about|through) (the )?(red|hazard|caution|zone)/.test(t)) d.avoidHazards = false;
    else if (/avoid|stay (out|away|clear)|red|hazard|caution|cones?\b|danger|careful|no violations|safe/.test(t)) d.avoidHazards = true;
    if (/farthest|furthest/.test(t)) d.order = "farthest";
    else if (/nearest|closest/.test(t)) d.order = "nearest";
    if (/\b(bottom|south|lower)\b/.test(t)) d.region = "south";
    else if (/\b(top|north|upper)\b/.test(t)) d.region = "north";
    else if (/\b(left|west)\b/.test(t)) d.region = "west";
    else if (/\b(right|east)\b/.test(t)) d.region = "east";
    if (/(go|head|straight|run|beeline|return|drive).{0,20}(goal|exit|dock|charg)|finish now|skip/.test(t)) d.goalNow = true;
    else if (/(collect|get|grab|pick|deliver)/.test(t)) d.goalNow = false;
  }
  return d;
}

const DIRS: Dir[] = ["N", "E", "S", "W"];
const HAZARD_PENALTY = 40;
const DRIFT_PENALTY = 6;

/** Cell cost of entering p. Infinity for walls. */
function cellCost(s: WorldState, p: Vec, avoid: boolean): number {
  if (isWall(s, p)) return Infinity;
  if (!avoid) return 1;
  if (hazardAt(s, p)) return 1 + HAZARD_PENALTY;
  // Swept area of drifting hazards: lightly discouraged.
  for (const h of s.hazards) {
    if (h.drift && p.y >= h.y && p.y < h.y + h.h && p.x >= h.drift.minX && p.x < h.drift.maxX + h.w) {
      return 1 + DRIFT_PENALTY;
    }
  }
  return 1;
}

interface Field {
  dist: Float64Array;
  prev: Int32Array;
}

/** Dijkstra from `from` over the whole grid (384 cells — a simple O(V²) scan is plenty). */
function dijkstra(s: WorldState, from: Vec, avoid: boolean): Field {
  const n = s.width * s.height;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[from.y * s.width + from.x] = 0;
  for (;;) {
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!done[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u < 0) break;
    done[u] = 1;
    const ux = u % s.width;
    const uy = (u - ux) / s.width;
    for (const dir of DIRS) {
      const p = { x: ux + DELTAS[dir].x, y: uy + DELTAS[dir].y };
      const c = cellCost(s, p, avoid);
      if (c === Infinity) continue;
      const v = p.y * s.width + p.x;
      if (dist[u] + c < dist[v]) {
        dist[v] = dist[u] + c;
        prev[v] = u;
      }
    }
  }
  return { dist, prev };
}

function pathTo(s: WorldState, f: Field, to: Vec): Vec[] {
  const out: Vec[] = [];
  let v = to.y * s.width + to.x;
  if (f.dist[v] === Infinity) return out;
  while (f.prev[v] !== -1) {
    out.push({ x: v % s.width, y: Math.floor(v / s.width) });
    v = f.prev[v];
  }
  return out.reverse();
}

export interface RouteHint {
  /** "parcel o1" or "the dock". */
  target: string;
  /** Shortest wall-free route; `null` when unreachable. */
  direct: { moves: Dir[]; zoneTicks: number } | null;
  /** Route that stays out of caution zones where it can; omitted when it equals `direct`. */
  careful?: { moves: Dir[]; zoneTicks: number };
}

/**
 * Wall-free routes from the agent to every remaining target — what the Claude
 * agent gets as "planner" help, so it reasons about which target and how much
 * risk, not about reading an ASCII map cell by cell.
 */
export function routeHints(s: WorldState): RouteHint[] {
  const fast = dijkstra(s, s.agent.pos, false);
  const safe = dijkstra(s, s.agent.pos, true);
  const route = (f: Field, to: Vec) => {
    const path = pathTo(s, f, to);
    if (path.length === 0 && !sameVec(s.agent.pos, to)) return null;
    const moves: Dir[] = [];
    let at = s.agent.pos;
    for (const p of path) {
      moves.push(dirBetween(at, p));
      at = p;
    }
    return { moves, zoneTicks: path.filter((p) => hazardAt(s, p)).length };
  };
  const targets: Target[] = [
    ...s.objects.filter((o) => !o.collected).map((o) => ({ label: `parcel ${o.id}`, pos: o.pos })),
    { label: "the dock", pos: s.goal },
  ];
  return targets.map((t) => {
    const direct = route(fast, t.pos);
    const careful = route(safe, t.pos);
    const same = !careful || (direct && careful.moves.join("") === direct.moves.join(""));
    return same ? { target: t.label, direct } : { target: t.label, direct, careful: careful! };
  });
}

function dirBetween(a: Vec, b: Vec): Dir {
  if (b.x > a.x) return "E";
  if (b.x < a.x) return "W";
  return b.y > a.y ? "S" : "N";
}

interface Target {
  label: string;
  pos: Vec;
}

function chooseTarget(s: WorldState, d: Directives, f: Field): Target {
  const remaining = s.objects.filter((o) => !o.collected);
  if (d.goalNow || remaining.length === 0) return { label: "the dock", pos: s.goal };
  const reachable = remaining.filter((o) => f.dist[o.pos.y * s.width + o.pos.x] < Infinity);
  if (reachable.length === 0) return { label: "the dock", pos: s.goal };

  let pool = reachable;
  if (d.region) {
    const key = (o: (typeof pool)[number]) =>
      d.region === "south" ? -o.pos.y : d.region === "north" ? o.pos.y : d.region === "east" ? -o.pos.x : o.pos.x;
    const bestKey = Math.min(...pool.map(key));
    // keep objects within 3 cells of the extreme in that direction
    pool = pool.filter((o) => key(o) <= bestKey + 3);
  }
  // "Nearest" is by path cost from the agent. "Farthest" is measured from the exit,
  // not the agent: a stateless policy re-plans every step, and a target defined
  // relative to the agent would flip back and forth as it moves.
  const cost = (o: (typeof pool)[number]) =>
    d.order === "farthest" ? -manhattan(o.pos, s.goal) : f.dist[o.pos.y * s.width + o.pos.x];
  const pick = [...pool].sort((a, b) => cost(a) - cost(b) || a.id.localeCompare(b.id))[0];
  return { label: `parcel ${pick.id}`, pos: pick.pos };
}

function compass(from: Vec, to: Vec): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const ns = dy < -1 ? "north" : dy > 1 ? "south" : "";
  const ew = dx < -1 ? "west" : dx > 1 ? "east" : "";
  return ns && ew ? `${ns}-${ew}` : ns || ew || "adjacent";
}

export function scriptedPolicy(
  state: WorldState,
  instructions: readonly string[] = [],
  horizon = 4,
): PolicyDecision {
  if (state.outcome !== "running") return { actions: [], reasoning: "Episode is over." };
  const d = parseDirectives(instructions);

  const actions: Action[] = [];
  let s = state;
  let reasoning = "";
  for (let i = 0; i < horizon && s.outcome === "running"; i++) {
    const field = dijkstra(s, s.agent.pos, d.avoidHazards);
    const target = chooseTarget(s, d, field);
    const path = pathTo(s, field, target.pos);
    const action: Action = path.length ? dirBetween(s.agent.pos, path[0]) : "WAIT";

    if (i === 0) reasoning = explain(s, d, target, path);
    actions.push(action);
    s = step(s, action);
  }
  return { actions, reasoning };
}

function explain(s: WorldState, d: Directives, target: Target, path: Vec[]): string {
  const parts: string[] = [];
  const left = s.objects.filter((o) => !o.collected).length;
  if (!path.length) return `No path to ${target.label}; holding position.`;
  const where = compass(s.agent.pos, target.pos);
  const why =
    target.label === "the dock"
      ? left === 0
        ? "All parcels collected"
        : `Director asked to return to the dock (${left} parcel${left === 1 ? "" : "s"} left behind)`
      : d.region
        ? `Prioritising the ${d.region} side as instructed`
        : d.order === "farthest"
          ? "Farthest parcel from the dock first, as instructed"
          : "Nearest remaining parcel";
  parts.push(`${why}: ${target.label}, ${path.length} step${path.length === 1 ? "" : "s"} ${where}.`);

  const crossed = new Set(
    path.flatMap((p) => s.hazards.filter((h) => inHazard(h, p)).map((h) => h.id)),
  );
  if (crossed.size) {
    parts.push(
      d.avoidHazards
        ? `No clean route — must cross caution zone ${[...crossed].join(", ")}.`
        : `Shortest route crosses caution zone ${[...crossed].join(", ")}; accepting the violation.`,
    );
  } else if (d.avoidHazards) {
    parts.push("Routing around caution zones per director instruction.");
  }
  return parts.join(" ");
}
