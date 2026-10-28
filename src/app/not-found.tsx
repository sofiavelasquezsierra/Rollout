import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 pb-24 pt-32">
      <p className="font-mono text-12 uppercase tracking-[0.14em] text-ink-3">404 · no such branch</p>
      <h1 className="mt-3 text-24 font-medium">This frame was never rendered.</h1>
      <p className="mt-2 text-15 text-ink-2">The page you’re looking for doesn’t exist.</p>
      <Link href="/" className="mt-6 inline-flex h-9 w-fit items-center rounded-md bg-accent px-4 text-13 font-medium text-accent-ink hover:brightness-110">
        Back to the demo
      </Link>
    </section>
  );
}
