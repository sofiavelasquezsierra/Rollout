import { Immersive } from "@/components/immersive/Immersive";

export default function DemoPage() {
  return (
    <>
      <a
        href="#playback"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-1.5 focus:text-13 focus:text-accent-ink"
      >
        Skip to controls
      </a>
      <Immersive />
    </>
  );
}
