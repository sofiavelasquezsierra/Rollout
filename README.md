# Rollout

A debugger for an AI agent acting in a simulated world. Watch the agent act, scrub the
timeline, fork the world at any frame, redirect the agent in natural language, inspect its
reasoning, and compare branches scored by a separate evaluator.

> Status: in active development. Sections marked _(WIP)_ are filled in as phases land.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for live runs
npm run dev                  # http://localhost:3000
npm test                     # simulator unit tests
```

Without an API key everything still works: the demo loads cached example runs and new
rollouts use the scripted fallback policy.

## Architecture _(WIP)_

## Dependencies

| Package | Why it's here |
|---|---|
| `next`, `react`, `react-dom` | App Router pages + server route handlers that hold the API key. |
| `tailwindcss` | Utility CSS generated from our own design tokens; default palette is disabled. |
| `zustand` | ~1 KB store for the event log and UI state; no provider boilerplate. |
| `zod` | Validates every route input and the model's JSON output. |
| `@anthropic-ai/sdk` | Streaming Claude calls for the agent and evaluator (server-only). |
| `vitest` _(dev)_ | Fast unit tests for the deterministic simulator. |

## Known limitations _(WIP)_
