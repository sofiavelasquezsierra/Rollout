import { describe, expect, it } from "vitest";
import { createWorld, stepMany } from "@/sim";
import { partialReasoning } from "../claude";
import { agentUserPrompt, renderMap } from "../prompts";
import { resetRateLimits, takeToken } from "../rate-limit";
import { AgentRequest } from "../schemas";

describe("partialReasoning", () => {
  it("extracts reasoning from incomplete streamed JSON", () => {
    expect(partialReasoning('{"reas')).toBeNull();
    expect(partialReasoning('{"reasoning": "Head ea')).toBe("Head ea");
    expect(partialReasoning('{"reasoning":"Say \\"hi\\" then')).toBe('Say "hi" then');
    expect(partialReasoning('{"reasoning":"line\\')).toBe("line");
    expect(partialReasoning('{"reasoning":"done.","actions":["N"]}')).toBe("done.");
  });
});

describe("rate limiter", () => {
  it("allows a burst, then refills over time, and enforces a daily cap", () => {
    resetRateLimits();
    const spec = { capacity: 3, refillPerSec: 1, dailyMax: 5 };
    const t = 1_000_000;
    expect([1, 2, 3].map(() => takeToken("t", "ip", spec, t).ok)).toEqual([true, true, true]);
    expect(takeToken("t", "ip", spec, t).ok).toBe(false);
    expect(takeToken("t", "other", spec, t).ok).toBe(true);
    expect(takeToken("t", "ip", spec, t + 1500).ok).toBe(true);
    expect(takeToken("t", "ip", spec, t + 10_000).ok).toBe(true);
    const capped = takeToken("t", "ip", spec, t + 20_000);
    expect(capped.ok).toBe(false);
  });
});

describe("agent request schema + prompt", () => {
  it("accepts a real state and rejects tampered ones", () => {
    const state = stepMany(createWorld("rooms"), ["E", "E", "S"]);
    expect(AgentRequest.safeParse({ state, instructions: ["avoid red"] }).success).toBe(true);
    expect(AgentRequest.safeParse({ state: { ...state, grid: ["#"] } }).success).toBe(false);
    expect(AgentRequest.safeParse({ state, instructions: ["x".repeat(500)] }).success).toBe(false);
  });

  it("renders a map with the agent, goal and red zones", () => {
    const s = createWorld("crossing");
    const map = renderMap(s);
    expect(map.split("\n")).toHaveLength(s.height + 1);
    expect(map).toContain("A");
    expect(map).toContain("G");
    expect(map).toContain("x");
    const prompt = agentUserPrompt({ state: s, instructions: ["avoid the red zone"], history: [] });
    expect(prompt).toContain('"avoid the red zone"');
    expect(prompt).toBe(agentUserPrompt({ state: s, instructions: ["avoid the red zone"], history: [] }));
  });
});
