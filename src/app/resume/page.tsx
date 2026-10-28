import type { Metadata } from "next";
import { socialMeta } from "@/lib/site";
import { ResumeViewer } from "@/components/site/ResumeViewer";
import { Icon } from "@/components/ui/Icon";

const DESCRIPTION =
  "Resume — design engineer working on agentic interfaces and world models.";

export const metadata: Metadata = {
  ...socialMeta("Rollout — resume", DESCRIPTION),
  title: "Resume",
  description: DESCRIPTION,
};

export default function ResumePage() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-28 md:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-12 uppercase tracking-[0.14em] text-ink-3">Resume</p>
          <h1 className="mt-2 font-display text-36 leading-tight text-ink">
            {/* TODO(author): your name */}
            <span className="text-accent">TODO</span> — Design Engineer
          </h1>
        </div>
        <div className="flex gap-2">
          <a
            href="/resume.pdf"
            target="_blank"
            rel="noopener"
            className="glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-13 text-ink t-fast transition-colors hover:bg-white/5"
          >
            Open in new tab
          </a>
          <a
            href="/resume.pdf"
            download
            className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-15 font-medium text-accent-ink shadow-[0_0_30px_var(--c-glow)] t-fast transition-[filter] hover:brightness-110"
          >
            <Icon name="download" /> Download PDF
          </a>
        </div>
      </div>
      <ResumeViewer />
    </section>
  );
}
