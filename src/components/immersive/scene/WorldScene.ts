import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Vec, WorldState } from "@/sim";
import type { Palette } from "@/lib/tokens";

/**
 * "Parallel worlds": every branch is a floating diorama of the same level,
 * laid out side by side in space and shown at the same frame. The camera
 * flies to the active world (focus) or pulls back to see all of them
 * (overview). Purely a view: it receives derived state each frame and never
 * touches the simulation.
 */

export const SPACING = 33; // world units between parallel worlds

export interface WorldInput {
  id: string;
  colorIndex: number;
  slot: number;
  /** Where a new world grows from (its parent's slot) on first appearance. */
  spawnSlot: number | null;
  state: WorldState;
  trail: Vec[];
  active: boolean;
  /** Playhead is before this branch's fork point: it's still identical to its parent. */
  latent: boolean;
}

export interface SceneInput {
  worlds: WorldInput[];
  mode: "focus" | "overview";
  activeId: string;
  reducedMotion: boolean;
}

const tmp = new THREE.Vector3();

export class WorldScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 600);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private views = new Map<string, WorldView>();
  private shared: Shared | null = null;
  private levelKey = "";
  private camPos = new THREE.Vector3(0, 30, 34);
  private camLook = new THREE.Vector3(0, 0, 0);
  private clock = new THREE.Timer();
  private width = 1;
  private height = 1;
  private P: Palette;
  private stars: THREE.Points;

  constructor(canvas: HTMLCanvasElement, palette: Palette) {
    this.P = palette;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    const space = new THREE.Color("#000000");
    this.scene.background = space;
    this.scene.fog = new THREE.FogExp2(space, 0.0085);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(-12, 30, 18);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(palette.branches[1]), 0.5);
    rim.position.set(20, 8, -24);
    this.scene.add(rim);

    this.stars = makeStars();
    this.scene.add(this.stars);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.25);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  resize(w: number, h: number) {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setSize(this.width, this.height);
    this.bloom.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    // Keep a whole world in frame on narrow screens by widening the lens.
    this.camera.fov = this.camera.aspect < 1.2 ? 50 : 38;
    this.camera.updateProjectionMatrix();
  }

  /** Apply the latest derived state and advance animations. */
  update(input: SceneInput) {
    this.clock.update();
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.getElapsed();
    const first = input.worlds[0];
    if (!first) return;

    const key = `${first.state.levelId}:${first.state.width}x${first.state.height}`;
    if (key !== this.levelKey) this.rebuild(first.state, key);

    // Add / update / remove world views.
    const seen = new Set<string>();
    for (const w of input.worlds) {
      seen.add(w.id);
      let v = this.views.get(w.id);
      if (!v) {
        v = new WorldView(this.shared!, this.P, w);
        this.views.set(w.id, v);
        this.scene.add(v.group);
      }
      v.update(w, dt, t, input.reducedMotion);
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) {
        this.scene.remove(v.group);
        v.dispose();
        this.views.delete(id);
      }
    }

    // Camera rig.
    const slots = input.worlds.map((w) => w.slot);
    const activeView = this.views.get(input.activeId);
    const ax = activeView ? activeView.targetX : 0;
    const minX = Math.min(...slots) * SPACING;
    const maxX = Math.max(...slots) * SPACING;
    const portrait = this.camera.aspect < 1.2;
    let pos: THREE.Vector3;
    let look: THREE.Vector3;
    if (input.mode === "overview" && input.worlds.length > 1) {
      const cx = (minX + maxX) / 2;
      const span = maxX - minX + 30;
      const dist = Math.max(40, (span / 2 / Math.tan((this.camera.fov * Math.PI) / 360) / this.camera.aspect) * 1.05);
      // Look in front of the row so worlds sit high, leaving room for scorecards above the dock.
      pos = new THREE.Vector3(cx, dist * 0.8, dist * 0.7 + 10);
      look = new THREE.Vector3(cx, 0, 12);
    } else {
      // Active world ≈ two-thirds of the width, neighbours peeking in,
      // and lifted above the dock by looking slightly in front of centre.
      const d = portrait ? 1.15 : 1;
      pos = new THREE.Vector3(ax, 27 * d, 29 * d);
      look = new THREE.Vector3(ax, 0, 2.5);
    }
    // Gentle idle drift makes the space feel inhabited.
    if (!input.reducedMotion) pos.x += Math.sin(t * 0.25) * 0.6;
    const k = input.reducedMotion ? 1 : 1 - Math.exp(-dt * 3.2);
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    this.stars.rotation.y = input.reducedMotion ? 0 : t * 0.004;
    this.composer.render();
  }

  /** Screen position (CSS px) of a point in a world's local tile coordinates. Null if behind the camera. */
  project(worldId: string, x: number, y: number, z: number): { x: number; y: number; visible: boolean } | null {
    const v = this.views.get(worldId);
    if (!v) return null;
    tmp.set(x, y, z);
    v.group.localToWorld(tmp);
    tmp.project(this.camera);
    if (tmp.z > 1) return null;
    return {
      x: (tmp.x * 0.5 + 0.5) * this.width,
      y: (-tmp.y * 0.5 + 0.5) * this.height,
      visible: tmp.x > -1.15 && tmp.x < 1.15 && tmp.y > -1.15 && tmp.y < 1.15,
    };
  }

  /** Agent position (tile space, smoothed) for anchoring HUD elements. */
  agentLocal(worldId: string) {
    return this.views.get(worldId)?.agentLocal() ?? null;
  }

  /** Which world (if any) is under a canvas point — for click-to-focus. */
  pick(px: number, py: number): string | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1), this.camera);
    const floors = [...this.views.values()].map((v) => v.floor);
    const hit = ray.intersectObjects(floors, false)[0];
    return (hit?.object.userData.worldId as string) ?? null;
  }

  worldSize() {
    return this.shared ? { w: this.shared.w, h: this.shared.h } : { w: 24, h: 16 };
  }

  dispose() {
    for (const v of this.views.values()) v.dispose();
    this.views.clear();
    this.shared?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  private rebuild(s: WorldState, key: string) {
    for (const v of this.views.values()) {
      this.scene.remove(v.group);
      v.dispose();
    }
    this.views.clear();
    this.shared?.dispose();
    this.shared = new Shared(s, this.P);
    this.levelKey = key;
  }
}

