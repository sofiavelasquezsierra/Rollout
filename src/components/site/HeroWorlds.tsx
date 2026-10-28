/** Decorative: three tilted "parallel worlds" in CSS 3D, echoing the demo. */
export function HeroWorlds() {
  const worlds = [
    { c: "var(--c-branch-0)", x: "-58%", z: -140, path: "M10 20 H44 V66 H112" },
    { c: "var(--c-branch-1)", x: "0%", z: 0, path: "M10 20 H74 V42 H112 V66" },
    { c: "var(--c-branch-2)", x: "58%", z: -140, path: "M10 20 V66 H112" },
  ];
  return (
    <div aria-hidden className="pointer-events-none relative mx-auto h-[220px] w-full max-w-[860px] [perspective:1100px] md:h-[280px]">
      {worlds.map((w, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 h-[150px] w-[44%] md:h-[190px]"
          style={{
            transform: `translate(-50%, -50%) translateX(${w.x}) translateZ(${w.z}px) rotateX(58deg) rotateZ(-8deg)`,
            opacity: i === 1 ? 1 : 0.6,
          }}
        >
          <div
            className="h-full w-full rounded-lg"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, #141414 0%, #070707 80%), repeating-linear-gradient(0deg, transparent 0 15px, rgb(255 255 255 / 0.06) 15px 16px)",
              border: `1px solid ${w.c}`,
              boxShadow: `0 0 40px color-mix(in srgb, ${w.c} 35%, transparent), inset 0 0 30px rgb(0 0 0 / 0.6)`,
            }}
          >
            <svg viewBox="0 0 120 80" className="h-full w-full">
              <rect x="22" y="34" width="34" height="8" fill="rgb(255 90 46 / 0.3)" stroke="var(--c-hazard)" strokeWidth="0.6" />
              <rect x="68" y="34" width="34" height="8" fill="rgb(255 90 46 / 0.3)" stroke="var(--c-hazard)" strokeWidth="0.6" />
              <path d={w.path} fill="none" stroke={w.c} strokeWidth="1.4" strokeDasharray="2 2.5" />
              <circle cx="10" cy="20" r="3" fill="#ffffff" />
              <rect x="108" y="62" width="8" height="8" fill="none" stroke="var(--c-ok)" strokeWidth="1" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
