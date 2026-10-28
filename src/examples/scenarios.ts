/**
 * The bundled example runs, described as scripts. `scripts/record-examples.ts`
 * plays each script through the headless driver and writes the resulting
 * event log to src/examples/<id>.json. Frames are global (from tick 0).
 */
export type ScenarioStep =
  | { op: "run"; branch: string; until?: number }
  | { op: "direct"; branch: string; text: string }
  | { op: "fork"; from: string; frame: number; as: string; name: string };

export interface Scenario {
  id: string;
  title: string;
  description: string;
  levelId: string;
  /** Branch to show first, and where to put the playhead. */
  focus: { branch: string; cursor: "start" | "fork" | "head" };
  steps: ScenarioStep[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: "crossing-three-ways",
    title: "The Crossing — three ways across",
    description:
      "The greedy policy cuts through the caution band. Forked at f8 with “avoid the caution zones”, and at f20 with “head straight for the dock”.",
    levelId: "crossing",
    focus: { branch: "careful", cursor: "fork" },
    steps: [
      { op: "run", branch: "main" },
      { op: "fork", from: "main", frame: 8, as: "careful", name: "careful-route" },
      { op: "direct", branch: "careful", text: "Avoid the caution zones — no violations." },
      { op: "run", branch: "careful" },
      { op: "fork", from: "main", frame: 20, as: "beeline", name: "beeline" },
      { op: "direct", branch: "beeline", text: "Forget the parcels, head straight for the dock." },
      { op: "run", branch: "beeline" },
    ],
  },
  {
    id: "rooms-redirect",
    title: "Six Rooms — a mid-run redirect",
    description:
      "Directed mid-rollout to take the bottom parcels first; a sibling branch from the same frame is told to stay out of the caution zones instead.",
    levelId: "rooms",
    focus: { branch: "main", cursor: "start" },
    steps: [
      { op: "run", branch: "main", until: 24 },
      { op: "fork", from: "main", frame: 24, as: "safe", name: "stay-safe" },
      { op: "direct", branch: "main", text: "Collect the bottom parcels first." },
      { op: "run", branch: "main" },
      { op: "direct", branch: "safe", text: "Stay out of the caution zones." },
      { op: "run", branch: "safe" },
    ],
  },
  {
    id: "field-orderings",
    title: "Open Floor — orderings compared",
    description:
      "Nearest-first versus farthest-first from tick 0, plus a late fork that switches on hazard avoidance.",
    levelId: "field",
    focus: { branch: "main", cursor: "head" },
    steps: [
      { op: "run", branch: "main" },
      { op: "fork", from: "main", frame: 0, as: "far", name: "farthest-first" },
      { op: "direct", branch: "far", text: "Collect the farthest parcel first." },
      { op: "run", branch: "far" },
      { op: "fork", from: "main", frame: 16, as: "late", name: "late-caution" },
      { op: "direct", branch: "late", text: "Careful — avoid the caution zones from here." },
      { op: "run", branch: "late" },
    ],
  },
];
