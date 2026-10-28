import { describe, expect, it } from "vitest";
import { IntentFilter, classify, type Landmark } from "../intent";

/**
 * Synthetic hands in image coordinates. The wrist sits at (0.5, 0.8); the
 * palm points up the image. Fingers are either extended (tip far from the
 * wrist) or curled (tip back near the knuckles).
 */
function hand(opts: { index?: [number, number]; ext?: [boolean, boolean, boolean]; thumbTip?: [number, number] }): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7 }));
  const set = (i: number, x: number, y: number) => (lm[i] = { x, y });
  set(0, 0.5, 0.8); // wrist
  set(9, 0.5, 0.6); // middle mcp → palm size 0.2
  set(5, 0.45, 0.62); // index mcp
  set(6, 0.45, 0.55); // index pip
  const [ix, iy] = opts.index ?? [0.45, 0.6]; // default: curled
  set(8, ix, iy);
  const [mExt, rExt, pExt] = opts.ext ?? [false, false, false];
  set(10, 0.5, 0.53);
  set(12, 0.5, mExt ? 0.38 : 0.6);
  set(14, 0.55, 0.55);
  set(16, 0.55, rExt ? 0.4 : 0.62);
  set(18, 0.6, 0.57);
  set(20, 0.6, pExt ? 0.43 : 0.64);
  const [tx, ty] = opts.thumbTip ?? [0.3, 0.7];
  set(4, tx, ty);
  return lm;
}

describe("classify", () => {
  it("returns no intent without a hand", () => {
    expect(classify(null).gesture).toBe("none");
    expect(classify([]).gesture).toBe("none");
  });

  it("reads a pointing index finger as a direction (selfie-mirrored)", () => {
    expect(classify(hand({ index: [0.45, 0.3] })).dir).toBe("N");
    // finger toward image-left = user's right in a mirrored view
    expect(classify(hand({ index: [0.15, 0.6] })).dir).toBe("E");
    expect(classify(hand({ index: [0.15, 0.6] }), false).dir).toBe("W");
  });

  it("detects a pinch, an open palm and a fist", () => {
    expect(classify(hand({ index: [0.45, 0.4], thumbTip: [0.46, 0.41] })).gesture).toBe("pinch");
    expect(classify(hand({ index: [0.45, 0.3], ext: [true, true, true] })).gesture).toBe("palm");
    expect(classify(hand({})).gesture).toBe("fist");
  });
});

describe("IntentFilter", () => {
  it("needs a few stable frames before an intent counts", () => {
    const f = new IntentFilter(3);
    const up = classify(hand({ index: [0.45, 0.3] }));
    expect(f.push(up, 0).intent.dir).toBeNull();
    expect(f.push(up, 16).intent.dir).toBeNull();
    expect(f.push(up, 33).intent.dir).toBe("N");
  });

  it("fires one fork per pinch, with a cooldown", () => {
    const f = new IntentFilter(2, 650, 1000);
    const pinch = classify(hand({ index: [0.45, 0.4], thumbTip: [0.46, 0.41] }));
    const open = classify(hand({}));
    const forks = (t0: number, frames: number, i = pinch) =>
      Array.from({ length: frames }, (_, k) => f.push(i, t0 + k * 16).events.filter((e) => e.type === "fork").length).reduce((a, b) => a + b, 0);
    expect(forks(0, 10)).toBe(1);
    forks(200, 4, open);
    expect(forks(300, 10)).toBe(0); // within cooldown
    forks(1500, 4, open);
    expect(forks(1600, 10)).toBe(1);
  });

  it("toggles playback after holding an open palm", () => {
    const f = new IntentFilter(2, 300);
    const palm = classify(hand({ index: [0.45, 0.3], ext: [true, true, true] }));
    const toggles: number[] = [];
    for (let t = 0; t <= 600; t += 20) if (f.push(palm, t).events.some((e) => e.type === "togglePlay")) toggles.push(t);
    expect(toggles).toHaveLength(1);
    expect(toggles[0]).toBeGreaterThanOrEqual(300);
  });
});
