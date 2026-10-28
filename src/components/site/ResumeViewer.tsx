"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

const SRC = "/resume.pdf";

/** Embedded PDF with a designed fallback while public/resume.pdf is missing. */
export function ResumeViewer() {
  const [state, setState] = useState<"checking" | "ready" | "missing">("checking");

  useEffect(() => {
    let alive = true;
    fetch(SRC, { method: "HEAD" })
      .then((r) => alive && setState(r.ok && (r.headers.get("content-type") ?? "").includes("pdf") ? "ready" : "missing"))
      .catch(() => alive && setState("missing"));
    return () => {
      alive = false;
    };
  }, []);

  if (state === "ready") {
    return (
      <object
        data={`${SRC}#view=FitH`}
        type="application/pdf"
        aria-label="Resume (PDF)"
        className="h-[min(1100px,calc(100dvh-220px))] min-h-[560px] w-full rounded-lg border border-line bg-surface-1"
      >
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-13 text-ink-2">
          <p>Your browser can’t display PDFs inline.</p>
          <a href={SRC} className="text-accent underline underline-offset-4">
            Open the resume in a new tab
          </a>
        </div>
      </object>
    );
  }

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface-1 p-8 text-center">
      <Icon name="download" size={20} className="text-ink-3" />
      <p className="font-mono text-12 uppercase tracking-[0.14em] text-ink-3">
        {state === "checking" ? "Loading resume…" : "Resume coming soon"}
      </p>
      {state === "missing" && (
        <p className="max-w-sm text-13 text-ink-2">
          {/* TODO(author): add public/resume.pdf */}
          The PDF hasn’t been uploaded yet. <span className="text-accent">TODO:</span> add <code className="font-mono">public/resume.pdf</code>.
        </p>
      )}
    </div>
  );
}
