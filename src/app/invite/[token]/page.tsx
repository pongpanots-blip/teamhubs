"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { authClient } from "@/lib/auth-client";

type InviteInfo = {
  email: string;
  teamName: string;
  projectName: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
};

const STATUS_MESSAGE: Record<Exclude<InviteInfo["status"], "pending">, string> = {
  accepted: "This invite has already been used.",
  revoked: "This invite was revoked.",
  expired: "This invite has expired — ask whoever sent it for a new one.",
};

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = authClient.useSession();

  const [invite, setInvite] = useState<InviteInfo | null | "not_found">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${params.token}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: InviteInfo) => setInvite(data))
      .catch(() => setInvite("not_found"));
  }, [params.token]);

  async function accept() {
    setLoading(true);
    setMsg(null);
    const res = await fetch(`/api/invites/${params.token}/accept`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error ?? "Failed");
      return;
    }
    router.push(data.projectSlug ? `/app/${data.projectSlug}` : "/app");
  }

  const nextPath = `/invite/${params.token}`;

  let body: React.ReactNode;
  if (invite === null || sessionLoading) {
    body = <p className="text-sm text-muted-foreground">Loading invite…</p>;
  } else if (invite === "not_found") {
    body = <p className="text-sm text-destructive">This invite link doesn&apos;t exist.</p>;
  } else if (invite.status !== "pending") {
    body = <p className="text-sm text-destructive">{STATUS_MESSAGE[invite.status]}</p>;
  } else if (!session?.user) {
    // No account signed in yet — send them to register/sign in with the
    // invited email pre-filled, and land back here afterward.
    body = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This invite is for <span className="font-medium text-foreground">{invite.email}</span>.
          Create an account or sign in with that email to accept it.
        </p>
        <Button
          className="w-full"
          nativeButton={false}
          render={
            <a
              href={`/register?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(nextPath)}`}
            />
          }
        >
          Create account
        </Button>
        <Button
          variant="outline"
          className="w-full"
          nativeButton={false}
          render={
            <a href={`/login?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(nextPath)}`} />
          }
        >
          Sign in
        </Button>
      </div>
    );
  } else if (session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          You&apos;re signed in as {session.user.email}, but this invite is for {invite.email}.
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            void authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  window.location.href = `/login?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(nextPath)}`;
                },
              },
            })
          }
        >
          Sign out and use {invite.email}
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        <Button className="w-full" onClick={accept} disabled={loading}>
          {loading ? "Joining…" : "Accept invite"}
        </Button>
        {msg ? (
          <p role="alert" className="text-sm text-destructive">
            {msg}
          </p>
        ) : null}
      </div>
    );
  }

  const description =
    invite && invite !== "not_found" && invite.status === "pending"
      ? `Join ${invite.teamName}${invite.projectName ? ` · ${invite.projectName}` : ""}.`
      : "Accept this invite with the matching account email.";

  return (
    <AuthShell title="Join team" description={description} action={{ href: "/login", label: "Sign in" }}>
      {body}
    </AuthShell>
  );
}
