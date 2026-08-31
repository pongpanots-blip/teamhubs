import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage() {
  const session = await getSession();
  if (session?.user) redirect("/app");

  return (
    <AuthShell
      title="Create account"
      description="Then create or join a team."
      action={{ href: "/login", label: "Sign in" }}
    >
      <RegisterForm />
    </AuthShell>
  );
}
