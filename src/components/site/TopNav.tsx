"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/site";
import { BranchMark } from "./BranchMark";

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 md:px-5">
      <div className="glass mx-auto flex h-11 items-center justify-between gap-4 rounded-full pl-4 pr-1.5">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-ink"
          aria-label="Rollout, home"
        >
          <BranchMark className="size-[18px] text-accent t-base transition-transform group-hover:rotate-[-8deg]" />
          <span className="text-15 font-semibold tracking-[-0.01em]">Rollout</span>
          <span className="hidden font-mono text-12 text-ink-3 sm:inline">
            parallel worlds for agents
          </span>
        </Link>

        <nav aria-label="Primary">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative rounded-full px-3.5 py-1.5 text-13 t-fast transition-colors ${
                      active ? "bg-white/10 text-ink" : "text-ink-2 hover:bg-white/[0.06] hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
