import type { Metadata } from "next";

export const metadata: Metadata = { title: "Resume" };

export default function ResumePage() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16 md:px-6">
      <h1 className="text-36 font-medium">Resume</h1>
    </section>
  );
}
