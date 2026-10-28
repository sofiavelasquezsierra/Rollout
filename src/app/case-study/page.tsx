import type { Metadata } from "next";
import { socialMeta } from "@/lib/site";
import Link from "next/link";
import { ArchitectureDiagram } from "@/components/site/ArchitectureDiagram";
import { HeroWorlds } from "@/components/site/HeroWorlds";
import { Decision, Pull, Rejected, Section } from "@/components/site/Prose";

const DESCRIPTION =
  "Designing Rollout: the problem, the user, rejected directions, key interaction decisions, and the agent/evaluator architecture.";

export const metadata: Metadata = {
  ...socialMeta("Rollout — case study", DESCRIPTION),
  title: "Case study",
  description: DESCRIPTION,
};

const TOC = [
  ["fit", "Why Runway Labs"],
  ["problem", "The problem"],
  ["user", "Who it’s for"],
  ["constraints", "Constraints"],
  ["rejected", "Rejected directions"],
  ["decisions", "Interaction decisions"],
  ["architecture", "Architecture"],
  ["real", "Mocked vs. real"],
  ["testing", "Testing"],
  ["next", "What I’d build next"],
] as const;

export default function CaseStudyPage() {
  return (
    <article className="mx-auto w-full max-w-[1120px] px-4 pb-24 md:px-6">
      {/* Hero */}
      <header className="pb-10 pt-28 text-center md:pt-36">
        <p className="font-mono text-12 uppercase tracking-[0.14em] text-accent">Case study · Design engineering</p>
        <HeroWorlds />
        <h1 className="mx-auto mt-2 max-w-4xl font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1.0] text-ink">
          Rollout: parallel worlds <span className="text-ink-3">for debugging agents</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-18 leading-relaxed text-ink-2">
          When an agent acts inside a world model, the interesting question is rarely “what happened?” — it’s “what would
          have happened if…?”. Rollout is an interface for asking that question directly: scrub any rollout, fork the
          world at any frame, redirect the agent in plain language, and let a separate evaluator compare the branches.
        </p>
        <dl className="glass mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-6 rounded-2xl p-6 text-left text-13 md:grid-cols-4">
          <Meta k="Role">
            <span className="text-accent">TODO</span> — e.g. design + front-end, solo
          </Meta>
          <Meta k="Timeline">
            <span className="text-accent">TODO</span>
          </Meta>
          <Meta k="Built with">Next.js, TypeScript, three.js, Claude API</Meta>
          <Meta k="Try it">
            <Link href="/" className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
              Open the demo →
            </Link>
          </Meta>
        </dl>
      </header>

      <div className="grid gap-12 lg:grid-cols-[1fr_200px]">
        <div className="min-w-0">
          <Section id="fit" n="00" title="Why this, for Runway Labs">
            <p>
              Runway Labs is exploring interfaces for AI video, general world models and agentic systems — tools that let
              researchers and creatives direct those systems in real time. GWM-1’s robotics work frames simulation as a
              place to run policies, evaluate them, and generate counterfactual trajectories. Rollout is a working
              prototype of the interface layer for exactly that loop, on a small stand-in world.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-13">
                <thead>
                  <tr className="border-b border-line-strong text-left">
                    <th className="w-[38%] py-2 pr-4 font-mono text-12 font-normal uppercase tracking-[0.12em] text-ink-3">The role asks for</th>
                    <th className="py-2 font-mono text-12 font-normal uppercase tracking-[0.12em] text-ink-3">Where it shows up in Rollout</th>
                  </tr>
                </thead>
                <tbody className="text-ink-2">
                  {[
                    [
                      "Agentic tools for directing AI systems in real time",
                      "A Claude agent reasons over world state and acts every few frames; you redirect it in plain language mid-run, and each instruction becomes an event on the timeline.",
                    ],
                    [
                      "New interaction paradigms for world models and simulation",
                      "Counterfactuals as the core verb: split the world at any frame, and every branch lives beside its parent at the same moment, so “same state, different choice” is visible without asking for it.",
                    ],
                    [
                      "Research tooling",
                      "Deterministic replay from any frame, a separate evaluator with a fixed rubric, scorecards that mark themselves stale, and a label on every decision and score saying where it came from.",
                    ],
                    [
                      "Stretching front-end engineering",
                      "A real-time three.js renderer — physically based materials, soft shadows, a tilt-shift lens pass — with HTML pinned to 3D anchors, a 2D fallback, and streaming server routes with rate limits and graceful fallback.",
                    ],
                    [
                      "Visual and interaction design, and usability testing",
                      "Four directions explored and four built iterations, each changed by a specific critique (section 04). Section 08 is candid about what has been tested so far and lays out the study I’d run next.",
                    ],
                  ].map(([a, b]) => (
                    <tr key={a} className="border-b border-line align-top">
                      <td className="py-2.5 pr-4 text-ink">{a}</td>
                      <td className="py-2.5">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              My research has been on the input side of directing machines — reading intent from the body through an sEMG
              wristband. Rollout is the other side of that loop: once a system acts, how do you see what it did, ask
              “what if?”, and steer it again? Runway Labs is one of very few places where world models, agents and the
              interfaces for directing them are built together, by people who treat the interface as part of the
              research. That is the work I want to do. The first thing I’d want to explore is what forking feels like
              when the world is generated rather than simulated — when a branch point is a real conditioning state, and
              the futures you compare are frames the model actually produced.
            </p>
          </Section>

          <Section id="problem" n="01" title="Agents in world models are hard to interrogate">
            <p>
              A generated world turns an agent’s behaviour into a long, continuous rollout. When something goes wrong — the
              agent walks through a hazard, ignores an instruction, takes the long way round — the usual tools give you a
              video and a log. To test a hypothesis you re-run from scratch, change one thing, and try to remember what the
              last run looked like.
            </p>
            <p>
              That loop is slow, and it hides the structure of the question being asked. Debugging an agent in a world is
              counterfactual by nature: <strong className="font-medium text-ink">same world, same moment, different choice.</strong> The interface should make
              that the primitive, not an afterthought.
            </p>
            <Pull>Time is the primary axis. Branching is the primary verb.</Pull>
            <p>Rollout bets on three ideas:</p>
            <ul className="list-disc space-y-2 pl-5 marker:text-ink-3">
              <li>
                <strong className="text-ink">The world is replayable.</strong> If state at any frame can be serialized and
                resumed exactly, scrubbing is free and forking is just a pointer.
              </li>
              <li>
                <strong className="text-ink">Direction is conversation-shaped, but anchored in time.</strong> A
                natural-language redirect is an event on the timeline, not a message in a chat log.
              </li>
              <li>
                <strong className="text-ink">Judgement is separate from action.</strong> A different model scores the
                outcome against a fixed rubric, so you compare branches on the same terms.
              </li>
            </ul>
          </Section>

          <Section id="user" n="02" title="Who it’s for">
            <p>
              <strong className="text-ink">A researcher evaluating an agent or a world model.</strong> They care about
              failure modes, reproducibility and comparisons they can defend. They want to point at frame 42 and say
              “here — this is where it decided to cut through the caution zone,” then show what the alternative would have
              been.
            </p>
            <p>
              <strong className="text-ink">A creative directing a generated scene.</strong> They think in shots and
              beats, not reward functions. They want to steer (“collect the nearest object first”, “stay out of the
              light”), keep the takes they like, and compare versions side by side without losing any of them.
            </p>
            <p>
              Both share a need for a <strong className="font-medium text-ink">safe past</strong>: nothing they try should overwrite something they’ve already
              seen.
            </p>
            <p>
              <strong className="font-medium text-ink">How solid are these?</strong> They are working hypotheses, not
              research findings. They are drawn from three places: how Runway describes this work in public — directing AI
              in real time, and using world models to evaluate robot policies and generate counterfactual trajectories; my
              own research practice, where comparing one run against another is a constant task; and the shape of
              tools researchers already rely on, such as experiment trackers and replay debuggers. I haven’t interviewed
              people in either group yet. Checking these two personas is the first job of the study in section 08.
            </p>
          </Section>

          <Section id="constraints" n="03" title="Constraints">
            <ul className="list-disc space-y-3 pl-5 marker:text-ink-3">
              <li>
                <strong className="text-ink">Determinism or nothing.</strong> Forking only means something if replaying
                the same actions from the same state gives the same world. The simulator stores its RNG state inside the
                world state and is covered by replay-equivalence tests.
              </li>
              <li>
                <strong className="text-ink">Model latency in a real-time loop.</strong> An LLM decision takes hundreds
                of milliseconds or more. The agent plans 3–5 actions per call and streams its reasoning, so the world keeps
                moving and the wait is legible.
              </li>
              <li>
                <strong className="text-ink">A public link has a budget.</strong> Calls go through server routes that
                validate input, rate-limit per IP, and cap tokens and steps. The demo must be fully usable with no key at
                all.
              </li>
              <li>
                <strong className="text-ink">Honesty about the stand-in.</strong> The world is a stylized gridworld, not a
                world model. The UI says so, and labels every decision and score with where it came from.
              </li>
              <li>
                <strong className="text-ink">Keyboard-first, down to tablet.</strong> Scrubbing and forking are
                high-frequency actions — Space, arrows and F must be enough.
              </li>
            </ul>
          </Section>

          <Section id="rejected" n="04" title="Directions I didn’t take">
            <Rejected
              name="Chat-first agent console"
              idea="The agent’s reasoning and the director’s instructions as a conversation, with the world as an attachment that updates under each message."
              why="It made the transcript the source of truth and pushed time into the background. Questions like “what did the world look like when I said that?” became scrolling exercises, and branching a conversation is a poor model for branching a world."
            />
            <Rejected
              name="Multi-track editor timeline"
              idea="An NLE-style timeline with stacked tracks per signal — position, reward, violations, instructions — and branches as alternate takes in a bin."
              why="Dense and familiar to editors, but branches aren’t takes: they share a prefix and diverge at a point. Tracks hid that shared history, and the density worked against the calm, scannable view a researcher needs mid-investigation."
            />
            <Rejected
              name="Canvas of state thumbnails"
              idea="An infinite canvas where every decision is a node with a world thumbnail, laid out as a tree you pan and zoom."
              why="Excellent overview, poor instrument. Fine-grained scrubbing — the most frequent action — needs a linear axis, and a tree of thumbnails hides that every branch is the same world at a different moment."
            />
            <Rejected
              name="Instrument-panel dashboard (built, then replaced)"
              idea="The first complete version: a three-column debugger — git-style branch graph on the left, a flat top-down world in the middle, an inspector on the right, a dense timeline underneath."
              why="Every feature was there, but it read as a tool you have to learn before it shows you anything, and the core idea — same world, different futures — was buried in panels. The rebuild makes that idea the space itself: branches become parallel worlds side by side, and the panels collapse into one dock."
            />
            <h3 className="pt-4 font-display text-24 leading-tight text-ink">How the built version evolved</h3>
            <p>
              Four versions were built end to end. Each one was reviewed against the same question — does a first-time
              visitor grasp “same world, different futures” within a few seconds? — and each review produced one
              specific change.
            </p>
            <ol className="space-y-4">
              {[
                [
                  "v1 · Instrument panel",
                  "Branch graph, flat top-down canvas, inspector, dense timeline. Warm amber accent, serif headlines.",
                  "Complete but slow to read: you had to learn the tool before it showed you anything.",
                  "Rebuilt around the idea itself: every branch became a world of its own, side by side in 3D.",
                ],
                [
                  "v2 · Parallel worlds",
                  "three.js scene with a world per branch, a camera that flies between them, and a single glass dock in place of the panels.",
                  "The idea landed, but the visual language — warm palette, serif display face — read as borrowed from an existing AI product rather than its own.",
                  "A monochrome system: black space, white type, gray steps, white pill actions. Colour is kept for meaning only — hazard, goal, branch identity.",
                ],
                [
                  "v3 · Monochrome",
                  "Same interactions, a stricter visual system: Geist throughout, two-tone headlines, no decorative colour.",
                  "Clean, but the worlds were abstract glowing shapes. They didn’t look like anything a robotics or world-model researcher evaluates.",
                  "A realistic robot test bay, plus a matching vocabulary.",
                ],
                [
                  "v4 · Robot test bay",
                  "Physically based materials, light pools and soft shadows, a tilt-shift lens. Crystals became parcels, red zones became caution zones with cones, and the goal became a charging dock.",
                  "The scenario now reads as policy evaluation in simulation. Realism raised a new risk: people might take it for generated video.",
                  "Explicit labels everywhere: a stylized simulator, not generated video, not a Runway model.",
                ],
              ].map(([v, what, critique, change]) => (
                <li key={v} className="glass rounded-xl p-4 text-15">
                  <p className="font-mono text-12 uppercase tracking-[0.12em] text-ink">{v}</p>
                  <p className="mt-2">{what}</p>
                  <p className="mt-2">
                    <span className="text-ink-3">Critique — </span>
                    {critique}
                  </p>
                  <p className="mt-1">
                    <span className="text-ink-3">Change — </span>
                    {change}
                  </p>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="decisions" n="05" title="Key interaction decisions">
            <div className="space-y-4">
              <Decision
                title="Redirecting the past forks; it never rewrites"
                chose="If the playhead is in the past, telling the agent something first splits a new world at that frame and applies the instruction there. The prompt’s button reads “Split + tell” before you commit."
                tradeoff="More branches accumulate. In exchange, history is immutable: every frame you have seen stays reachable, which is what makes comparisons trustworthy."
              />
              <Decision
                title="Play at the head means “keep going”"
                chose="One transport. Pressing play replays recorded frames; when the playhead reaches the head of an unfinished branch, the agent starts acting and the time arc grows."
                tradeoff="Generating is implicit, and live calls cost money. The status line switches to “● live”, decisions are labeled by source, and steps are capped per branch."
              />
              <Decision
                title="Every world lives at the same moment"
                chose="All worlds are always shown at the same frame. Scrubbing moves them together; [ / ] flies the camera between them; O pulls back to see them all."
                tradeoff="Worlds that already finished sit still while others keep going — but “same moment, other choice” is visible without any interaction."
              />
              <Decision
                title="Branches are places, not rows"
                chose="Each branch is its own test bay on the lab floor, beside its parent; splitting visibly pushes a new bay out of the old one, and the camera follows it."
                tradeoff="Space is finite: past five or six worlds the overview gets small. The focus view keeps the active world large, with neighbours peeking in at the edges."
              />
              <Decision
                title="Evaluation is a separate act, and it can go stale"
                chose="Scores come from a separate evaluator call against a fixed rubric (progress, efficiency, safety). In the overview, a scorecard floats under each world; a score is marked stale if its world grows after scoring."
                tradeoff="An extra step before comparing, and an LLM judge is not ground truth — so rationales are always visible next to the numbers."
              />
              <Decision
                title="Instructions are events on the timeline"
                chose="An instruction is a diamond marker on the time arc where it took effect, inherited by worlds split later. The agent answers in a thought bubble floating beside it in the world."
                tradeoff="There is no free-form back-and-forth with the agent; it explains itself through one-sentence rationales per decision instead."
              />
            </div>
          </Section>

          <Section id="architecture" n="06" title="Agent and evaluator architecture">
            <p>
              The run is an <strong className="text-ink">append-only event log</strong>. A branch is{" "}
              <code className="rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-13 text-ink">{"{ parentId, forkFrame, actions[], events[] }"}</code>
              . World state is never stored: it is derived by replaying a branch’s lineage from the level’s initial
              state, with a snapshot every 16 frames so any frame costs at most 16 simulation steps.
            </p>
            <ArchitectureDiagram />
            <p>
              Every few frames the client sends the current state, the instructions in effect, and the last few decisions
              to <code className="font-mono text-13 text-ink">/api/agent</code>. The route asks Claude Haiku for
              schema-constrained JSON — a short rationale followed by the next 3–5 actions — and streams the rationale to
              the inspector as it is written. The first live runs showed Haiku couldn’t reliably navigate an ASCII map:
              dozens of wall bumps per run. So the prompt now also carries wall-free routes from a path planner, both
              direct and caution-avoiding, and Claude makes the decision a researcher actually cares about — which
              target, and how much risk — rather than steering cell by cell. After the change, the bundled live runs
              have almost no wall bumps and every instruction is followed. The evaluator is a different route, model and prompt: Claude Sonnet scores a
              branch summary against the rubric and returns a rationale for each criterion.
            </p>
            <p>
              Any failure — no key, rate limit, timeout, refusal, invalid JSON — resolves to the deterministic scripted
              planner (for actions) or a heuristic implementing the same rubric (for scores). Both are labeled in the UI.
            </p>
          </Section>

          <Section id="real" n="07" title="What’s mocked, what’s real">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-13">
                <thead>
                  <tr className="border-b border-line-strong text-left">
                    <th className="py-2 pr-4 font-mono text-12 font-normal uppercase tracking-[0.12em] text-ink-3">Part</th>
                    <th className="py-2 pr-4 font-mono text-12 font-normal uppercase tracking-[0.12em] text-ink-3">Status</th>
                    <th className="py-2 font-mono text-12 font-normal uppercase tracking-[0.12em] text-ink-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="text-ink-2">
                  {[
                    ["World", "Stand-in", "A deterministic 24×16 gridworld, rendered as a robot test bay in three.js. Not generated video, not a learned world model and not a Runway model."],
                    ["Agent", "Real", "Claude calls via a server route, streamed. Falls back to a scripted planner when unavailable."],
                    ["Evaluator", "Real", "Separate Claude call and rubric. Falls back to a labeled heuristic."],
                    ["Example runs", "Recorded", "Bundled event logs; the header says whether they were recorded with Claude or the scripted policy."],
                    ["Fork / replay", "Real", "Exact replay from any frame, covered by unit tests."],
                    ["Hand control", "Prototype", "Phase 2, behind a flag: webcam hand tracking as a stand-in for sEMG wristband input."],
                  ].map(([a, b, c]) => (
                    <tr key={a} className="border-b border-line align-top">
                      <td className="py-2.5 pr-4 text-ink">{a}</td>
                      <td className="py-2.5 pr-4 font-mono text-12">{b}</td>
                      <td className="py-2.5">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="testing" n="08" title="Testing so far, and the study I’d run next">
            <p>
              <strong className="font-medium text-ink">No formal usability sessions have been run yet</strong>, so this
              section reports no participants, metrics or quotes. Here is what has been tested.
            </p>
            <ul className="list-disc space-y-2 pl-5 marker:text-ink-3">
              <li>
                <strong className="text-ink">Design reviews of each built version.</strong> The four critiques and
                changes in section 04 came from reviewing my own builds. They are design judgement, not user data.
              </li>
              <li>
                <strong className="text-ink">Correctness.</strong> Unit tests prove that replaying from any frame
                reproduces the world exactly, and check that every bundled run is internally consistent.
              </li>
              <li>
                <strong className="text-ink">Robustness.</strong> The routes reject malformed input, rate-limit bursts,
                and fall back to the scripted planner without breaking the UI, with or without an API key.
              </li>
              <li>
                <strong className="text-ink">Access.</strong> Every action works from the keyboard and has a visible
                focus state, reduced motion turns animation off, and the layout holds at 1440, 1024 and 768px. The demo
                falls back to 2D when WebGL isn’t available.
              </li>
            </ul>
            <h3 className="pt-4 font-display text-24 leading-tight text-ink">Planned study</h3>
            <p>
              Moderated, think-aloud sessions of about 30 minutes, with people who evaluate agents or models and people
              who direct generated media — one group for each persona. Tasks:
            </p>
            <ol className="list-decimal space-y-1.5 pl-5 marker:text-ink-3">
              <li>Find the frame where the robot first enters a caution zone.</li>
              <li>Show what would have happened if it had avoided that zone.</li>
              <li>Decide which of two worlds is better, and explain why to a colleague.</li>
              <li>Redirect the robot mid-run without losing the original.</li>
            </ol>
            <p>
              What I’d watch for: whether people discover that the past is safe (redirecting an earlier moment splits
              the world instead of overwriting it), whether the evaluator’s scores are trusted or second-guessed, and
              how long it takes before “split world” becomes the move people reach for first. Findings, with
              before-and-after screenshots, will replace this paragraph.
            </p>
          </Section>

          <Section id="next" n="09" title="What I’d build next at Runway Labs">
            <ul className="list-disc space-y-3 pl-5 marker:text-ink-3">
              <li>
                <strong className="text-ink">Swap the gridworld for real rollouts.</strong> Keep the event log and branch
                model; replace the rendered bay with action-conditioned generated frames, and make fork points real
                conditioning states of the world model — counterfactual generation as an interface.
              </li>
              <li>
                <strong className="text-ink">Branch diffs for video.</strong> Align two branches in time and highlight
                where — spatially and temporally — they diverge, instead of asking people to eyeball two players.
              </li>
              <li>
                <strong className="text-ink">Evaluators as instruments.</strong> Let researchers author and version
                rubrics, run several judges, and see disagreement between them as a first-class signal.
              </li>
              <li>
                <strong className="text-ink">Shared sessions.</strong> Comments pinned to frames and branches, so a team
                can argue about a moment rather than a screenshot.
              </li>
              <li>
                <strong className="text-ink">Embodied direction.</strong> Continuous, low-latency steering from the body —
                the hand-tracking prototype here stands in for sEMG wristband input from my research.
              </li>
            </ul>
          </Section>

          <footer className="border-t border-line pt-10 text-13 text-ink-3">
            <p>
              Built by <span className="text-accent">TODO (your name)</span>.{" "}
              <Link href="/resume" className="text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
                Resume
              </Link>{" "}
              · <span className="text-accent">TODO (email / links)</span>
            </p>
          </footer>
        </div>

        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-24">
            <p className="font-mono text-12 uppercase tracking-[0.14em] text-ink-3">On this page</p>
            <ol className="mt-3 space-y-1.5 text-13">
              {TOC.map(([id, label], i) => (
                <li key={id}>
                  <a href={`#${id}`} className="flex gap-2 text-ink-3 t-fast transition-colors hover:text-ink">
                    <span className="font-mono text-12 tabular">{String(i).padStart(2, "0")}</span>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
      </div>
    </article>
  );
}

function Meta({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-12 uppercase tracking-[0.12em] text-ink-3">{k}</dt>
      <dd className="mt-1.5 text-ink-2">{children}</dd>
    </div>
  );
}
