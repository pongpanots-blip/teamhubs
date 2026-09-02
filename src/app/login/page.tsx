import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const [session, { next }] = await Promise.all([getSession(), searchParams]);
  if (session?.user) redirect(next || "/app");

  return (
    <AuthShell
      title="Sign in"
      description="Team-based access for your small squad."
      action={{ href: "/register", label: "Get started" }}
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
