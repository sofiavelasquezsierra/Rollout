import { step } from "./step";
import type { Action, WorldState } from "./types";

/** State after applying actions[0..frame) to `initial`. Frame 0 is `initial`. */
export function replay(initial: WorldState, actions: readonly Action[], frame = actions.length): WorldState {
  let s = initial;
  const end = Math.min(frame, actions.length);
  for (let i = 0; i < end; i++) s = step(s, actions[i]);
  return s;
}

export const SNAPSHOT_EVERY = 16;

/**
 * Memoized replay for one append-only action list. Keeps a snapshot every
 * SNAPSHOT_EVERY frames so scrubbing to any frame costs at most 16 steps.
 * Appending actions keeps existing snapshots valid; if the caller passes a
 * list that is not an extension of the last one, the cache resets.
 */
export class ReplayCache {
  private snapshots: WorldState[];
  private actions: readonly Action[] = [];

  constructor(private readonly initial: WorldState) {
    this.snapshots = [initial];
  }

  stateAt(actions: readonly Action[], frame: number): WorldState {
    this.sync(actions);
    const f = Math.max(0, Math.min(frame, actions.length));
    const k = Math.min(Math.floor(f / SNAPSHOT_EVERY), this.snapshots.length - 1);
    let s = this.snapshots[k];
    for (let i = k * SNAPSHOT_EVERY; i < f; i++) {
      s = step(s, actions[i]);
      if ((i + 1) % SNAPSHOT_EVERY === 0 && this.snapshots.length === (i + 1) / SNAPSHOT_EVERY) {
        this.snapshots.push(s);
      }
    }
    return s;
  }

  private sync(actions: readonly Action[]) {
    const prev = this.actions;
    const isExtension =
      actions.length >= prev.length && prev.every((a, i) => actions[i] === a);
    if (!isExtension) this.snapshots = [this.initial];
    else {
      // drop snapshots beyond the (possibly shorter) known prefix — none for pure extension
      const maxK = Math.floor(actions.length / SNAPSHOT_EVERY);
      if (this.snapshots.length > maxK + 1) this.snapshots.length = maxK + 1;
    }
    this.actions = actions;
  }
}
