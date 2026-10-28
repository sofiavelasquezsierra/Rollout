/** Agent / evaluator architecture, drawn with tokens so it matches the app. */
export function ArchitectureDiagram() {
  const box = "rounded-xl border border-[var(--c-glass-line)] bg-white/[0.03] px-3 py-2.5";
  return (
    <figure className="not-prose my-2">
      <div className="glass grid gap-3 rounded-2xl p-4 text-13 md:grid-cols-[1.25fr_auto_1fr] md:items-stretch">
        <div className="space-y-2 rounded-xl border border-[var(--c-glass-line)] p-3">
          <p className="font-mono text-12 uppercase tracking-[0.12em] text-ink-3">Browser (simulation + 3D view)</p>
          <div className={box}>
            <p className="text-ink">Simulator</p>
            <p className="text-12 text-ink-3">pure step(state, action) · seeded RNG in state</p>
          </div>
          <div className={box}>
            <p className="text-ink">Event log</p>
            <p className="text-12 text-ink-3">branches = pointers {"{parent, forkFrame}"} + actions + events</p>
          </div>
          <div className={box}>
            <p className="text-ink">Replay cache</p>
            <p className="text-12 text-ink-3">snapshot every 16 frames → any frame in ≤16 steps</p>
          </div>
          <div className={`${box} border-dashed`}>
            <p className="text-ink">Scripted policy</p>
            <p className="text-12 text-ink-3">deterministic fallback agent · records the examples</p>
          </div>
        </div>

        <div className="flex flex-row items-center justify-center gap-2 font-mono text-12 text-ink-3 md:flex-col">
          <span>state + instructions →</span>
          <span className="text-accent">← SSE: reasoning, plan</span>
          <span className="mt-2">branch summary →</span>
          <span className="text-accent">← rubric scores</span>
        </div>

        <div className="space-y-2 rounded-xl border border-[var(--c-glass-line)] p-3">
          <p className="font-mono text-12 uppercase tracking-[0.12em] text-ink-3">Server routes (hold the key)</p>
          <div className={`${box} border-accent/40`}>
            <p className="text-ink">/api/agent</p>
            <p className="text-12 text-ink-3">Claude Haiku · structured JSON · streamed · 400 tok cap</p>
          </div>
          <div className={`${box} border-accent/40`}>
            <p className="text-ink">/api/evaluate</p>
            <p className="text-12 text-ink-3">Claude Sonnet · separate prompt + rubric</p>
          </div>
          <div className={box}>
            <p className="text-ink">Guards</p>
            <p className="text-12 text-ink-3">zod validation · per-IP token bucket · timeouts · graceful fallback</p>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-12 text-ink-3">
        The world never leaves the browser except as a JSON observation. Every failure path lands on the scripted
        policy or a labeled heuristic, so the interface never stalls.
      </figcaption>
    </figure>
  );
}
