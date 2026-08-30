"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function OnboardingForm() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName, teamSlug }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md border-black/5 shadow-sm">
      <CardHeader>
        <CardTitle>Create your team</CardTitle>
        <CardDescription>You will be the PM. Invite UI and Devs next.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="teamName">Team name</Label>
            <Input
              id="teamName"
              value={teamName}
              onChange={(e) => {
                setTeamName(e.target.value);
                setTeamSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
                );
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="teamSlug">Slug</Label>
            <Input
              id="teamSlug"
              value={teamSlug}
              onChange={(e) => setTeamSlug(e.target.value)}
              pattern="^[a-z0-9-]+$"
              required
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create team"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
