import { Debugger } from "@/components/demo/Debugger";
import { IntroBand } from "@/components/site/IntroBand";

export default function DemoPage() {
  return (
    <div className="flex h-[calc(100dvh-48px)] min-h-[760px] flex-col">
      <IntroBand />
      <Debugger />
    </div>
  );
}
