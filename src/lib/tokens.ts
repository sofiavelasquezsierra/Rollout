/**
 * Canvas/SVG access to the CSS design tokens in src/styles/tokens.css.
 * Values are read from the live stylesheet so tokens.css stays the single
 * source of truth; the fallbacks only matter before styles load (and in tests).
 */
const FALLBACK = {
  bg: "#0b0d10",
  surface1: "#101318",
  line: "#20262e",
  lineStrong: "#2d343e",
  ink: "#e7e9ec",
  ink2: "#a4abb5",
  ink3: "#868f9b",
  accent: "#e9b872",
  hazard: "#d9695f",
  ok: "#73b9a9",
  floor: "#0e1115",
  grid: "#171b21",
  wall: "#2a313b",
  object: "#8fb3e0",
  goal: "#73b9a9",
  branches: ["#e9b872", "#8fb3e0", "#b7a0dc", "#7fc4a8", "#dc9cb5", "#c9c27a"],
};

export type Palette = typeof FALLBACK;

let cached: Palette | null = null;

export function palette(): Palette {
  if (cached) return cached;
  if (typeof window === "undefined") return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  cached = {
    bg: v("--c-bg", FALLBACK.bg),
    surface1: v("--c-surface-1", FALLBACK.surface1),
    line: v("--c-line", FALLBACK.line),
    lineStrong: v("--c-line-strong", FALLBACK.lineStrong),
    ink: v("--c-ink", FALLBACK.ink),
    ink2: v("--c-ink-2", FALLBACK.ink2),
    ink3: v("--c-ink-3", FALLBACK.ink3),
    accent: v("--c-accent", FALLBACK.accent),
    hazard: v("--c-hazard", FALLBACK.hazard),
    ok: v("--c-ok", FALLBACK.ok),
    floor: v("--c-world-floor", FALLBACK.floor),
    grid: v("--c-world-grid", FALLBACK.grid),
    wall: v("--c-world-wall", FALLBACK.wall),
    object: v("--c-world-object", FALLBACK.object),
    goal: v("--c-world-goal", FALLBACK.goal),
    branches: FALLBACK.branches.map((fb, i) => v(`--c-branch-${i}`, fb)),
  };
  return cached;
}

/** CSS variable reference for a branch color (for DOM/SVG). */
export const branchVar = (i: number) => `var(--c-branch-${i % 6})`;

export function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
