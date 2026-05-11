import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { createFirstAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin-setup")({ component: AdminSetup });

function AdminSetup() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin")
      .then(({ count }) => { setAdminExists((count ?? 0) > 0); setChecking(false); });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createFirstAdmin({ data: { email, fullName, password } });
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) {
        toast.success("Admin created. Please log in.");
        navigate({ to: "/login" });
        return;
      }
      toast.success("Admin account created");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create admin";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-semibold">
          <Target className="h-5 w-5 text-accent" /> Lakshya Shooting Club
        </Link>
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <h1 className="text-xl font-semibold">Create admin account</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            One-time setup. The admin can then create coach accounts.
          </p>

          {checking ? (
            <p className="mt-6 text-sm text-muted-foreground">Checking…</p>
          ) : adminExists ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-muted-foreground">An admin account already exists. Please sign in.</p>
              <Button asChild className="w-full"><Link to="/login">Go to login</Link></Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creating…" : "Create admin"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
