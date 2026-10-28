import type { Vec, WorldState } from "@/sim";
import { withAlpha, type Palette } from "@/lib/tokens";

export interface GhostPath {
  colorIndex: number;
  points: Vec[];
  /** Index in `points` where the ghost diverges from the active branch. */
  forkIndex: number;
}

export interface DrawOptions {
  /** Agent position to draw (may be fractional during tweening). */
  agentPos: Vec;
  trail: Vec[];
  trailColor: string;
  ghosts: GhostPath[];
  /** Seconds since mount, for gentle ambient motion (0 when reduced motion). */
  time: number;
  /** Violations that happened on the displayed frame. */
  flash: WorldState["violations"];
  /** 0..1 fade for the violation flash. */
  flashAlpha: number;
}

export interface Layout {
  cell: number;
  ox: number;
  oy: number;
  width: number;
  height: number;
}

export function computeLayout(cssW: number, cssH: number, world: Pick<WorldState, "width" | "height">): Layout {
  const cell = Math.max(8, Math.floor(Math.min(cssW / world.width, cssH / world.height)));
  const width = cell * world.width;
  const height = cell * world.height;
  return { cell, width, height, ox: Math.floor((cssW - width) / 2), oy: Math.floor((cssH - height) / 2) };
}

export function drawWorld(ctx: CanvasRenderingContext2D, s: WorldState, L: Layout, P: Palette, o: DrawOptions) {
  const { cell: c, ox, oy } = L;
  const cx = (x: number) => ox + x * c + c / 2;
  const cy = (y: number) => oy + y * c + c / 2;

  // Floor + dot grid
  ctx.fillStyle = P.floor;
  ctx.fillRect(ox, oy, L.width, L.height);
  ctx.fillStyle = P.grid;
  const dot = Math.max(1, Math.round(c / 18));
  for (let y = 1; y < s.height; y++) {
    for (let x = 1; x < s.width; x++) ctx.fillRect(ox + x * c - dot / 2, oy + y * c - dot / 2, dot, dot);
  }

  // Walls: flat blocks with a hairline top highlight for a little depth.
  for (let y = 0; y < s.height; y++) {
    const row = s.grid[y];
    for (let x = 0; x < s.width; x++) {
      if (row[x] !== "#") continue;
      const boundary = x === 0 || y === 0 || x === s.width - 1 || y === s.height - 1;
      ctx.fillStyle = boundary ? P.surface1 : P.wall;
      ctx.fillRect(ox + x * c, oy + y * c, c, c);
      if (!boundary && y > 0 && s.grid[y - 1][x] !== "#") {
        ctx.fillStyle = withAlpha(P.ink, 0.08);
        ctx.fillRect(ox + x * c, oy + y * c, c, 1);
      }
    }
  }

  // Drift ranges (where a moving red zone can be)
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = withAlpha(P.hazard, 0.35);
  for (const h of s.hazards) {
    if (!h.drift) continue;
    const x0 = ox + h.drift.minX * c + 0.5;
    const w = (h.drift.maxX - h.drift.minX + h.w) * c - 1;
    ctx.strokeRect(x0, oy + h.y * c + 0.5, w, h.h * c - 1);
  }
  ctx.restore();

  // Hazards: soft fill + diagonal hatch + hairline border
  for (const h of s.hazards) {
    const x = ox + h.x * c;
    const y = oy + h.y * c;
    const w = h.w * c;
    const hh = h.h * c;
    ctx.fillStyle = withAlpha(P.hazard, 0.14);
    ctx.fillRect(x, y, w, hh);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, hh);
    ctx.clip();
    ctx.strokeStyle = withAlpha(P.hazard, 0.32);
    ctx.lineWidth = 1;
    const gap = Math.max(5, c / 4);
    const shift = (o.time * 6) % gap;
    ctx.beginPath();
    for (let k = -hh; k < w + hh; k += gap) {
      ctx.moveTo(x + k + shift, y + hh);
      ctx.lineTo(x + k + hh + shift, y);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = withAlpha(P.hazard, 0.7);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
  }

  // Goal: nested squares, slow breathing
  {
    const pulse = 0.5 + 0.5 * Math.sin(o.time * 2);
    const gx = ox + s.goal.x * c;
    const gy = oy + s.goal.y * c;
    const inset = c * (0.14 + 0.04 * pulse);
    ctx.strokeStyle = withAlpha(P.goal, 0.55 + 0.35 * pulse);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(gx + inset, gy + inset, c - inset * 2, c - inset * 2);
    ctx.fillStyle = withAlpha(P.goal, 0.8);
    const k = c * 0.36;
    ctx.fillRect(gx + k, gy + k, c - 2 * k, c - 2 * k);
  }

  // Objects: diamonds; collected ones leave a faint outline
  for (const ob of s.objects) {
    const x = cx(ob.pos.x);
    const y = cy(ob.pos.y);
    const r = c * 0.26;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    if (ob.collected) {
      ctx.strokeStyle = withAlpha(P.object, 0.22);
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.save();
      ctx.shadowColor = withAlpha(P.object, 0.6);
      ctx.shadowBlur = c * 0.4;
      ctx.fillStyle = P.object;
      ctx.fill();
      ctx.restore();
    }
  }

  // Ghost paths of other branches
  for (const g of o.ghosts) {
    if (g.points.length < 2) continue;
    const color = P.branches[g.colorIndex % P.branches.length];
    ctx.save();
    ctx.strokeStyle = withAlpha(color, 0.42);
    ctx.lineWidth = Math.max(1.25, c * 0.06);
    ctx.setLineDash([c * 0.18, c * 0.16]);
    ctx.lineJoin = "round";
    ctx.beginPath();
    const start = Math.max(0, g.forkIndex);
    g.points.slice(start).forEach((p, i) => (i ? ctx.lineTo(cx(p.x), cy(p.y)) : ctx.moveTo(cx(p.x), cy(p.y))));
    ctx.stroke();
    ctx.restore();
    const end = g.points[g.points.length - 1];
    ctx.fillStyle = withAlpha(color, 0.6);
    ctx.beginPath();
    ctx.arc(cx(end.x), cy(end.y), c * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Active trail: fades toward the past
  if (o.trail.length > 1) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1.5, c * 0.09);
    for (let i = 1; i < o.trail.length; i++) {
      const a = o.trail[i - 1];
      const b = o.trail[i];
      ctx.strokeStyle = withAlpha(o.trailColor, 0.06 + 0.5 * (i / o.trail.length));
      ctx.beginPath();
      ctx.moveTo(cx(a.x), cy(a.y));
      ctx.lineTo(cx(b.x), cy(b.y));
      ctx.stroke();
    }
    ctx.restore();
  }

  // Violation flash
  if (o.flashAlpha > 0) {
    for (const v of o.flash) {
      ctx.strokeStyle = withAlpha(P.hazard, o.flashAlpha);
      ctx.lineWidth = 2;
      if (v.kind === "wall") {
        const x = cx(v.pos.x);
        const y = cy(v.pos.y);
        const r = c * 0.2;
        ctx.beginPath();
        ctx.moveTo(x - r, y - r);
        ctx.lineTo(x + r, y + r);
        ctx.moveTo(x + r, y - r);
        ctx.lineTo(x - r, y + r);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(cx(o.agentPos.x), cy(o.agentPos.y), c * (0.5 + 0.25 * (1 - o.flashAlpha)), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Agent: accent disc, halo, facing notch
  {
    const x = cx(o.agentPos.x);
    const y = cy(o.agentPos.y);
    const r = c * 0.3;
    ctx.fillStyle = withAlpha(P.accent, 0.12);
    ctx.beginPath();
    ctx.arc(x, y, r * 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.accent;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    const ang = { N: -Math.PI / 2, S: Math.PI / 2, E: 0, W: Math.PI }[s.agent.facing];
    ctx.fillStyle = P.bg;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ang) * r * 0.75, y + Math.sin(ang) * r * 0.75);
    ctx.lineTo(x + Math.cos(ang + 2.4) * r * 0.35, y + Math.sin(ang + 2.4) * r * 0.35);
    ctx.lineTo(x + Math.cos(ang - 2.4) * r * 0.35, y + Math.sin(ang - 2.4) * r * 0.35);
    ctx.closePath();
    ctx.fill();
  }
}