/** Geometry and materials shared by every world of the same level. */
class Shared {
  w: number;
  h: number;
  walls: { x: number; y: number }[] = [];
  wallGeo = new THREE.BoxGeometry(1, 1, 1);
  wallMat: THREE.MeshStandardMaterial;
  wallEdgeGeo: THREE.EdgesGeometry;
  floorTex: THREE.CanvasTexture;
  crystalGeo = new THREE.OctahedronGeometry(0.32, 0);
  crystalMat: THREE.MeshStandardMaterial;
  agentGeo = new THREE.SphereGeometry(0.34, 32, 16);
  beadGeo = new THREE.SphereGeometry(0.13, 8, 6);
  haloGeo = new THREE.RingGeometry(0.5, 0.62, 48);
  goalGeo = new THREE.TorusGeometry(0.36, 0.05, 12, 48);
  beamGeo = new THREE.CylinderGeometry(0.06, 0.06, 6, 12, 1, true);

  constructor(s: WorldState, P: Palette) {
    this.w = s.width;
    this.h = s.height;
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) if (s.grid[y][x] === "#") this.walls.push({ x, y });
    this.wallMat = new THREE.MeshStandardMaterial({
      color: "#3d3d3d",
      emissive: new THREE.Color("#111111"),
      roughness: 0.65,
      metalness: 0.2,
    });
    this.wallEdgeGeo = new THREE.EdgesGeometry(this.wallGeo);
    this.crystalMat = new THREE.MeshStandardMaterial({
      color: P.object,
      emissive: new THREE.Color(P.object),
      emissiveIntensity: 1.6,
      roughness: 0.2,
      metalness: 0.3,
    });
    this.floorTex = makeFloorTexture(s.width, s.height);
  }

  dispose() {
    [this.wallGeo, this.wallEdgeGeo, this.crystalGeo, this.agentGeo, this.beadGeo, this.haloGeo, this.goalGeo, this.beamGeo].forEach((g) => g.dispose());
    this.wallMat.dispose();
    this.crystalMat.dispose();
    this.floorTex.dispose();
  }
}

