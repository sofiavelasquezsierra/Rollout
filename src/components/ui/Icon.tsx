/** A small hand-drawn icon set (16px grid, 1.5px strokes). No icon library. */
const paths = {
  play: <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="4" y="3.5" width="2.5" height="9" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="9.5" y="3.5" width="2.5" height="9" rx="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  stepBack: (
    <>
      <path d="M11.5 4v8L6 8z" fill="currentColor" stroke="none" />
      <path d="M4.5 4v8" />
    </>
  ),
  stepFwd: (
    <>
      <path d="M4.5 4v8L10 8z" fill="currentColor" stroke="none" />
      <path d="M11.5 4v8" />
    </>
  ),
  toStart: (
    <>
      <path d="M3.5 4v8" />
      <path d="M12.5 4.5 7 8l5.5 3.5" />
    </>
  ),
  toEnd: (
    <>
      <path d="M12.5 4v8" />
      <path d="M3.5 4.5 9 8l-5.5 3.5" />
    </>
  ),
  fork: (
    <>
      <circle cx="4.5" cy="3.5" r="1.5" />
      <circle cx="4.5" cy="12.5" r="1.5" />
      <circle cx="11.5" cy="5.5" r="1.5" />
      <path d="M4.5 5v6M11.5 7c0 2.5-2 3-7 4" />
    </>
  ),
  pencil: <path d="M10.5 3.5l2 2L6 12H4v-2zM9 5l2 2" />,
  send: <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />,
  info: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 7.2V11M8 5.2v.01" />
    </>
  ),
  close: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />,
  compare: (
    <>
      <rect x="2.5" y="3.5" width="4.5" height="9" rx="1" />
      <rect x="9" y="3.5" width="4.5" height="9" rx="1" />
    </>
  ),
  spark: <path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M4.2 4.2l1.8 1.8M10 10l1.8 1.8M11.8 4.2 10 6M6 10l-1.8 1.8" />,
  keyboard: (
    <>
      <rect x="1.5" y="4" width="13" height="8" rx="1.5" />
      <path d="M4 6.5h.01M6.5 6.5h.01M9 6.5h.01M11.5 6.5h.01M5 9.5h6" />
    </>
  ),
  video: (
    <>
      <rect x="1.5" y="4" width="9.5" height="8" rx="1.5" />
      <path d="M11 7l3.5-2v6L11 9" />
    </>
  ),
  download: <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />,
  arrowRight: <path d="M3 8h10M9 4l4 4-4 4" />,
  refresh: <path d="M12.5 6A4.75 4.75 0 1 0 13 9.5M12.5 2.5V6H9" />,
  scale: <path d="M8 2.5v11M4 13.5h8M2.5 6.5h11M2.5 6.5 1 10h3zM13.5 6.5 12 10h3z" />,
  hand: (
    <path d="M5.5 8.5V4a1 1 0 0 1 2 0v3.5M7.5 7V3a1 1 0 0 1 2 0v4M9.5 7V4a1 1 0 0 1 2 0v5c0 2.5-1.8 4.5-4 4.5S4 12 3.2 10.5L2.4 9a1 1 0 0 1 1.7-1l1.4 1.5" />
  ),
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className, size = 16 }: { name: IconName; className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
