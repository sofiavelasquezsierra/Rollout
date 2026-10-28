# Rollout

A debugger for an AI agent acting in a simulated world. Watch the agent act, scrub the
timeline, fork the world at any frame, redirect the agent in natural language, inspect its
reasoning, and compare branches scored by a separate evaluator.

It's one link with three pages: **`/`** the demo, **`/case-study`** the design write-up, and
**`/resume`** the resume viewer.

> The world is a stylized, deterministic gridworld — not a Runway model and not a learned
> world model. The agent and the evaluator are real Claude calls (with labeled fallbacks).

## Run it

```bash
npm install
cp .env.example .env.local     # optional: add ANTHROPIC_API_KEY for live runs
npm run dev                    # http://localhost:3000
```

Without an API key everything still works: the demo opens on bundled example runs, new
rollouts use the scripted policy, and scores come from a labeled heuristic.

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest: simulator, replay equivalence, run log, examples, server helpers |
| `npm run check` | typecheck + lint + tests |
| `npm run record:examples` | Re-record `src/examples/*.json` with the scripted policy (deterministic) |
| `npm run record:examples -- --live` | Record with the live Claude agent + evaluator (needs `ANTHROPIC_API_KEY`) |

### Environment

| Variable | Default | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Server-only. Never exposed to the client. |
| `ROLLOUT_AGENT_MODEL` | `claude-haiku-5-5` | Fast, cheap control loop. |
| `ROLLOUT_EVALUATOR_MODEL` | `claude-sonnet-5-5` | Judgement; called rarely. |
| `NEXT_PUBLIC_SITE_URL` | Vercel URL or localhost | Absolute URLs for Open Graph. |
| `NEXT_PUBLIC_FEATURE_HAND` | `0` | Phase 2 hand-control mode. |

### Assets you add

- `public/resume.pdf` — the resume page shows a designed placeholder until it exists.
- `public/walkthrough.mp4` (+ optional `public/walkthrough.vtt`) — the walkthrough modal does the same.
- Case study `TODO` blocks — role, timeline, name, usability findings, sketches.

## Architecture

```
src/
  sim/          pure deterministic simulator (no DOM, no clock, no Math.random)
  store/        event-log run model, derived state, Zustand store + playback/agent loop
  agent/        client decide() (scripted | Claude via SSE), evaluation, headless driver
  server/       server-only: env, prompts, zod schemas, rate limiter, Claude calls
  app/api/      /agent (SSE), /evaluate, /status
  components/   demo/ (debugger UI), site/ (nav, case study, resume), ui/ (primitives)
  examples/     scenario scripts + recorded runs (JSON)
  styles/       design tokens
```

**Simulator.** `step(state, action) → state` is pure. The mulberry32 RNG state lives inside
`WorldState`, so a snapshot at any tick is self-contained: serialize it, resume it anywhere,
get the same future. Tests assert replay equivalence (resuming from frame N — in memory and
across a serialize/deserialize boundary — equals a full replay) over many random sequences.

**Event log.** A run is `{ branches, order }`; a branch is
`{ parentId, forkFrame, actions[], events[] }` where events are agent decisions and director
instructions. World state is never stored — `stateAt(run, branch, frame)` replays the
branch's lineage through a `ReplayCache` that keeps a snapshot every 16 frames. Forking is
adding a pointer; rename and jump touch metadata only.

**Agent loop.** Pressing play replays recorded frames; at the head of an unfinished branch
the agent acts. When its plan is empty the client POSTs the state, the instructions in
effect, and the last three decisions to `/api/agent`. The route validates (zod + byte cap),
rate-limits per IP, and calls Claude with a structured-output schema
(`{ reasoning, actions[3..5] }`, `max_tokens` 400, 20 s timeout), streaming the reasoning
field back as Server-Sent Events. Any failure — no key, 429, timeout, refusal, invalid JSON —
returns a `fallback` event and the client runs the scripted planner, labeling the decision.

**Director.** An instruction is an event at the head frame and clears the pending plan, so
the next agent call sees it. If the playhead is in the past, the redirect forks a new branch
there instead of rewriting history.

**Evaluator.** `/api/evaluate` is a different model and prompt: Claude Sonnet scores a
branch summary on progress, efficiency and safety (0–10 each, with rationales) using
structured output and server-side refusal fallbacks. Without a key it falls back to a
deterministic heuristic implementing the same rubric, labeled “heuristic”. Scores record the
frame they were computed at and show as stale if the branch grows.

**Examples.** `src/examples/scenarios.ts` describes runs as scripts (run, fork, direct);
`record:examples` plays them through the same headless driver and writes event logs that
ship in the bundle (~45 KB). A test re-derives every scripted decision to catch drift.

## Design decisions

- **Time is the primary axis.** Timeline + scrubber are the main instrument; branches are a
  compact git-style graph, not a canvas of thumbnails.
