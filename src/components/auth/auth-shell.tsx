import Link from "next/link";

/**
 * Public-page chrome shared by login / register / onboarding, matching the
 * landing page: solid canvas, wordmark hard left, one action hard right.
 *
 * The heading lives here rather than inside each form's Card — the pages used to
 * stack a wordmark, a tagline, and then the card's own title, which said the same
 * thing three times.
 */
export function AuthShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  /** Absent mid-flow (onboarding), where there is nowhere else to send the user. */
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 px-(--gutter) py-5">
        <Link href="/" className="font-semibold tracking-tight">
          IntrovertHubs
        </Link>
        {action ? (
          <Link
            href={action.href}
            className="inline-flex h-11 items-center rounded-lg px-3 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground"
          >
            {action.label}
          </Link>
        ) : null}
      </header>

      <main className="flex flex-1 items-center px-(--gutter) pb-16">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]">
            {title}
          </h1>
          <p className="mt-2 text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
