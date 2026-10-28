import { Debugger } from "@/components/demo/Debugger";
import { IntroBand } from "@/components/site/IntroBand";

export default function DemoPage() {
  return (
    <div className="flex h-[calc(100dvh-49px)] min-h-[680px] flex-col">
      <a
        href="#playback"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-1.5 focus:text-13 focus:text-accent-ink"
      >
        Skip to playback controls
      </a>
      <IntroBand />
      <Debugger />
    </div>
  );
}
