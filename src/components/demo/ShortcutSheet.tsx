import { Kbd } from "@/components/ui/primitives";
import { SHORTCUTS } from "./useShortcuts";

export function ShortcutSheet() {
  return (
    <ul className="divide-y divide-line">
      {SHORTCUTS.map((s) => (
        <li key={s.label} className="flex items-center justify-between py-2 text-13">
          <span className="text-ink-2">{s.label}</span>
          <span className="flex items-center gap-1">
            {s.keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
