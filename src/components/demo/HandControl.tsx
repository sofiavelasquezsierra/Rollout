"use client";

import { useEffect, useRef, useState } from "react";
import type { HandLandmarker } from "@mediapipe/tasks-vision";
import { IntentFilter, NO_INTENT, classify, type Intent, type Landmark } from "@/hand/intent";
import { palette, withAlpha } from "@/lib/tokens";
import { useRollout } from "@/store/useRollout";
import { Icon } from "@/components/ui/Icon";
import { Button, Label } from "@/components/ui/primitives";

/**
 * Phase 2 (feature-flagged): steer the agent with your hand via webcam hand
 * tracking. A stand-in for sEMG wristband input — same low-bandwidth intents
 * (direction, pinch, open palm), different sensor. Frames never leave the device.
 */
const MP_VERSION = "1.2.0";
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

type Status = "idle" | "loading" | "running" | "error";

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

export function HandControl({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [intent, setIntent] = useState<Intent>(NO_INTENT);
  const [palmHold, setPalmHold] = useState(0);
  const steering = useRollout((s) => s.hand.active);
  const setHand = useRollout((s) => s.setHand);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => () => {
    stopRef.current();
    useRollout.getState().setHand({ active: false });
  }, []);

  async function start() {
    setStatus("loading");
    setError("");
    let stream: MediaStream | null = null;
    let landmarker: HandLandmarker | null = null;
    let raf = 0;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: "user" }, audio: false });
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
      });
      setStatus("running");

      const filter = new IntentFilter();
      let lastUi = 0;
      let lastVideoTime = -1;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (!landmarker || video.readyState < 2 || video.currentTime === lastVideoTime) return;
        lastVideoTime = video.currentTime;
        const now = performance.now();
        const res = landmarker.detectForVideo(video, now);
        const lm = (res.landmarks?.[0] as Landmark[] | undefined) ?? null;
        const { intent: stable, events } = filter.push(classify(lm), now);

        const store = useRollout.getState();
        if (store.hand.active) {
          if (store.hand.dir !== stable.dir) store.setHand({ dir: stable.gesture === "point" ? stable.dir : null });
          for (const e of events) {
            if (e.type === "fork") store.fork("hand-fork");
            if (e.type === "togglePlay") store.togglePlay();
          }
        }
        drawSignal(canvasRef.current, video, lm, stable);
        if (now - lastUi > 66) {
          lastUi = now;
          setIntent(stable);
          setPalmHold(filter.palmProgress(now));
        }
      };
      raf = requestAnimationFrame(loop);
      stopRef.current = () => {
        cancelAnimationFrame(raf);
        landmarker?.close();
        stream?.getTracks().forEach((t) => t.stop());
      };
    } catch (err) {
      cancelAnimationFrame(raf);
      landmarker?.close();
      stream?.getTracks().forEach((t) => t.stop());
      const name = err instanceof Error ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera permission was denied. Allow it in the browser’s site settings to try again."
          : name === "NotFoundError"
            ? "No camera found on this device."
            : "The hand tracker couldn’t start (model or WebAssembly failed to load).",
      );
      setStatus("error");
    }
  }

  function stop() {
    stopRef.current();
    stopRef.current = () => {};
    setHand({ active: false });
    setStatus("idle");
    setIntent(NO_INTENT);
  }

  return (
    <section
      aria-label="Hand control"
      className="absolute bottom-4 left-4 z-20 w-[min(440px,calc(100%-32px))] animate-rise-in rounded-lg border border-line-strong bg-surface-1/95 shadow-[0_16px_50px_rgb(0_0_0/0.5)] backdrop-blur"
    >
      <header className="flex items-start gap-3 border-b border-line px-3 py-2.5">
        <Icon name="hand" className="mt-0.5 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-13 text-ink">Hand control</p>
          <p className="text-12 text-ink-3">Stand-in for my sEMG wristband research — webcam hand tracking via MediaPipe.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close hand control" className="rounded-md p-1 text-ink-3 hover:bg-surface-3 hover:text-ink">
          <Icon name="close" size={14} />
        </button>
      </header>

      <video ref={videoRef} playsInline muted className="hidden" />

      {status === "idle" || status === "error" ? (
        <div className="space-y-3 p-3 text-12 leading-relaxed text-ink-2">
          <p>
            Point to steer the agent, pinch to fork the world, hold an open palm to play / pause. The camera stays on this
            device: frames are processed locally and never uploaded.
          </p>
          {status === "error" && <p className="rounded-md border border-hazard/40 bg-hazard-soft p-2 text-ink">{error}</p>}
          <Button variant="accent" size="sm" icon="video" onClick={start}>
            {status === "error" ? "Try again" : "Enable camera"}
          </Button>
        </div>
      ) : status === "loading" ? (
        <div className="flex items-center gap-2 p-4 font-mono text-12 text-ink-3" aria-busy="true">
          <span className="size-2 animate-pulse rounded-full bg-accent" /> Loading hand tracker…
        </div>
      ) : (
        <div className="grid grid-cols-[160px_1fr] gap-3 p-3">
          <div>
            <Label className="mb-1 block">Raw signal</Label>
            <canvas ref={canvasRef} width={160} height={120} className="h-[120px] w-[160px] rounded-md border border-line bg-bg" aria-label="Camera feed with tracked hand landmarks" role="img" />
          </div>
          <div className="min-w-0">
            <Label className="mb-1 block">Inferred intent</Label>
            <div className="flex items-center gap-3">
              <div
                aria-live="polite"
                className={`flex size-14 shrink-0 items-center justify-center rounded-md border text-24 ${
                  intent.gesture === "none" ? "border-line text-ink-3" : "border-accent/50 bg-accent-soft text-accent"
                }`}
              >
                {glyph(intent)}
              </div>
              <div className="min-w-0 space-y-1.5 font-mono text-12">
                <p className="text-ink">{label(intent)}</p>
                <Meter label="conf" value={intent.confidence} />
                <Meter label="pinch" value={1 - intent.pinch} />
                <Meter label="palm" value={palmHold} />
              </div>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-12 text-ink-2">
              <input
                type="checkbox"
                checked={steering}
                onChange={(e) => setHand({ active: e.target.checked })}
                className="accent-[var(--c-accent)]"
              />
              Steer the agent (replaces the policy at the head)
            </label>
            <button type="button" onClick={stop} className="mt-2 font-mono text-12 text-ink-3 underline underline-offset-4 hover:text-ink">
              Turn camera off
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 text-ink-3">{label}</span>
      <span className="h-1 w-20 rounded-full bg-surface-3">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
    </div>
  );
}

function glyph(i: Intent) {
  if (i.gesture === "point") return { N: "↑", S: "↓", E: "→", W: "←" }[i.dir!];
  return { pinch: "⑂", palm: "✋", fist: "●", none: "·" }[i.gesture as "pinch" | "palm" | "fist" | "none"];
}

function label(i: Intent) {
  return {
    point: `steer ${i.dir}`,
    pinch: "pinch → fork",
    palm: "palm → play/pause",
    fist: "fist (idle)",
    none: "no hand",
  }[i.gesture];
}

function drawSignal(canvas: HTMLCanvasElement | null, video: HTMLVideoElement, lm: Landmark[] | null, intent: Intent) {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  const { width: w, height: h } = canvas;
  const P = palette();
  ctx.save();
  // Mirror so it reads like a mirror.
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.globalAlpha = 0.35;
  ctx.drawImage(video, 0, 0, w, h);
  ctx.globalAlpha = 1;
  if (lm) {
    ctx.strokeStyle = withAlpha(P.accent, 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [a, b] of CONNECTIONS) {
      ctx.moveTo(lm[a].x * w, lm[a].y * h);
      ctx.lineTo(lm[b].x * w, lm[b].y * h);
    }
    ctx.stroke();
    ctx.fillStyle = P.ink;
    for (const p of lm) ctx.fillRect(p.x * w - 1.5, p.y * h - 1.5, 3, 3);
    if (intent.gesture === "pinch") {
      ctx.strokeStyle = P.ok;
      ctx.beginPath();
      ctx.arc(lm[8].x * w, lm[8].y * h, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
