"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#e8eef5_0%,_#f7f5f1_45%,_#f3efe8_100%)] px-4">
      <Card className="w-full max-w-md border-black/5">
        <CardHeader>
          <CardTitle>Join team</CardTitle>
          <CardDescription>Accept this invite with the matching account email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={accept} disabled={loading}>
            {loading ? "Joining…" : "Accept invite"}
          </Button>
          {msg ? <p className="text-sm text-red-600">{msg}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
