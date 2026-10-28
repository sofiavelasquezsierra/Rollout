import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function Kbd({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm border border-line-strong bg-surface-2 px-1 font-mono text-12 leading-none text-ink-2 ${className}`}
    >
      {children}
    </kbd>
  );
}

type Variant = "ghost" | "quiet" | "solid" | "accent";

const variants: Record<Variant, string> = {
  ghost: "text-ink-2 hover:text-ink hover:bg-surface-3 active:bg-surface-2",
  quiet: "border border-line bg-surface-2 text-ink hover:border-line-strong hover:bg-surface-3",
  solid: "border border-line-strong bg-surface-3 text-ink hover:bg-[color-mix(in_srgb,var(--c-surface-3)_80%,white)]",
  accent: "bg-accent text-accent-ink hover:brightness-110 active:brightness-95 font-medium",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: IconName;
  size?: "sm" | "md";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "quiet", icon, size = "md", className = "", children, ...rest },
  ref,
) {
  const sz = size === "sm" ? "h-7 px-2.5 text-12 gap-1.5" : "h-8 px-3 text-13 gap-2";
  return (
    <button
      ref={ref}
      type="button"
      className={`inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md t-fast transition-[background-color,border-color,color,filter,transform] active:translate-y-px disabled:pointer-events-none disabled:opacity-40 ${sz} ${variants[variant]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  shortcut?: string;
  variant?: Variant;
}

/** Square icon button. `label` is the accessible name; shortcut is shown in the tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, shortcut, variant = "ghost", className = "", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-keyshortcuts={shortcut}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md t-fast transition-[background-color,color,transform] active:scale-95 disabled:pointer-events-none disabled:opacity-35 ${variants[variant]} ${className}`}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
});

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-12 uppercase tracking-[0.12em] text-ink-3 ${className}`}>{children}</span>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "hazard" | "ok";
  className?: string;
}) {
  const tones = {
    neutral: "border-line-strong text-ink-2",
    accent: "border-accent/40 bg-accent-soft text-accent",
    hazard: "border-hazard/40 bg-hazard-soft text-hazard",
    ok: "border-ok/40 bg-ok-soft text-ok",
  };
  return (
    <span
      className={`inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 font-mono text-12 leading-none ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Animated three-dot "thinking" indicator; static under reduced motion. */
export function Thinking({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1 rounded-full bg-current animate-[pulse-dot_1s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </span>
  );
}
