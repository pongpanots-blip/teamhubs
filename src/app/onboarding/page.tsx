import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
  });
  if (membership) redirect("/app");

  return (
    <AuthShell
      title="Create your team"
      description="You will be the PM. Invite UI and Devs next."
    >
      <OnboardingForm />
    </AuthShell>
  );
}
