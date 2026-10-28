import type { ReactNode } from "react";

/** Editorial building blocks for the case study. */

export function Section({ id, n, title, children }: { id: string; n: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 border-t border-line py-14 first:border-t-0">
      <div className="grid gap-x-10 gap-y-4 md:grid-cols-[160px_1fr]">
        <p className="font-mono text-12 uppercase tracking-[0.14em] text-ink-3 md:pt-3">{n}</p>
        <div className="min-w-0">
          <h2 id={`${id}-h`} className="font-serif text-36 leading-[1.08] tracking-[-0.01em] text-ink">
            {title}
          </h2>
          <div className="prose-rollout mt-6 space-y-5 text-15 leading-[1.7] text-ink-2">{children}</div>
        </div>
      </div>
    </section>
  );
}

/**
 * A visible placeholder for content only the author can supply.
 * Also grep-able: every instance renders the literal text "TODO".
 */
export function Todo({ children, title = "TODO" }: { children: ReactNode; title?: string }) {
  return (
    <div role="note" className="rounded-md border border-dashed border-accent/60 bg-accent-soft px-4 py-3 text-13 leading-relaxed text-ink">
      <p className="mb-1 font-mono text-12 uppercase tracking-[0.14em] text-accent">{title}</p>
      <div className="space-y-2 text-ink-2">{children}</div>
    </div>
  );
}

export function Decision({ title, chose, tradeoff, children }: { title: string; chose: string; tradeoff: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-1 p-5">
      <h3 className="text-18 font-medium text-ink">{title}</h3>
      <dl className="mt-3 grid gap-3 text-13 leading-relaxed md:grid-cols-2">
        <div>
          <dt className="font-mono text-12 uppercase tracking-[0.12em] text-ok">Chose</dt>
          <dd className="mt-1 text-ink-2">{chose}</dd>
        </div>
        <div>
          <dt className="font-mono text-12 uppercase tracking-[0.12em] text-accent">Tradeoff</dt>
          <dd className="mt-1 text-ink-2">{tradeoff}</dd>
        </div>
      </dl>
      {children && <div className="mt-3 border-t border-line pt-3 text-13 text-ink-3">{children}</div>}
    </div>
  );
}

export function Rejected({ name, idea, why }: { name: string; idea: string; why: string }) {
  return (
    <div className="grid gap-2 border-l-2 border-line-strong py-1 pl-5">
      <h3 className="text-18 text-ink">
        <span className="mr-2 font-mono text-12 uppercase tracking-[0.12em] text-hazard">Rejected</span>
        {name}
      </h3>
      <p>{idea}</p>
      <p className="text-ink-3">
        <span className="text-ink-2">Why not: </span>
        {why}
      </p>
    </div>
  );
}

export function Pull({ children }: { children: ReactNode }) {
  return <p className="border-l-2 border-accent py-1 pl-5 font-serif text-24 italic leading-snug text-ink">{children}</p>;
}
