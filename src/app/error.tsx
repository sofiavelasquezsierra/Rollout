"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 pb-24 pt-32">
      <p className="font-mono text-12 uppercase tracking-[0.14em] text-hazard">Something broke</p>
      <h1 className="mt-3 text-24 font-medium">The debugger hit an unexpected error.</h1>
      <p className="mt-2 text-15 text-ink-2">
        The simulation is deterministic, so reloading restores the bundled example exactly. If it keeps happening, the
        case study and resume pages still work.
      </p>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={reset} className="h-9 rounded-md bg-accent px-4 text-13 font-medium text-accent-ink hover:brightness-110">
          Try again
        </button>
        <a href="/case-study" className="inline-flex h-9 items-center rounded-md border border-line-strong px-4 text-13 text-ink hover:bg-surface-2">
          Read the case study
        </a>
      </div>
    </section>
  );
}
