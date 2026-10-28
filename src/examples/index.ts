import type { Run } from "@/store/types";
import crossing from "./crossing-three-ways.json";
import field from "./field-orderings.json";
import rooms from "./rooms-redirect.json";

/**
 * Bundled example runs — recorded event logs, regenerated with
 * `npm run record:examples`. They ship in the client bundle (~45 KB total),
 * so a first-time visitor sees a populated run with zero network calls.
 */
export const EXAMPLES: Run[] = [crossing, rooms, field] as unknown as Run[];

export function getExample(id: string): Run | undefined {
  return EXAMPLES.find((r) => r.id === id);
}
