import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { createCoachAccount } from "@/lib/admin.functions";
import { toast } from "sonner";
import { ShieldCheck, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/coaches")({
  component: AdminCoaches,
});

interface CoachRow {
  id: string;
  full_name: string;
  email?: string;
}

function AdminCoaches() {
  const { isAdmin, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  const loadCoaches = async () => {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "coach");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) { setCoaches([]); return; }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,full_name")
      .in("id", ids);
    setCoaches((profs ?? []) as CoachRow[]);
  };

  useEffect(() => { if (isAdmin) void loadCoaches(); }, [isAdmin]);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!isAdmin) return <p className="text-muted-foreground">Admin access required.</p>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await createCoachAccount({
        data: { email, fullName, password: password || undefined },
      });
      setLastCreated({ email: res.email, password: res.password });
      toast.success("Coach account created");
      setEmail(""); setFullName(""); setPassword("");
      await loadCoaches();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create coach";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-accent" />
        <h1 className="text-2xl font-semibold">Coach accounts</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Only the admin can create coach accounts. Share the email and default password
        with the coach so they can log in and change it later.
      </p>

      <form onSubmit={submit} className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="password">Password (optional)</Label>
          <Input id="password" type="text" placeholder="Default: Lakshya@123" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create coach"}</Button>
        </div>
      </form>

      {lastCreated && (
        <div className="rounded-lg border border-accent/50 bg-accent/5 p-4 text-sm">
          <p className="font-medium">New coach credentials</p>
          <p className="mt-1">Email: <span className="font-mono">{lastCreated.email}</span></p>
          <p>Password: <span className="font-mono">{lastCreated.password}</span></p>
          <Button size="sm" variant="outline" className="mt-2"
            onClick={() => { void navigator.clipboard.writeText(`${lastCreated.email} / ${lastCreated.password}`); toast.success("Copied"); }}>
            <Copy className="mr-1 h-3 w-3" /> Copy
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3 font-medium">Existing coaches ({coaches.length})</div>
        <ul className="divide-y divide-border">
          {coaches.length === 0 && (
            <li className="px-5 py-4 text-sm text-muted-foreground">No coaches yet.</li>
          )}
          {coaches.map((c) => (
            <li key={c.id} className="px-5 py-3 text-sm">{c.full_name || c.id}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
