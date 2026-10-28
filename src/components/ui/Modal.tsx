"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Native <dialog> modal: focus trapping, Escape-to-close and inert background
 * come from the platform. Focus returns to the opener on close.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement;
      d.showModal();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onClose={() => {
        onClose();
        (opener.current as HTMLElement | null)?.focus?.();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`glass-strong m-auto w-[calc(100%-32px)] rounded-3xl p-0 text-ink shadow-[0_24px_80px_rgb(0_0_0/0.55)] backdrop:bg-[rgb(5_6_8/0.72)] backdrop:backdrop-blur-sm open:animate-rise-in ${
        wide ? "max-w-3xl" : "max-w-xl"
      }`}
    >
      {open && (
        <div className="max-h-[85dvh] overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--c-glass-line)] px-5 py-3">
            <h2 id="modal-title" className="text-15 font-medium">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1.5 text-ink-3 t-fast transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
