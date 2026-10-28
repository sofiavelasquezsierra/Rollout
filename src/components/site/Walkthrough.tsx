"use client";

import { useEffect, useState } from "react";

const SRC = "/walkthrough.mp4";

/** 60-second walkthrough slot. Shows a designed placeholder until public/walkthrough.mp4 exists. */
export function Walkthrough() {
  const [state, setState] = useState<"checking" | "ready" | "missing">("checking");

  useEffect(() => {
    let alive = true;
    fetch(SRC, { method: "HEAD" })
      .then((r) => alive && setState(r.ok && (r.headers.get("content-type") ?? "").startsWith("video") ? "ready" : "missing"))
      .catch(() => alive && setState("missing"));
    return () => {
      alive = false;
    };
  }, []);

  if (state === "ready") {
    return (
      <video
        src={SRC}
        controls
        autoPlay
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded-md border border-line bg-bg"
        onError={() => setState("missing")}
      >
        <track kind="captions" src="/walkthrough.vtt" srcLang="en" label="English" default />
      </video>
    );
  }

  return (
    <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-md border border-dashed border-line-strong bg-bg text-center">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40 [background-image:radial-gradient(var(--c-world-grid)_1px,transparent_1px)] [background-size:16px_16px]"
      />
      <span className="relative font-mono text-12 uppercase tracking-[0.14em] text-ink-3">
        {state === "checking" ? "Loading…" : "Walkthrough coming soon"}
      </span>
      {state === "missing" && (
        <p className="relative max-w-sm px-4 text-13 text-ink-2">
          A 60-second narrated tour of scrubbing, forking, redirecting and comparing. Meanwhile, the demo below is fully
          interactive — press <span className="font-mono text-ink">Space</span> to start.
        </p>
      )}
      {/* TODO(author): add public/walkthrough.mp4 (and optional public/walkthrough.vtt captions). */}
    </div>
  );
}
