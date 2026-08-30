import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,_#dfe8f2_0%,_#f4f1ea_50%,_#ebe4d8_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_40%,rgba(255,255,255,0.35)_50%,transparent_60%)]" />
      <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">TeamHub</p>
        <h1 className="mt-4 max-w-2xl text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
          Ship with shared context.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-600">
          Docs, Figma, and GitHub feed Claude. A deterministic engine decides readiness,
          dependencies, and status for your small team.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white/70 px-4 text-sm font-medium text-slate-900 hover:bg-white"
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
