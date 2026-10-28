import type { Metadata } from "next";

export const metadata: Metadata = { title: "Case study" };

export default function CaseStudyPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16 md:px-6">
      <h1 className="font-serif text-56">Case study</h1>
    </article>
  );
}
