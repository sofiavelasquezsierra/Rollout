import type { Dir } from "@/sim";

/**
 * Hand landmarks → control intent. Pure and camera-free so it can be unit
 * tested; the MediaPipe wiring lives in components/demo/HandControl.tsx.
 *
 * This is a stand-in for an sEMG wristband: the interface consumes the same
 * low-bandwidth signal (a direction, a pinch, an open palm) that a wrist
 * decoder would produce, so the UI could swap input sources later.
 */

export interface Landmark {
  x: number; // 0..1, image space (not mirrored)
  y: number; // 0..1, image space, down is +
  z?: number;
}

export type Gesture = "point" | "pinch" | "palm" | "fist" | "none";

export interface Intent {
  gesture: Gesture;
  dir: Dir | null;
  /** Thumb–index distance relative to palm size: 0 = touching. */
  pinch: number;
  /** 0..1, how decisive the classification is. */
  confidence: number;
}

// MediaPipe hand landmark indices
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX = { mcp: 5, pip: 6, tip: 8 };
const MIDDLE = { mcp: 9, pip: 10, tip: 12 };
const RING = { pip: 14, tip: 16 };
const PINKY = { pip: 18, tip: 20 };

const PINCH_ON = 0.32;
const POINT_MIN = 0.55;

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

export const NO_INTENT: Intent = { gesture: "none", dir: null, pinch: 1, confidence: 0 };

/** Classify one frame. `mirrored`: the user sees a selfie view, so screen-right = image-left. */
export function classify(lm: readonly Landmark[] | null | undefined, mirrored = true): Intent {
  if (!lm || lm.length < 21) return NO_INTENT;
  const palm = dist(lm[WRIST], lm[MIDDLE.mcp]) || 1e-6;
  const extended = (tip: number, pip: number) => dist(lm[WRIST], lm[tip]) > dist(lm[WRIST], lm[pip]) * 1.12;

  const idx = extended(INDEX.tip, INDEX.pip);
  const mid = extended(MIDDLE.tip, MIDDLE.pip);
  const ring = extended(RING.tip, RING.pip);
  const pinky = extended(PINKY.tip, PINKY.pip);
  const pinch = Math.min(1, dist(lm[THUMB_TIP], lm[INDEX.tip]) / palm);

  if (pinch < PINCH_ON) {
    return { gesture: "pinch", dir: null, pinch, confidence: clamp01(1 - pinch / PINCH_ON) };
  }
  if (idx && mid && ring && pinky) {
    return { gesture: "palm", dir: null, pinch, confidence: 0.8 };
  }
  if (idx && !mid && !ring) {
    let vx = lm[INDEX.tip].x - lm[INDEX.mcp].x;
    const vy = lm[INDEX.tip].y - lm[INDEX.mcp].y;
    if (mirrored) vx = -vx;
    const mag = Math.hypot(vx, vy) / palm;
    if (mag >= POINT_MIN) {
      const horizontal = Math.abs(vx) > Math.abs(vy);
      const dir: Dir = horizontal ? (vx > 0 ? "E" : "W") : vy > 0 ? "S" : "N";
      // Decisive when one axis clearly dominates.
      const dominance = Math.abs(Math.abs(vx) - Math.abs(vy)) / (Math.abs(vx) + Math.abs(vy) + 1e-6);
      return { gesture: "point", dir, pinch, confidence: clamp01(dominance * 1.4) };
    }
  }
  if (!idx && !mid && !ring && !pinky) return { gesture: "fist", dir: null, pinch, confidence: 0.7 };
  return { ...NO_INTENT, pinch };
}

export type HandEvent = { type: "fork" } | { type: "togglePlay" };

/**
 * Temporal filter: an intent must hold for `stableFrames` before it counts,
 * pinches fire once per pinch (with a cooldown), and an open palm must be
 * held for `palmHoldMs` to toggle playback.
 */
export class IntentFilter {
  private candidate: Intent = NO_INTENT;
  private count = 0;
  private stable: Intent = NO_INTENT;
  private lastForkAt = -Infinity;
  private palmSince: number | null = null;
  private palmFired = false;

  constructor(
    private readonly stableFrames = 3,
    private readonly palmHoldMs = 650,
    private readonly forkCooldownMs = 1200,
  ) {}

  push(raw: Intent, now: number): { intent: Intent; events: HandEvent[] } {
    const events: HandEvent[] = [];
    const same = raw.gesture === this.candidate.gesture && raw.dir === this.candidate.dir;
    this.candidate = raw;
    this.count = same ? this.count + 1 : 1;
    if (this.count >= this.stableFrames && (raw.gesture !== "point" || raw.confidence > 0.25)) {
      const prev = this.stable.gesture;
      this.stable = raw;
      if (raw.gesture === "pinch" && prev !== "pinch" && now - this.lastForkAt > this.forkCooldownMs) {
        this.lastForkAt = now;
        events.push({ type: "fork" });
      }
    } else if (this.count >= this.stableFrames * 3) {
      this.stable = { ...raw, gesture: "none", dir: null };
    }

    if (this.stable.gesture === "palm") {
      this.palmSince ??= now;
      if (!this.palmFired && now - this.palmSince >= this.palmHoldMs) {
        this.palmFired = true;
        events.push({ type: "togglePlay" });
      }
    } else {
      this.palmSince = null;
      this.palmFired = false;
    }
    return { intent: this.stable, events };
  }

  /** Progress 0..1 of the palm hold, for UI feedback. */
  palmProgress(now: number): number {
    if (this.palmSince === null || this.palmFired) return 0;
    return clamp01((now - this.palmSince) / this.palmHoldMs);
  }
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export const HAND_FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_HAND === "1";
