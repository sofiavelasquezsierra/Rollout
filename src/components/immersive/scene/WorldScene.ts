import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { Dir, Vec, WorldState } from "@/sim";
import type { Palette } from "@/lib/tokens";

/**
 * "Parallel worlds" as test bays on a robotics lab floor: every branch is a
 * raised bay holding the same level, laid out side by side and shown at the
 * same frame. A small wheeled robot runs the policy; parcels are the
 * objectives, striped caution zones the hazards, a charging dock the goal.
 * Physically based materials, soft shadows, an environment map and a
 * tilt-shift lens pass give it a filmed-miniature look. Purely a view: it
 * receives derived state each frame and never touches the simulation.
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
const HALL = "#070708"; // the dark lab hall around the bays
const SPOTS = 6;

export class WorldScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 600);
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private lens: ShaderPass;
  private key: THREE.DirectionalLight;
  private ground: THREE.Mesh;
  private views = new Map<string, WorldView>();
  private shared: Shared | null = null;
  private levelKey = "";
  private camPos = new THREE.Vector3(0, 30, 34);
  private camLook = new THREE.Vector3(0, 0, 0);
  private clock = new THREE.Timer();
  private width = 1;
  private height = 1;
  private P: Palette;
  private envTex: THREE.Texture;
  private spots: THREE.SpotLight[] = [];

  constructor(canvas: HTMLCanvasElement, palette: Palette) {
    this.P = palette;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const hall = new THREE.Color(HALL);
    this.scene.background = hall;
    this.scene.fog = new THREE.FogExp2(hall, 0.011);

    // Image-based lighting from a procedural studio room: gives metal and
    // plastic believable reflections without shipping an HDR file.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.22;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 0.12));
    // Key light = overhead softbox. Its shadow frustum follows the camera target.
    this.key = new THREE.DirectionalLight(0xfff6ea, 0.7);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.03;
    this.key.shadow.radius = 4;
    this.scene.add(this.key, this.key.target);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.45);
    fill.position.set(24, 12, -20);
    this.scene.add(fill);

    // A fixed pool of overhead spots, one per nearby bay, pools light on each
    // bay so the hall falls off into darkness. Fixed count: adding lights at
    // runtime would recompile every shader and stutter on fork.
    for (let i = 0; i < SPOTS; i++) {
      const s = new THREE.SpotLight(0xfff1e0, 0, 0, 0.47, 0.55, 0);
      // The nearest bay's spot (always the active one in focus) casts the crisp contact shadows.
      if (i === 0) {
        s.castShadow = true;
        s.shadow.mapSize.set(2048, 2048);
        s.shadow.bias = -0.0003;
        s.shadow.normalBias = 0.02;
        s.shadow.camera.near = 10;
        s.shadow.camera.far = 60;
      }
      this.scene.add(s, s.target);
      this.spots.push(s);
    }

    this.ground = makeGround();
    this.scene.add(this.ground);

    // MSAA on the composer target (the canvas itself isn't antialiased once post-processing is on).
    const target = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // High threshold: only emissive parts (LEDs, dock, branch strips) bloom.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.45, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.lens = new ShaderPass(LensShader);
    this.composer.addPass(this.lens);
  }

  resize(w: number, h: number) {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setSize(this.width, this.height);
    this.bloom.setSize(this.width, this.height);
    const pr = this.renderer.getPixelRatio();
    (this.lens.uniforms.res.value as THREE.Vector2).set(this.width * pr, this.height * pr);
    this.lens.uniforms.pr.value = pr;
    this.camera.aspect = this.width / this.height;
    // Keep a whole world in frame on narrow screens by widening the lens.
    this.camera.fov = this.camera.aspect < 1.2 ? 50 : 32;
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
    const overview = input.mode === "overview" && input.worlds.length > 1;
    let pos: THREE.Vector3;
    let look: THREE.Vector3;
    let shadowExtent: number;
    if (overview) {
      const cx = (minX + maxX) / 2;
      const span = maxX - minX + 30;
      const dist = Math.max(40, (span / 2 / Math.tan((this.camera.fov * Math.PI) / 360) / this.camera.aspect) * 1.05);
      // Look in front of the row so worlds sit high, leaving room for scorecards above the dock.
      pos = new THREE.Vector3(cx, dist * 0.8, dist * 0.7 + 10);
      look = new THREE.Vector3(cx, 0, 12);
      shadowExtent = span / 2 + 6;
    } else {
      // Active world ≈ two-thirds of the width, neighbours peeking in,
      // and lifted above the dock by looking slightly in front of centre.
      // Longer lens from a lower angle than a top-down map: reads as a filmed set.
      const d = portrait ? 0.95 : 1;
      pos = new THREE.Vector3(ax, 28 * d, 40 * d);
      look = new THREE.Vector3(ax, 0, 2.2);
      shadowExtent = SPACING * 0.95;
    }
    // A slow handheld-style drift makes the shot feel filmed rather than rendered.
    if (!input.reducedMotion) {
      pos.x += Math.sin(t * 0.25) * 0.6;
      pos.y += Math.sin(t * 0.37) * 0.15;
    }
    const k = input.reducedMotion ? 1 : 1 - Math.exp(-dt * 3.2);
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // Spots go to the bays nearest the camera target; the rest stay dark.
    const near = [...this.views.values()].sort((a, b) => Math.abs(a.targetX - this.camLook.x) - Math.abs(b.targetX - this.camLook.x));
    this.spots.forEach((s, i) => {
      const v = near[i];
      if (!v) {
        s.intensity = 0;
        return;
      }
      const x = v.group.position.x;
      s.position.set(x - 7, 30, 9);
      s.target.position.set(x, 0, 0);
      s.intensity += ((v.active ? 4.2 : 2.6) - s.intensity) * k;
    });

    // Shadow frustum tracks what's on screen.
    const sc = this.key.shadow.camera;
    this.key.target.position.set(this.camLook.x, 0, 0);
    this.key.position.set(this.camLook.x - 14, 34, 18);
    if (sc.right !== shadowExtent) {
      sc.left = -shadowExtent;
      sc.right = shadowExtent;
      sc.top = shadowExtent * 0.7;
      sc.bottom = -shadowExtent * 0.7;
      sc.near = 1;
      sc.far = 90;
      sc.updateProjectionMatrix();
    }

    // Lens: tilt-shift focus on the band the active world occupies; softer in overview.
    const u = this.lens.uniforms;
    u.blur.value += ((overview ? 3.5 : 9) - (u.blur.value as number)) * k;
    u.focusY.value = overview ? 0.6 : 0.55;
    u.time.value = input.reducedMotion ? 0 : t % 100;

    // Thin the haze when pulled back, or distant bays would sink into it.
    const fog = this.scene.fog as THREE.FogExp2;
    fog.density += ((overview ? 0.0042 : 0.011) - fog.density) * k;

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
    const gm = this.ground.material as THREE.MeshStandardMaterial;
    gm.map?.dispose();
    gm.dispose();
    this.ground.geometry.dispose();
    this.envTex.dispose();
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

/** Geometry, textures and materials shared by every world of the same level. */
class Shared {
  w: number;
  h: number;
  walls: { x: number; y: number }[] = [];
  curbGeo = new THREE.BoxGeometry(1, 1, 1);
  curbMat: THREE.MeshStandardMaterial;
  barrierMat: THREE.MeshStandardMaterial;
  floorTex: THREE.CanvasTexture;
  plinthMat: THREE.MeshStandardMaterial;
  parcelGeo = new RoundedBoxGeometry(0.64, 0.46, 0.64, 2, 0.03);
  parcelTex: THREE.CanvasTexture;
  parcelMat: THREE.MeshStandardMaterial;
  stripeTex: THREE.CanvasTexture;
  coneGeo = new THREE.ConeGeometry(0.13, 0.38, 20, 1, true);
  coneBaseGeo = new THREE.BoxGeometry(0.3, 0.035, 0.3);
  coneMat: THREE.MeshStandardMaterial;
  // Robot
  chassisGeo = new RoundedBoxGeometry(0.6, 0.24, 0.68, 3, 0.07);
  deckGeo = new RoundedBoxGeometry(0.46, 0.03, 0.5, 2, 0.012);
  wheelGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 24);
  lidarGeo = new THREE.CylinderGeometry(0.1, 0.11, 0.09, 24);
  ledGeo = new THREE.BoxGeometry(0.34, 0.035, 0.02);
  shellMat: THREE.MeshStandardMaterial;
  deckMat: THREE.MeshStandardMaterial;
  rubberMat: THREE.MeshStandardMaterial;
  lidarMat: THREE.MeshStandardMaterial;
  // Dock
  padGeo = new RoundedBoxGeometry(0.92, 0.05, 0.92, 2, 0.02);
  dockRingGeo = new THREE.RingGeometry(0.27, 0.34, 48);
  pylonGeo = new RoundedBoxGeometry(0.78, 0.5, 0.14, 2, 0.03);
  dockLedGeo = new THREE.BoxGeometry(0.52, 0.045, 0.02);
  darkMetal: THREE.MeshStandardMaterial;
  // Trail + selection
  markGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.01, 14);
  haloGeo = new THREE.RingGeometry(0.5, 0.56, 48);

  constructor(s: WorldState, P: Palette) {
    this.w = s.width;
    this.h = s.height;
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) if (s.grid[y][x] === "#") this.walls.push({ x, y });
    // Boundary = poured concrete curb; interior walls = brushed-steel barriers.
    this.curbMat = new THREE.MeshStandardMaterial({ color: "#3a3a39", roughness: 0.9, metalness: 0 });
    this.barrierMat = new THREE.MeshStandardMaterial({ color: "#9a9ca0", roughness: 0.38, metalness: 0.85 });
    this.floorTex = makeBayFloorTexture(s.width, s.height);
    this.plinthMat = new THREE.MeshStandardMaterial({ color: "#1c1c1e", roughness: 0.55, metalness: 0.6 });
    this.parcelTex = makeCardboardTexture();
    this.parcelMat = new THREE.MeshStandardMaterial({ map: this.parcelTex, roughness: 0.88, metalness: 0 });
    this.stripeTex = makeStripeTexture(P.hazard);
    this.coneMat = new THREE.MeshStandardMaterial({ color: P.hazard, roughness: 0.5, side: THREE.DoubleSide });
    this.shellMat = new THREE.MeshStandardMaterial({ color: "#e9e9e6", roughness: 0.42, metalness: 0.05 });
    this.deckMat = new THREE.MeshStandardMaterial({ color: "#202022", roughness: 0.3, metalness: 0.4 });
    this.rubberMat = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.95 });
    this.lidarMat = new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.15, metalness: 0.6 });
    this.darkMetal = new THREE.MeshStandardMaterial({ color: "#2a2a2c", roughness: 0.35, metalness: 0.8 });
  }

  dispose() {
    for (const v of Object.values(this)) {
      if (v instanceof THREE.BufferGeometry || v instanceof THREE.Material || v instanceof THREE.Texture) v.dispose();
    }
  }
}

