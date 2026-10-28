"use client";

import { useEffect } from "react";
import { useRollout } from "@/store/useRollout";
import { Icon } from "@/components/ui/Icon";

const TONE = {
  info: "border-line-strong",
  warn: "border-accent/50",
  error: "border-hazard/60",
};

/** Single transient status line. Announced politely to screen readers. */
export function NoticeToast() {
  const notice = useRollout((s) => s.notice);
  const dismiss = useRollout((s) => s.dismissNotice);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(dismiss, notice.tone === "info" ? 3800 : 6500);
    return () => window.clearTimeout(t);
  }, [notice, dismiss]);

  return (
    <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
      {notice && (
        <div
          key={notice.id}
          role="status"
          className={`pointer-events-auto flex max-w-xl animate-rise-in items-center gap-3 rounded-md border bg-surface-2/95 py-1.5 pl-3 pr-1.5 text-13 text-ink shadow-[0_8px_30px_rgb(0_0_0/0.4)] backdrop-blur ${TONE[notice.tone]}`}
        >
          <span className={notice.tone === "error" ? "text-hazard" : notice.tone === "warn" ? "text-accent" : "text-ink-3"}>
            {notice.tone === "info" ? "●" : "▲"}
          </span>
          <span>{notice.text}</span>
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded-sm p-1 text-ink-3 hover:text-ink">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
