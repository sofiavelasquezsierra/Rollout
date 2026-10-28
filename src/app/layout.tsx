import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TopNav } from "@/components/site/TopNav";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const sans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const description =
  "Counterfactual rollouts for agents: fork a simulated robot test bay at any frame, redirect the agent in plain language, and compare the futures with a separate evaluator. A design-engineering portfolio piece.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Rollout — debugging agents in simulated worlds",
    template: "%s · Rollout",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "Rollout",
    title: "Rollout — debugging agents in simulated worlds",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Rollout — debugging agents in simulated worlds",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh flex-col bg-space">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-1.5 focus:text-13 focus:text-accent-ink"
        >
          Skip to content
        </a>
        <TopNav />
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
