import { SIM_VERSION, type WorldState } from "./types";

/** Canonical JSON: object keys sorted so equal states produce identical strings. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]));
    }
    return v;
  });
}

export function serialize(state: WorldState): string {
  return canonicalJson(state);
}

export class DeserializeError extends Error {}

export function deserialize(json: string): WorldState {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new DeserializeError("Not valid JSON");
  }
  if (!isWorldState(raw)) throw new DeserializeError("Not a WorldState");
  if (raw.version !== SIM_VERSION) {
    throw new DeserializeError(`Unsupported sim version ${raw.version}`);
  }
  return raw;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec = (v: unknown): boolean =>
  !!v && typeof v === "object" && isNum((v as { x: unknown }).x) && isNum((v as { y: unknown }).y);

/** Structural guard. Strict enough to reject garbage from the network or storage. */
export function isWorldState(v: unknown): v is WorldState {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  const agent = s.agent as Record<string, unknown> | undefined;
  return (
    isNum(s.version) &&
    typeof s.levelId === "string" &&
    isNum(s.seed) &&
    isNum(s.rng) &&
    isNum(s.tick) &&
    isNum(s.maxTicks) &&
    isNum(s.width) &&
    isNum(s.height) &&
    Array.isArray(s.grid) &&
    s.grid.length === s.height &&
    s.grid.every((r) => typeof r === "string" && r.length === s.width) &&
    !!agent &&
    isVec(agent.pos) &&
    ["N", "S", "E", "W"].includes(agent.facing as string) &&
    Array.isArray(s.objects) &&
    s.objects.every((o) => o && typeof o.id === "string" && isVec(o.pos) && typeof o.collected === "boolean") &&
    Array.isArray(s.hazards) &&
    s.hazards.every((h) => h && typeof h.id === "string" && isNum(h.x) && isNum(h.y) && isNum(h.w) && isNum(h.h)) &&
    isVec(s.goal) &&
    Array.isArray(s.violations) &&
    ["running", "success", "partial", "timeout"].includes(s.outcome as string)
  );
}
