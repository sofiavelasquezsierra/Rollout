import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Lazily constructed so a missing key never crashes module load. */
export function getClient(): Anthropic {
  client ??= new Anthropic({ maxRetries: 1 });
  return client;
}

/** Map SDK errors to a short, user-safe reason (never echo raw provider messages). */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) return "Claude API rate limit";
  if (err instanceof Anthropic.AuthenticationError) return "API key rejected";
  if (err instanceof Anthropic.BadRequestError) return "request rejected by the API";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "Claude API timed out";
  if (err instanceof Anthropic.APIConnectionError) return "could not reach the Claude API";
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? ""}`.trim();
  if (err instanceof Error && err.name === "AbortError") return "request cancelled";
  return "unexpected server error";
}

/**
 * Pull the (possibly incomplete) value of `"reasoning": "...` out of a JSON
 * string that is still streaming, so the UI can show reasoning as it is written.
 */
export function partialReasoning(json: string): string | null {
  const m = /"reasoning"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(json);
  if (!m) return null;
  let raw = m[1];
  // Drop a dangling escape so the fragment is decodable.
  if (/\\u[0-9a-fA-F]{0,3}$/.test(raw)) raw = raw.replace(/\\u[0-9a-fA-F]{0,3}$/, "");
  if (raw.endsWith("\\") && !raw.endsWith("\\\\")) raw = raw.slice(0, -1);
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw;
  }
}
