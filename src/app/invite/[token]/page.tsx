"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <AuthShell
      title="Join team"
      description="Accept this invite with the matching account email."
      action={{ href: "/login", label: "Sign in" }}
    >
      {/* No fields to group, so no Card — the page is one action. */}
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
    </AuthShell>
  );
}
