import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[radial-gradient(ellipse_at_top,_#e8eef5_0%,_#f7f5f1_45%,_#f3efe8_100%)] px-4">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">TeamHub</h1>
        <p className="mt-1 text-sm text-slate-600">Create an account to start your team</p>
      </div>
      <RegisterForm />
      <p className="text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