const MAX_MARKS = 48;
const FACING: Record<Dir, number> = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 };

/** One parallel world (one branch): a test bay with its own robot. */
class WorldView {
  group = new THREE.Group();
  floor: THREE.Mesh;
  targetX = 0;
  active = false;
  private S: Shared;
  private P: Palette;
  private color: THREE.Color;
  private ownMats: THREE.Material[] = [];
  private ownGeos: THREE.BufferGeometry[] = [];
  private stripMat: THREE.MeshBasicMaterial;
  private floorMat: THREE.MeshStandardMaterial;
  private hazards: THREE.Group[] = [];
  private hazardMat: THREE.MeshStandardMaterial;
  private parcels: THREE.Mesh[] = [];
  private parcelScale: number[] = [];
  private robot = new THREE.Group();
  private lidar: THREE.Mesh;
  private ledMat: THREE.MeshStandardMaterial;
  private halo: THREE.Mesh;
  private haloMat: THREE.MeshBasicMaterial;
  private marks: THREE.InstancedMesh;
  private dockRingMat: THREE.MeshBasicMaterial;
  private agentPos = new THREE.Vector3();
  private heading = 0;
  private hasPos = false;
  private scale = 0.2;
  private flash = 0;
  private lastTick = -1;

  constructor(S: Shared, P: Palette, w: WorldInput) {
    this.S = S;
    this.P = P;
    this.color = new THREE.Color(P.branches[w.colorIndex % P.branches.length]);
    const W = S.w;
    const H = S.h;
    const cell = (x: number, y: number, h: number) => new THREE.Vector3(x - W / 2 + 0.5, h, y - H / 2 + 0.5);
    this.group.position.x = (w.spawnSlot ?? w.slot) * SPACING;
    this.targetX = w.slot * SPACING;

    // Bay: polished concrete deck on a dark steel plinth that stands on the hall floor.
    this.floorMat = this.mat(new THREE.MeshStandardMaterial({ map: S.floorTex, roughness: 0.62, metalness: 0.05 }));
    this.floor = new THREE.Mesh(this.geo(new THREE.BoxGeometry(W, 0.3, H)), this.floorMat);
    this.floor.position.y = -0.15;
    this.floor.receiveShadow = true;
    this.floor.userData.worldId = w.id;
    const plinth = new THREE.Mesh(this.geo(new THREE.BoxGeometry(W + 0.8, 0.9, H + 0.8)), S.plinthMat);
    plinth.position.y = -0.75;
    plinth.castShadow = plinth.receiveShadow = true;
    this.group.add(this.floor, plinth);

    // Branch identity: an LED strip around the plinth's top edge.
    this.stripMat = this.mat(new THREE.MeshBasicMaterial({ color: this.color, transparent: true, toneMapped: false }));
    const sw = 0.07;
    for (const [sx, sz, px, pz] of [
      [W + 0.8 + sw, sw, 0, (H + 0.8) / 2],
      [W + 0.8 + sw, sw, 0, -(H + 0.8) / 2],
      [sw, H + 0.8, (W + 0.8) / 2, 0],
      [sw, H + 0.8, -(W + 0.8) / 2, 0],
    ]) {
      const strip = new THREE.Mesh(this.geo(new THREE.BoxGeometry(sx, 0.05, sz)), this.stripMat);
      strip.position.set(px, -0.33, pz);
      this.group.add(strip);
    }

    // Walls (instanced)
    const boundary = S.walls.filter((c) => c.x === 0 || c.y === 0 || c.x === W - 1 || c.y === H - 1);
    const interior = S.walls.filter((c) => !(c.x === 0 || c.y === 0 || c.x === W - 1 || c.y === H - 1));
    const place = (cells: typeof S.walls, geo: THREE.BufferGeometry, mat: THREE.Material, hgt: number, inset: number) => {
      const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
      const m = new THREE.Matrix4();
      cells.forEach((c, i) => {
        m.compose(cell(c.x, c.y, hgt / 2), new THREE.Quaternion(), new THREE.Vector3(inset, hgt, inset));
        mesh.setMatrixAt(i, m);
      });
      mesh.castShadow = mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    place(boundary, S.curbGeo, S.curbMat, 0.32, 1);
    // Interior walls become continuous steel barriers, one per straight run.
    for (const r of wallRuns(interior)) {
      const bar = new THREE.Mesh(this.geo(new RoundedBoxGeometry(r.w - 0.08, 0.85, r.h - 0.08, 2, 0.07)), S.barrierMat);
      bar.position.set(r.x + r.w / 2 - W / 2, 0.425, r.y + r.h / 2 - H / 2);
      bar.castShadow = bar.receiveShadow = true;
      this.group.add(bar);
    }

    // Caution zones: striped floor marking + four traffic cones. They drift as a unit.
    this.hazardMat = this.mat(
      new THREE.MeshStandardMaterial({
        map: S.stripeTex,
        emissiveMap: S.stripeTex,
        emissive: new THREE.Color(P.hazard),
        emissiveIntensity: 0.3,
        roughness: 0.7,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    for (const h of w.state.hazards) {
      const g = new THREE.Group();
      const plane = this.geo(new THREE.PlaneGeometry(h.w, h.h));
      const uv = plane.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * h.w * 1.4, uv.getY(i) * h.h * 1.4);
      const decal = new THREE.Mesh(plane, this.hazardMat);
      decal.rotation.x = -Math.PI / 2;
      decal.position.y = 0.004;
      decal.receiveShadow = true;
      g.add(decal);
      for (const [cx, cz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const cone = new THREE.Group();
        const body = new THREE.Mesh(S.coneGeo, S.coneMat);
        body.position.y = 0.21;
        const base = new THREE.Mesh(S.coneBaseGeo, S.rubberMat);
        base.position.y = 0.018;
        body.castShadow = base.castShadow = true;
        cone.add(body, base);
        cone.position.set(cx * (h.w / 2 - 0.22), 0, cz * (h.h / 2 - 0.22));
        g.add(cone);
      }
      this.group.add(g);
      this.hazards.push(g);
    }

    // Parcels
    for (let i = 0; i < w.state.objects.length; i++) {
      const p = new THREE.Mesh(S.parcelGeo, S.parcelMat);
      p.castShadow = p.receiveShadow = true;
      p.rotation.y = ((i * 37) % 11) * 0.06 - 0.3; // set down by hand, not on a grid
      this.group.add(p);
      this.parcels.push(p);
      this.parcelScale.push(1);
    }

    // Charging dock: pad, glowing contact ring, and a pylon with a status bar.
    const dock = new THREE.Group();
    const pad = new THREE.Mesh(S.padGeo, S.darkMetal);
    pad.position.y = 0.025;
    pad.receiveShadow = true;
    this.dockRingMat = this.mat(new THREE.MeshBasicMaterial({ color: P.goal, transparent: true, side: THREE.DoubleSide, toneMapped: false }));
    const ring = new THREE.Mesh(S.dockRingGeo, this.dockRingMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.053;
    const pylon = new THREE.Mesh(S.pylonGeo, S.darkMetal);
    pylon.position.set(0, 0.3, -0.42);
    pylon.castShadow = true;
    const led = new THREE.Mesh(S.dockLedGeo, this.mat(new THREE.MeshBasicMaterial({ color: P.goal, toneMapped: false })));
    led.position.set(0, 0.42, -0.345);
    dock.add(pad, ring, pylon, led);
    dock.position.copy(cell(w.state.goal.x, w.state.goal.y, 0));
    this.group.add(dock);

    // Robot: white shell, dark deck, differential-drive wheels, spinning lidar, front status LED.
    const shell = new THREE.Mesh(S.chassisGeo, S.shellMat);
    shell.position.y = 0.23;
    const deck = new THREE.Mesh(S.deckGeo, S.deckMat);
    deck.position.y = 0.36;
    this.lidar = new THREE.Mesh(S.lidarGeo, S.lidarMat);
    this.lidar.position.set(0, 0.42, -0.06);
    this.ledMat = this.mat(new THREE.MeshStandardMaterial({ color: "#000000", emissive: new THREE.Color(P.accent), emissiveIntensity: 2.2 }));
    const ledBar = new THREE.Mesh(S.ledGeo, this.ledMat);
    ledBar.position.set(0, 0.27, 0.345);
    this.robot.add(shell, deck, this.lidar, ledBar);
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(S.wheelGeo, S.rubberMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 0.31, 0.13, 0.08);
      wheel.castShadow = true;
      this.robot.add(wheel);
    }
    this.robot.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    // Selection ring on the floor, in the branch colour (flashes on violations).
    this.haloMat = this.mat(new THREE.MeshBasicMaterial({ color: this.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    this.halo = new THREE.Mesh(S.haloGeo, this.haloMat);
    this.halo.rotation.x = -Math.PI / 2;
    this.group.add(this.robot, this.halo);

    // Path markers: small painted dots in the branch colour, fading toward the past.
    const markMat = this.mat(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    this.marks = new THREE.InstancedMesh(S.markGeo, markMat, MAX_MARKS);
    this.marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Bounds were computed while every mark had zero scale; don't let them cull the trail.
    this.marks.frustumCulled = false;
    this.group.add(this.marks);
  }

  agentLocal() {
    return { x: this.agentPos.x, y: 0.5, z: this.agentPos.z };
  }

  update(w: WorldInput, dt: number, t: number, reduced: boolean) {
    const { S } = this;
    const W = S.w;
    const H = S.h;
    const s = w.state;
    const k = (rate: number) => (reduced ? 1 : 1 - Math.exp(-dt * rate));

    // Position in the parallel row; grow in when first spawned.
    this.targetX = w.slot * SPACING;
    this.active = w.active;
    this.group.position.x += (this.targetX - this.group.position.x) * k(4);
    this.scale += ((w.latent ? 0.94 : 1) - this.scale) * k(5);
    this.group.scale.setScalar(this.scale);

    // Active bay is lit; others recede; latent ones (not yet diverged) are dimmer still.
    const bright = w.active ? 1 : w.latent ? 0.3 : 0.6;
    this.stripMat.opacity = bright;
    this.floorMat.color.setScalar(w.active ? 1 : w.latent ? 0.55 : 0.75);

    // Caution zones (they drift)
    s.hazards.forEach((h, i) => {
      this.hazards[i]?.position.set(h.x + h.w / 2 - W / 2, 0, h.y + h.h / 2 - H / 2);
    });
    this.hazardMat.emissiveIntensity = 0.25 + (reduced ? 0 : 0.12 * Math.sin(t * 3));

    // Parcels: collected ones are lifted away (quick shrink), not popped.
    s.objects.forEach((o, i) => {
      const p = this.parcels[i];
      if (!p) return;
      const target = o.collected ? 0 : 1;
      this.parcelScale[i] += (target - this.parcelScale[i]) * k(12);
      const sc = this.parcelScale[i];
      p.visible = sc > 0.02;
      p.scale.setScalar(sc);
      p.position.set(o.pos.x - W / 2 + 0.5, 0.23 * sc + (1 - sc) * 0.5, o.pos.y - H / 2 + 0.5);
    });

    this.dockRingMat.opacity = 0.7 + (reduced ? 0 : 0.3 * Math.sin(t * 2.4));

    // Robot drives between cells and turns to face its heading; big jumps (scrubs) snap.
    const target = new THREE.Vector3(s.agent.pos.x - W / 2 + 0.5, 0, s.agent.pos.y - H / 2 + 0.5);
    const want = FACING[s.agent.facing];
    if (!this.hasPos || this.agentPos.distanceTo(target) > 2.5) {
      this.agentPos.copy(target);
      this.heading = want;
      this.hasPos = true;
    } else {
      this.agentPos.lerp(target, k(14));
      const diff = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
      this.heading += diff * k(16);
    }
    this.robot.position.copy(this.agentPos);
    this.robot.scale.setScalar(1.3);
    this.robot.rotation.y = this.heading;
    this.lidar.rotation.y = reduced ? 0 : t * 6;
    this.halo.position.set(this.agentPos.x, 0.012, this.agentPos.z);
    this.halo.scale.setScalar(1 + (reduced ? 0 : 0.08 * Math.sin(t * 4)));
    this.haloMat.opacity = w.active ? 0.55 : 0.3;

    // Violation flash: status LED and floor ring go hazard-red for a moment.
    if (s.tick !== this.lastTick) {
      if (s.violations.some((v) => v.tick === s.tick && s.tick > 0)) this.flash = 1;
      this.lastTick = s.tick;
    }
    this.flash = Math.max(0, this.flash - dt * 2.2);
    const hz = new THREE.Color(this.P.hazard);
    this.ledMat.emissive.set(this.P.accent).lerp(hz, this.flash);
    this.haloMat.color.copy(this.color).lerp(hz, this.flash);

    // Path markers
    const trail = w.trail.slice(-MAX_MARKS);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    for (let i = 0; i < MAX_MARKS; i++) {
      const p = trail[i];
      if (!p || i === trail.length - 1) {
        m.makeScale(0, 0, 0);
      } else {
        const f = (i + 1) / trail.length;
        m.compose(new THREE.Vector3(p.x - W / 2 + 0.5, 0.006, p.y - H / 2 + 0.5), new THREE.Quaternion(), new THREE.Vector3().setScalar(0.7 + f * 0.5));
        col.copy(this.color).multiplyScalar(0.25 + f * 0.9);
      }
      this.marks.setMatrixAt(i, m);
      this.marks.setColorAt(i, col);
    }
    this.marks.instanceMatrix.needsUpdate = true;
    if (this.marks.instanceColor) this.marks.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.ownMats.forEach((m) => m.dispose());
    this.ownGeos.forEach((g) => g.dispose());
    this.marks.dispose();
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

/* ── Post: tilt-shift + chromatic fringe + vignette + film grain ───────── */

const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    res: { value: new THREE.Vector2(1, 1) },
    pr: { value: 1 },
    time: { value: 0 },
    blur: { value: 4.5 },
    focusY: { value: 0.56 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 res;
    uniform float pr, time, blur, focusY;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      // Tilt-shift: sharp band around the subject, blur growing above and below.
      float amt = smoothstep(0.1, 0.45, abs(vUv.y - focusY)) * blur * pr;
      vec2 px = amt / res;
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float tot = 1.0;
      for (int i = 0; i < 12; i++) {
        float fi = float(i);
        float r = sqrt((fi + 0.5) / 12.0);
        float a = fi * 2.39996;
        c += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * px).rgb;
        tot += 1.0;
      }
      c /= tot;
      // Slight lateral chromatic fringe toward the frame edges.
      vec2 q = vUv - 0.5;
      vec2 ca = q * 1.2 * pr / res;
      c.r = mix(c.r, texture2D(tDiffuse, vUv + ca).r, 0.5);
      c.b = mix(c.b, texture2D(tDiffuse, vUv - ca).b, 0.5);
      c *= 1.0 - dot(q, q) * 0.55;
      c += (hash(vUv * res + time) - 0.5) * 0.035;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

/* ── Procedural textures (no image assets) ─────────────────────────────── */

function canvasTex(c: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Speckle + soft blotches: the look of troweled concrete. */
function concrete(ctx: CanvasRenderingContext2D, w: number, h: number, base: string, amount: number) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < (w * h) / 900; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 20 + Math.random() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = Math.random() > 0.5;
    g.addColorStop(0, light ? `rgba(255,255,255,${0.02 * amount})` : `rgba(0,0,0,${0.05 * amount})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < (w * h) / 14; i++) {
    const v = Math.random();
    ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.05 * amount})` : `rgba(0,0,0,${0.12 * amount})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random(), 1 + Math.random());
  }
}

/** Bay deck: polished concrete tiles, one per cell, with saw-cut seams. */
function makeBayFloorTexture(w: number, h: number): THREE.CanvasTexture {
  const px = 48;
  const c = document.createElement("canvas");
  c.width = w * px;
  c.height = h * px;
  const ctx = c.getContext("2d")!;
  concrete(ctx, c.width, c.height, "#343433", 1.2);
  // Per-tile tone variation, as if poured in sections.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.04})`;
      ctx.fillRect(x * px, y * px, px, px);
    }
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= w; x++) {
    ctx.beginPath();
    ctx.moveTo(x * px, 0);
    ctx.lineTo(x * px, c.height);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * px);
    ctx.lineTo(c.width, y * px);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x++) {
    ctx.beginPath();
    ctx.moveTo(x * px + 1.5, 0);
    ctx.lineTo(x * px + 1.5, c.height);
    ctx.stroke();
  }
  return canvasTex(c);
}

/** Hall floor: large dark slabs, tiled across the scene. */
function makeGround(): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  concrete(ctx, 512, 512, "#161616", 1.4);
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 512, 512);
  const tex = canvasTex(c, true);
  tex.repeat.set(40, 40);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.1 });
  const g = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mat);
  g.rotation.x = -Math.PI / 2;
  g.position.y = -1.2;
  g.receiveShadow = true;
  return g;
}

/** Corrugated cardboard with a strip of packing tape and a shipping label. */
function makeCardboardTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#a9835a";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,240,210,0.06)" : "rgba(60,35,10,0.08)";
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 6, 1);
  }
  ctx.fillStyle = "rgba(220,200,160,0.55)";
  ctx.fillRect(104, 0, 48, 256);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(108, 0, 3, 256);
  ctx.fillStyle = "#ecebe6";
  ctx.fillRect(28, 170, 60, 44);
  ctx.fillStyle = "#2b2b2b";
  for (let i = 0; i < 9; i++) ctx.fillRect(34 + i * 5, 178, i % 3 === 0 ? 2 : 1, 22);
  ctx.fillRect(34, 204, 40, 3);
  return canvasTex(c);
}

/** Diagonal safety stripes in the hazard colour over near-black. */
function makeStripeTexture(hazard: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#141414";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = hazard;
  for (let i = -64; i < 128; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 16, 0);
    ctx.lineTo(i + 16 + 64, 64);
    ctx.lineTo(i + 64, 64);
    ctx.closePath();
    ctx.fill();
  }
  // Worn paint
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = "rgba(20,20,20,0.35)";
    ctx.fillRect(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 2, 1);
  }
  return canvasTex(c, true);
}

/** Greedy merge of wall cells into straight runs: horizontal first, then vertical leftovers. */
function wallRuns(cells: { x: number; y: number }[]) {
  const key = (x: number, y: number) => `${x},${y}`;
  const left = new Set(cells.map((c) => key(c.x, c.y)));
  const runs: { x: number; y: number; w: number; h: number }[] = [];
  const sorted = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const c of sorted) {
    if (!left.has(key(c.x, c.y))) continue;
    let w = 1;
    while (left.has(key(c.x + w, c.y))) w++;
    let h = 1;
    if (w === 1) while (left.has(key(c.x, c.y + h))) h++;
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++) left.delete(key(c.x + dx, c.y + dy));
    runs.push({ x: c.x, y: c.y, w, h });
  }
  return runs;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
