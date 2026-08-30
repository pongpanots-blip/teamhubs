import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user) redirect("/app");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[radial-gradient(ellipse_at_top,_#e8eef5_0%,_#f7f5f1_45%,_#f3efe8_100%)] px-4">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">IntrovertHubs</h1>
        <p className="mt-1 text-sm text-slate-600">Context-aware task readiness for small teams</p>
      </div>
      <LoginForm />
      <p className="text-sm text-slate-600">
        No account?{" "}
        <Link href="/register" className="underline">
          Register
        </Link>
      </p>
    </div>
  );
}
