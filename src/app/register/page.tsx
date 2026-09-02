import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const [session, { next }] = await Promise.all([getSession(), searchParams]);
  if (session?.user) redirect(next || "/app");

  return (
    <AuthShell
      title="Create account"
      description="Then create or join a team."
      action={{ href: "/login", label: "Sign in" }}
    >
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
