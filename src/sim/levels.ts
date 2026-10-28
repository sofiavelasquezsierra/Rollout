import { seedState } from "./rng";
import { SIM_VERSION, type Hazard, type Vec, type WorldObject, type WorldState } from "./types";

/**
 * Hand-authored 24×16 levels. Map legend:
 *   # wall   . floor   A agent start   G goal   o object
 * Hazards are rectangles defined separately because some of them drift.
 */
export interface LevelDef {
  id: string;
  name: string;
  blurb: string;
  seed: number;
  maxTicks: number;
  map: string[];
  hazards: Omit<Hazard, "id">[];
}

export const LEVELS: LevelDef[] = [
  {
    id: "crossing",
    name: "The Crossing",
    blurb: "Four parcels split by a caution band. One gap — and one segment of the band drifts.",
    seed: 7,
    maxTicks: 160,
    map: [
      "########################",
      "#A.....................#",
      "#......................#",
      "#...o..........o.......#",
      "#......................#",
      "#......#########.......#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......#########.......#",
      "#......................#",
      "#..o...............o...#",
      "#......................#",
      "#.....................G#",
      "########################",
    ],
    hazards: [
      { x: 1, y: 7, w: 9, h: 2, drift: null },
      { x: 13, y: 7, w: 8, h: 2, drift: { minX: 11, maxX: 15, every: 3 } },
    ],
  },
  {
    id: "rooms",
    name: "Six Rooms",
    blurb: "Doorways force detours. A moving caution zone patrols the east corridor.",
    seed: 21,
    maxTicks: 200,
    map: [
      "########################",
      "#A.....#.......#.......#",
      "#......#...o...#...o...#",
      "#......#.......#.......#",
      "#..............#.......#",
      "#......#...............#",
      "#......#.......#.......#",
      "####.#####.#######.#####",
      "#......#.......#.......#",
      "#..o...#.......#.......#",
      "#......#...........o...#",
      "#..............#.......#",
      "#......#.......#.......#",
      "#......#...o...#......G#",
      "#......#.......#.......#",
      "########################",
    ],
    hazards: [
      { x: 9, y: 9, w: 4, h: 2, drift: null },
      { x: 17, y: 3, w: 2, h: 3, drift: { minX: 16, maxX: 20, every: 2 } },
      { x: 2, y: 11, w: 3, h: 1, drift: null },
    ],
  },
  {
    id: "field",
    name: "Open Floor",
    blurb: "Five parcels in the open, pillars and scattered caution zones. Many paths, few clean ones.",
    seed: 1337,
    maxTicks: 220,
    map: [
      "########################",
      "#A.....................#",
      "#.........o............#",
      "#...##.........##......#",
      "#...##.........##...o..#",
      "#......................#",
      "#..o...................#",
      "#..........####........#",
      "#..........####........#",
      "#......................#",
      "#...................o..#",
      "#.....o................#",
      "#...##.........##......#",
      "#...##.........##......#",
      "#.....................G#",
      "########################",
    ],
    hazards: [
      { x: 6, y: 2, w: 3, h: 2, drift: null },
      { x: 16, y: 5, w: 4, h: 2, drift: { minX: 13, maxX: 19, every: 2 } },
      { x: 5, y: 8, w: 4, h: 2, drift: null },
      { x: 17, y: 11, w: 3, h: 2, drift: null },
      { x: 9, y: 12, w: 4, h: 2, drift: { minX: 7, maxX: 11, every: 3 } },
    ],
  },
];

export function getLevel(id: string): LevelDef {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level ${id}`);
  return level;
}

/** Build the tick-0 WorldState for a level. `seed` overrides the level's default. */
export function createWorld(levelId: string, seed?: number): WorldState {
  const def = getLevel(levelId);
  const s = seed ?? def.seed;
  let agent: Vec | null = null;
  let goal: Vec | null = null;
  const objects: WorldObject[] = [];
  const grid = def.map.map((row, y) =>
    [...row]
      .map((ch, x) => {
        if (ch === "A") agent = { x, y };
        else if (ch === "G") goal = { x, y };
        else if (ch === "o") objects.push({ id: `o${objects.length + 1}`, pos: { x, y }, collected: false });
        return ch === "#" ? "#" : ".";
      })
      .join(""),
  );
  if (!agent || !goal) throw new Error(`Level ${levelId} needs A and G`);

  return {
    version: SIM_VERSION,
    levelId,
    seed: s,
    rng: seedState(s),
    tick: 0,
    maxTicks: def.maxTicks,
    width: grid[0].length,
    height: grid.length,
    grid,
    agent: { pos: agent, facing: "E" },
    objects,
    hazards: def.hazards.map((h, i) => ({ ...h, id: `h${i + 1}` })),
    goal,
    violations: [],
    outcome: "running",
  };
}
