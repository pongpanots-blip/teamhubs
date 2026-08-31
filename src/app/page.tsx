/* Hallmark · macrostructure: 14 Narrative Workflow · genre: modern-minimal
 * nav: N9 edge-aligned · footer: Ft5 statement · enrichment: none (typography only)
 * theme: project tokens (no catalog pick — this project owns its system)
 * Stage copy is sourced from what the app actually does; no invented metrics,
 * testimonials or logos. If a claim here stops being true, fix the claim.
 */
import Link from "next/link";

const STAGES = [
  {
    n: "1.0",
    label: "Context",
    heading: "Everything the work depends on, in one index.",
    body: "Docs, Figma files and GitHub activity land in a single knowledge base. Only the chunks that actually matter reach Claude — the rest stays out of the prompt.",
  },
  {
    n: "2.0",
    label: "Grill",
    heading: "The questions get asked before the code does.",
    body: "Claude interrogates a card before anyone starts. What it can't answer stays on the card as missing context — visible to the team, rather than discovered halfway through the build.",
  },
  {
    n: "3.0",
    label: "Readiness",
    heading: "Status is decided, not claimed.",
    body: "A deterministic engine sets each card's status from its dependencies and its unanswered questions. Blocked stays blocked until the thing it waits on is done.",
  },
  {
    n: "4.0",
    label: "Delivery",
    heading: "Plan by dragging. Measure with your own history.",
    body: "Drag cards into a sprint and size them in man hours. Burndown, cumulative flow, cycle time and a service-level forecast are all built from work your team has actually finished.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* N9 · edge-aligned: wordmark hard left, actions hard right, nothing in between */}
      <header className="flex items-center justify-between gap-4 px-(--gutter) py-5">
        <span className="font-semibold tracking-tight">IntrovertHubs</span>
        <div className="flex items-center gap-1">
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-lg px-3 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-11 items-center rounded-lg bg-foreground px-4 text-sm font-medium whitespace-nowrap text-background hover:bg-foreground/90"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="flex-1 px-(--gutter)">
        <section className="mx-auto max-w-5xl pt-16 pb-24 sm:pt-28 sm:pb-36">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-6xl">
            Ship with shared context.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Docs, Figma and GitHub feed Claude. A deterministic engine decides readiness,
            dependencies and status for your small team.
          </p>
        </section>

        {/* The four stages are the page. Each is separated by a thick numbered rule. */}
        <section aria-label="How it works" className="mx-auto max-w-5xl">
          {STAGES.map((s) => (
            <article
              key={s.n}
              className="hm-stage border-t-2 border-foreground/10 py-14 sm:py-20"
            >
              {/* Stage marker stacks ABOVE the heading, never beside it — a label in
                  a column next to the header is the templated-editorial tell. */}
              <div className="flex items-baseline gap-3">
                <span className="text-figure font-semibold tabular-nums tracking-tight">
                  {s.n}
                </span>
                <span className="text-meta font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {s.label}
                </span>
              </div>
              <h2 className="mt-5 max-w-2xl min-w-0 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
                {s.heading}
              </h2>
              <p className="mt-4 max-w-xl text-muted-foreground">{s.body}</p>
            </article>
          ))}
        </section>

        {/* One button. The repetition is the call to action. */}
        <section className="mx-auto max-w-5xl border-t-2 border-foreground/10 py-20 sm:py-28">
          <p className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
            Start at stage one.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex h-11 items-center rounded-lg bg-foreground px-5 text-sm font-medium whitespace-nowrap text-background hover:bg-foreground/90"
          >
            Create your team
          </Link>
        </section>
      </main>

      {/* Ft5 · statement: one sentence carries the footer, meta row underneath */}
      <footer className="border-t border-border px-(--gutter) py-12">
        <div className="mx-auto max-w-5xl">
          <p className="max-w-2xl text-lg [overflow-wrap:anywhere]">
            Built for teams small enough that the context lives in someone&apos;s head — and
            busy enough that it shouldn&apos;t.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-body text-muted-foreground">
            <span className="font-medium text-foreground">IntrovertHubs</span>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-foreground">
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