const MAX_BEADS = 48;

/** One parallel world (one branch). */
class WorldView {
  group = new THREE.Group();
  floor: THREE.Mesh;
  targetX = 0;
  private S: Shared;
  private P: Palette;
  private color: THREE.Color;
  private ownMats: THREE.Material[] = [];
  private ownGeos: THREE.BufferGeometry[] = [];
  private frame: THREE.LineSegments;
  private frameMat: THREE.LineBasicMaterial;
  private floorMat: THREE.MeshStandardMaterial;
  private hazards: { mesh: THREE.Mesh; edges: THREE.LineSegments }[] = [];
  private hazardMat: THREE.MeshStandardMaterial;
  private hazardEdgeMat: THREE.LineBasicMaterial;
  private crystals: THREE.Mesh[] = [];
  private agent: THREE.Mesh;
  private agentMat: THREE.MeshStandardMaterial;
  private halo: THREE.Mesh;
  private haloMat: THREE.MeshBasicMaterial;
  private beads: THREE.InstancedMesh;
  private agentPos = new THREE.Vector3();
  private hasPos = false;
  private scale = 0.2;
  private flash = 0;
  private lastTick = -1;
  private goalRing: THREE.Mesh;

  constructor(S: Shared, P: Palette, w: WorldInput) {
    this.S = S;
    this.P = P;
    this.color = new THREE.Color(P.branches[w.colorIndex % P.branches.length]);
    const W = S.w;
    const H = S.h;
    this.group.position.x = (w.spawnSlot ?? w.slot) * SPACING;
    this.targetX = w.slot * SPACING;

    // Floor slab
    this.floorMat = this.mat(
      new THREE.MeshStandardMaterial({ map: S.floorTex, color: "#ffffff", roughness: 0.95, metalness: 0.0, transparent: true }),
    );
    this.floor = new THREE.Mesh(this.geo(new THREE.BoxGeometry(W, 0.3, H)), this.floorMat);
    this.floor.position.y = -0.15;
    this.floor.userData.worldId = w.id;
    this.group.add(this.floor);

    // Glowing frame in the branch color
    this.frameMat = this.mat(new THREE.LineBasicMaterial({ color: this.color, transparent: true, opacity: 0.9 }));
    this.frame = new THREE.LineSegments(this.geo(new THREE.EdgesGeometry(new THREE.BoxGeometry(W + 0.4, 0.32, H + 0.4))), this.frameMat);
    this.frame.position.y = -0.15;
    this.group.add(this.frame);

    // Walls (instanced) — interior walls rise higher than the boundary
    const walls = new THREE.InstancedMesh(S.wallGeo, S.wallMat, S.walls.length);
    const m = new THREE.Matrix4();
    S.walls.forEach((c, i) => {
      const boundary = c.x === 0 || c.y === 0 || c.x === W - 1 || c.y === H - 1;
      const hgt = boundary ? 0.35 : 0.9;
      m.compose(new THREE.Vector3(c.x - W / 2 + 0.5, hgt / 2, c.y - H / 2 + 0.5), new THREE.Quaternion(), new THREE.Vector3(0.98, hgt, 0.98));
      walls.setMatrixAt(i, m);
    });
    this.group.add(walls);

    // Hazards
    this.hazardMat = this.mat(
      new THREE.MeshStandardMaterial({
        color: P.hazard,
        emissive: new THREE.Color(P.hazard),
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
    this.hazardEdgeMat = this.mat(new THREE.LineBasicMaterial({ color: P.hazard, transparent: true, opacity: 0.9 }));
    for (const h of w.state.hazards) {
      const g = this.geo(new THREE.BoxGeometry(h.w, 0.7, h.h));
      const mesh = new THREE.Mesh(g, this.hazardMat);
      const edges = new THREE.LineSegments(this.geo(new THREE.EdgesGeometry(g)), this.hazardEdgeMat);
      this.group.add(mesh, edges);
      this.hazards.push({ mesh, edges });
    }

    // Crystals
    for (let i = 0; i < w.state.objects.length; i++) {
      const c = new THREE.Mesh(S.crystalGeo, S.crystalMat);
      this.group.add(c);
      this.crystals.push(c);
    }

    // Goal: ring + light beam
    const goalMat = this.mat(new THREE.MeshStandardMaterial({ color: P.goal, emissive: new THREE.Color(P.goal), emissiveIntensity: 2 }));
    this.goalRing = new THREE.Mesh(S.goalGeo, goalMat);
    this.goalRing.rotation.x = Math.PI / 2;
    const beamMat = this.mat(new THREE.MeshBasicMaterial({ color: P.goal, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    const beam = new THREE.Mesh(S.beamGeo, beamMat);
    beam.position.y = 3;
    const goal = new THREE.Group();
    goal.add(this.goalRing, beam);
    goal.position.set(w.state.goal.x - W / 2 + 0.5, 0.15, w.state.goal.y - H / 2 + 0.5);
    this.group.add(goal);

    // Agent
    this.agentMat = this.mat(
      new THREE.MeshStandardMaterial({ color: P.accent, emissive: new THREE.Color(P.accent), emissiveIntensity: 1.6, roughness: 0.3 }),
    );
    this.agent = new THREE.Mesh(S.agentGeo, this.agentMat);
    this.haloMat = this.mat(new THREE.MeshBasicMaterial({ color: P.accent, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    this.halo = new THREE.Mesh(S.haloGeo, this.haloMat);
    this.halo.rotation.x = -Math.PI / 2;
    this.group.add(this.agent, this.halo);

    // Trail beads
    const beadMat = this.mat(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    this.beads = new THREE.InstancedMesh(S.beadGeo, beadMat, MAX_BEADS);
    this.beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Bounds were computed while every bead had zero scale; don't let them cull the trail.
    this.beads.frustumCulled = false;
    this.group.add(this.beads);
  }

  agentLocal() {
    return { x: this.agentPos.x, y: this.agentPos.y, z: this.agentPos.z };
  }

  update(w: WorldInput, dt: number, t: number, reduced: boolean) {
    const { S } = this;
    const W = S.w;
    const H = S.h;
    const s = w.state;
    const k = (rate: number) => (reduced ? 1 : 1 - Math.exp(-dt * rate));

    // Position in the parallel row; grow in when first spawned.
    this.targetX = w.slot * SPACING;
    this.group.position.x += (this.targetX - this.group.position.x) * k(4);
    this.scale += ((w.latent ? 0.94 : 1) - this.scale) * k(5);
    this.group.scale.setScalar(this.scale);
    this.group.position.y = reduced ? 0 : Math.sin(t * 0.6 + w.slot) * 0.15;

    // Active world glows; others recede.
    const bright = w.active ? 1 : w.latent ? 0.35 : 0.6;
    this.frameMat.opacity = bright;
    this.floorMat.opacity = w.latent ? 0.55 : 1;
    this.floorMat.color.setScalar(w.active ? 1 : 0.7);

    // Hazards (they drift)
    s.hazards.forEach((h, i) => {
      const hz = this.hazards[i];
      if (!hz) return;
      const x = h.x + h.w / 2 - W / 2;
      const z = h.y + h.h / 2 - H / 2;
      hz.mesh.position.set(x, 0.35, z);
      hz.edges.position.copy(hz.mesh.position);
    });
    this.hazardMat.emissiveIntensity = 0.3 + (reduced ? 0 : 0.15 * Math.sin(t * 3));

    // Crystals spin and bob; collected ones vanish
    s.objects.forEach((o, i) => {
      const c = this.crystals[i];
      if (!c) return;
      c.visible = !o.collected;
      c.position.set(o.pos.x - W / 2 + 0.5, 0.55 + (reduced ? 0 : Math.sin(t * 2 + i) * 0.08), o.pos.y - H / 2 + 0.5);
      c.rotation.y = reduced ? 0 : t * 1.2 + i;
    });

    this.goalRing.rotation.z = reduced ? 0 : t * 0.8;

    // Agent glides between cells; big jumps (scrubs) snap.
    const target = new THREE.Vector3(s.agent.pos.x - W / 2 + 0.5, 0.42, s.agent.pos.y - H / 2 + 0.5);
    if (!this.hasPos || this.agentPos.distanceTo(target) > 2.5) {
      this.agentPos.copy(target);
      this.hasPos = true;
    } else {
      this.agentPos.lerp(target, k(14));
    }
    this.agent.position.copy(this.agentPos);
    this.halo.position.set(this.agentPos.x, 0.03, this.agentPos.z);
    this.halo.scale.setScalar(1 + (reduced ? 0 : 0.12 * Math.sin(t * 4)));

    // Violation flash: the agent turns red for a moment.
    if (s.tick !== this.lastTick) {
      if (s.violations.some((v) => v.tick === s.tick && s.tick > 0)) this.flash = 1;
      this.lastTick = s.tick;
    }
    this.flash = Math.max(0, this.flash - dt * 2.2);
    const base = new THREE.Color(this.P.accent);
    this.agentMat.emissive.copy(base).lerp(new THREE.Color(this.P.hazard), this.flash);
    this.agentMat.color.copy(this.agentMat.emissive);
    this.haloMat.color.copy(this.agentMat.emissive);

    // Trail beads in the branch color, fading toward the past
    const trail = w.trail.slice(-MAX_BEADS);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    for (let i = 0; i < MAX_BEADS; i++) {
      const p = trail[i];
      if (!p || i === trail.length - 1) {
        m.makeScale(0, 0, 0);
      } else {
        const f = (i + 1) / trail.length;
        m.compose(new THREE.Vector3(p.x - W / 2 + 0.5, 0.12, p.y - H / 2 + 0.5), new THREE.Quaternion(), new THREE.Vector3().setScalar(0.6 + f * 0.6));
        col.copy(this.color).multiplyScalar(0.25 + f * 1.4);
      }
      this.beads.setMatrixAt(i, m);
      this.beads.setColorAt(i, col);
    }
    this.beads.instanceMatrix.needsUpdate = true;
    if (this.beads.instanceColor) this.beads.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.ownMats.forEach((m) => m.dispose());
    this.ownGeos.forEach((g) => g.dispose());
    this.beads.dispose();
  }

  private mat<T extends THREE.Material>(m: T): T {
    this.ownMats.push(m);
    return m;
  }

  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.ownGeos.push(g);
    return g;
  }
}

function makeFloorTexture(w: number, h: number): THREE.CanvasTexture {
  const px = 32;
  const c = document.createElement("canvas");
  c.width = w * px;
  c.height = h * px;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, c.width * 0.7);
  g.addColorStop(0, "#121212");
  g.addColorStop(1, "#060606");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x++) {
    ctx.beginPath();
    ctx.moveTo(x * px + 0.5, 0);
    ctx.lineTo(x * px + 0.5, c.height);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * px + 0.5);
    ctx.lineTo(c.width, y * px + 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) ctx.fillRect(x * px - 1, y * px - 1, 2, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeStars(): THREE.Points {
  const n = 1400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 120 + Math.random() * 260;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 2 - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) * 0.6 + 20;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.55, fog: false });
  return new THREE.Points(g, m);
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
