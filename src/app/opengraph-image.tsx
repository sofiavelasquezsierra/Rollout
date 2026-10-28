import { ImageResponse } from "next/og";

export const alt = "Rollout — a debugger for agents acting in simulated worlds";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Colors mirror src/styles/tokens.css (CSS variables aren't available to Satori).
const C = {
  bg: "#000000",
  line: "#262626",
  ink: "#ffffff",
  ink2: "#a6a6a6",
  ink3: "#8c8c8c",
  accent: "#ffffff",
  hazard: "#ff5a2e",
  blue: "#7aa7ff",
  violet: "#b39dff",
};

/** Social card: title on the left, a stylized branch graph + world on the right. */
export default function OpengraphImage() {
  const cell = 26;
  const dots = [];
  for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) dots.push([x, y]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: C.bg, padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: C.accent }} />
            <div style={{ fontSize: 30, color: C.ink, fontWeight: 600, letterSpacing: -0.5 }}>Rollout</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ fontSize: 60, lineHeight: 1.02, color: C.ink, letterSpacing: -2.4 }}>
              Debugging agents in simulated worlds
            </div>
            <div style={{ fontSize: 24, lineHeight: 1.4, color: C.ink2 }}>
              Scrub the rollout. Fork the world at any frame. Redirect the agent. Compare branches scored by an evaluator.
            </div>
          </div>
          <div style={{ display: "flex", gap: 28, fontSize: 18, color: C.ink3 }}>
            <span>Demo</span>
            <span>Case study</span>
            <span>Resume</span>
          </div>
        </div>

        <div
          style={{
            marginLeft: "auto",
            width: 16 * cell + 2,
            height: 12 * cell + 2,
            alignSelf: "center",
            position: "relative",
            display: "flex",
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            background: "#0a0a0a",
          }}
        >
          {dots.map(([x, y]) => (
            <div key={`${x}-${y}`} style={{ position: "absolute", left: x * cell + cell / 2, top: y * cell + cell / 2, width: 2, height: 2, background: "#1f1f1f" }} />
          ))}
          {/* red zone */}
          <div style={{ position: "absolute", left: 1 * cell, top: 5 * cell, width: 6 * cell, height: 2 * cell, background: "rgba(255,90,46,0.14)", border: `1px solid ${C.hazard}` }} />
          <div style={{ position: "absolute", left: 9 * cell, top: 5 * cell, width: 6 * cell, height: 2 * cell, background: "rgba(255,90,46,0.14)", border: `1px solid ${C.hazard}` }} />
          {/* main path (cuts through) */}
          <div style={{ position: "absolute", left: 2 * cell, top: 2 * cell, width: 3, height: 7 * cell, background: C.accent, opacity: 0.85 }} />
          <div style={{ position: "absolute", left: 2 * cell, top: 9 * cell, width: 11 * cell, height: 3, background: C.accent, opacity: 0.85 }} />
          {/* careful fork through the gap */}
          <div style={{ position: "absolute", left: 2 * cell, top: 3 * cell, width: 6 * cell, height: 3, background: C.blue }} />
          <div style={{ position: "absolute", left: 8 * cell, top: 3 * cell, width: 3, height: 6 * cell, background: C.blue }} />
          {/* beeline fork, dashed feel */}
          <div style={{ position: "absolute", left: 2 * cell, top: 4.5 * cell, width: 12 * cell, height: 2, background: C.violet, opacity: 0.6 }} />
          {/* fork node + agent */}
          <div style={{ position: "absolute", left: 2 * cell - 7, top: 3 * cell - 7, width: 16, height: 16, borderRadius: 8, background: C.bg, border: `3px solid ${C.accent}` }} />
          <div style={{ position: "absolute", left: 13 * cell - 10, top: 9 * cell - 10, width: 22, height: 22, borderRadius: 11, background: C.accent }} />
          {/* goal */}
          <div style={{ position: "absolute", left: 14 * cell, top: 10 * cell, width: cell - 4, height: cell - 4, border: "2px solid #b8e62e" }} />
        </div>
      </div>
    ),
    size,
  );
}
