"use client";

import Link from "next/link";
import { useRollout } from "@/store/useRollout";
import { Badge, Label } from "@/components/ui/primitives";

/** The honesty panel: what is real, what is stylized, and where each decision comes from. */
export function HowItWorks() {
  const live = useRollout((s) => s.live);
  return (
    <div className="space-y-5 text-13 leading-relaxed text-ink-2">
      <p className="text-15 text-ink">
        Rollout is a design prototype of a debugger for agents acting inside generated worlds. Everything you see runs
        on a deliberately small stand-in world so the <em>interface</em> ideas — scrubbing, forking, redirecting,
        evaluating — can be tried end to end.
      </p>

      <dl className="space-y-4">
        <Row title="The world" tag="stylized simulator">
          A 24×16 gridworld simulated in TypeScript in your browser — <strong className="text-ink">not a Runway model</strong> and
          not a learned world model. It is fully deterministic (seeded RNG stored in the state), so any frame can be
          serialized, forked and replayed to an identical result.
        </Row>
        <Row title="The agent" tag={live?.agentModel ?? "Claude"}>
          Every few frames the world state is sent to a server route, which calls Claude and streams back structured
          JSON: the next 3–5 actions plus a one-sentence rationale. The API key stays on the server. When there is no
          key, the route is rate limited, or a call fails, a deterministic scripted planner takes over and each decision
          is labeled with its source.
        </Row>
        <Row title="The evaluator" tag={live?.evaluatorModel ?? "Claude"}>
          A separate Claude call with its own prompt and model scores each branch on progress, efficiency and
          constraint violations, and explains the score. Without a key, a heuristic that implements the same rubric is
          used and labeled “heuristic”.
        </Row>
        <Row title="The examples" tag="recorded">
          The runs that load first are recorded event logs bundled with the page, so nothing needs to be called to see a
          rich result. Their header says how they were recorded. “Run live” starts a fresh rollout against the real API.
        </Row>
      </dl>

      <div className="flex items-center gap-2 rounded-md border border-line p-3">
        <span
          className={`size-2 rounded-full ${live === null ? "bg-ink-3" : live.available ? "bg-ok" : "bg-hazard/70"}`}
          aria-hidden
        />
        <span>
          {live === null
            ? "Checking whether live Claude calls are available…"
            : live.available
              ? "Live Claude calls are available on this deployment."
              : "This deployment has no API key: live calls are off, and the scripted policy and heuristic evaluator are used."}
        </span>
      </div>

      <p>
        Design rationale, rejected directions and architecture are in the{" "}
        <Link href="/case-study" className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
          case study
        </Link>
        .
      </p>
    </div>
  );
}

function Row({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 max-sm:grid-cols-1">
      <dt className="space-y-1">
        <Label className="block">{title}</Label>
        <Badge>{tag}</Badge>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
