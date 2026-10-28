/** Canonical origin used for Open Graph URLs. Set NEXT_PUBLIC_SITE_URL in production. */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const navItems = [
  { href: "/", label: "Demo" },
  { href: "/case-study", label: "Case study" },
  { href: "/resume", label: "Resume" },
] as const;

/** Per-page social metadata that keeps the site-wide fields (Next replaces, not merges, openGraph). */
export function socialMeta(title: string, description: string) {
  return {
    openGraph: { type: "website" as const, siteName: "Rollout", title, description },
    twitter: { card: "summary_large_image" as const, title, description },
  };
}
