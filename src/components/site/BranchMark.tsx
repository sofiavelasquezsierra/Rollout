/** The Rollout mark: a trunk with one fork, drawn as a tiny branch graph. */
export function BranchMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path d="M5 3v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M5 8c0 3 2.5 4 6.5 4H15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="5" cy="8" r="2" fill="var(--c-bg)" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="15.5" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}
