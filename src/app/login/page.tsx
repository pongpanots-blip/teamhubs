import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user) redirect("/app");

  return (
    <AuthShell
      title="Sign in"
      description="Team-based access for your small squad."
      action={{ href: "/register", label: "Get started" }}
    >
      <LoginForm />
    </AuthShell>
  );
}