- **History is immutable.** Redirecting from the past forks. Switching branches keeps the
  playhead so “same moment, other choice” is one keystroke (`[` / `]`).
- **Honest labels everywhere.** Each decision shows its source (Claude model + latency,
  scripted, or fallback with the reason); examples say how they were recorded; the
  “How this works” dialog states what is simulated.
- **Tokens first.** `src/styles/tokens.css` defines color, type, spacing, radius and motion;
  Tailwind's default palette and type scale are disabled so only token utilities exist.
  Canvas reads the same CSS variables through `src/lib/tokens.ts`.
- **Type.** Instrument Sans (UI), JetBrains Mono (data), Instrument Serif (editorial).
- **Motion with purpose.** Fork flash, branch growth, playhead and agent tweening; all
  durations come from tokens and drop to zero under `prefers-reduced-motion` (which also
  disables the first-visit autoplay and the canvas tweening).
- **Keyboard.** Space play/pause · ←/→ step (⇧ ×10) · Home/End · F fork · R rename ·
  [ ] switch branch · / director · C compare · ? shortcuts. Ignored while typing.

## Dependencies

| Package | Why it's here |
|---|---|
| `next`, `react`, `react-dom` | App Router pages + server route handlers that hold the API key. |
| `tailwindcss` | Utility CSS generated from our own design tokens; default palette disabled. |
| `zustand` | ~1 KB store for the event log and UI state; no provider boilerplate. |
| `zod` | Validates every route input and the model's JSON output; drives structured outputs. |
| `@anthropic-ai/sdk` | Streaming Claude calls for the agent and evaluator (server-only). |
| `@mediapipe/tasks-vision` | Phase 2 hand tracking. Loaded with a dynamic import only after the flag is on **and** the user enables the camera; its WASM (jsDelivr, pinned 1.2.0) and model (Google storage) are fetched at that moment. |
| `vitest` _(dev)_ | Fast unit tests for the simulator and run model. |
| `tsx` _(dev)_ | Runs the TypeScript example recorder script. |

No component library, no icon library, no animation library, no canvas/3D library.
`next/og` (built in) renders the social card; `next/font` self-hosts the fonts.

## Phase 2: hand control (feature-flagged)

Set `NEXT_PUBLIC_FEATURE_HAND=1` and restart. A **Hand** button appears in the run header and
opens a panel — clearly labeled as a stand-in for sEMG wristband input — showing the raw
signal (mirrored camera + tracked landmarks) beside the inferred intent:

| Gesture | Intent |
|---|---|
| Point with the index finger | Steer: N / S / E / W at the head of the branch (replaces the policy; logged as `hand` decisions) |
| Pinch | Fork the world at the playhead (once per pinch, 1.2 s cooldown) |
| Hold an open palm | Play / pause (after 650 ms) |

The camera is strictly opt-in, frames are processed on-device, and stopping releases the
camera. Landmark → intent mapping lives in `src/hand/intent.ts` as pure functions with a
temporal filter, unit-tested with synthetic hands, so another sensor (e.g. an sEMG decoder)
could produce the same `Intent` stream.

## Testing

`npm test` covers: RNG purity; step semantics (walls, pickup, hazards, outcomes,
immutability, drift bounds, timeout); serialize round-trip and canonical form; replay
equivalence across 15 random sequences × 9 cut points, including through serialization;
`ReplayCache` vs. naive replay; the scripted policy solving every level under each
instruction; run-log fork/inheritance semantics; bundled example consistency and
reproducibility; partial-JSON reasoning extraction; rate limiter; request schemas; prompts;
hand-gesture classification and filtering; hand steering through the playback loop.

Routes were checked by hand: no key → `fallback` event; malformed JSON → 400; bad shape →
400 with issues; burst of 24 → 20× 200 then 429 with `Retry-After`.

## Known limitations

- **No live verification in this repo's history.** The Claude code paths are unit-tested at
  their seams and were exercised through every fallback, but the bundled examples were
  recorded with the scripted policy. Run `npm run record:examples -- --live` with a key to
  record Claude runs.
- **Rate limiting is in-memory.** It resets on cold start and isn't shared across serverless
  instances. A shared store (e.g. Upstash Redis) would fix this.
- **The evaluator is an LLM judge**, not ground truth; rationales are shown so scores can
  be challenged. The heuristic fallback is a simple formula.
- **The world is a toy.** 24×16 grid, discrete actions, one agent. It exists to make the
  interface ideas testable, not to model anything.
- **State lives in the tab.** Runs are not persisted or shareable by URL yet.
- **Tablet is the floor.** Layout is designed down to 768 px; phones get a usable but
  cramped stacked view.
- **Hand control (Phase 2)** depends on webcam access and lighting, and is a stand-in for
  sEMG input, not an equivalent.
