import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { profile, isCoach, isStudent, isAdmin, refresh, user } = useAuth();
  const [adminCount, setAdminCount] = useState<number | null>(null);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin")
      .then(({ count }) => setAdminCount(count ?? 0));
  }, []);

  const becomeAdmin = async () => {
    if (!user) return;
    setPromoting(true);
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "admin" });
    await supabase.from("profiles").update({ status: "approved" }).eq("id", user.id);
    setPromoting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("You are now the admin");
    await refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "You are the admin. Manage coach accounts and the full club." :
            isCoach ? "You have coach access across all branches." :
            "Here's a quick view of your account."}
        </p>
      </div>

      {adminCount === 0 && (
        <div className="rounded-lg border border-accent/50 bg-accent/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-accent" />
            <div className="flex-1">
              <h3 className="font-medium">Bootstrap the admin account</h3>
              <p className="text-sm text-muted-foreground">No admin exists yet. As the first user, claim the admin role to manage coach accounts and the club.</p>
            </div>
            <Button onClick={becomeAdmin} disabled={promoting}>{promoting ? "…" : "Become admin"}</Button>
          </div>
        </div>
      )}

      {isStudent && !isCoach && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            {profile?.status === "approved" ? <CheckCircle2 className="h-5 w-5 text-accent" /> : <Clock className="h-5 w-5 text-muted-foreground" />}
            <div>
              <p className="font-medium">
                {profile?.status === "approved" && "Your account is approved."}
                {profile?.status === "pending" && "Awaiting coach approval."}
                {profile?.status === "rejected" && "Your registration was rejected."}
              </p>
              <p className="text-sm text-muted-foreground">
                {profile?.status === "approved"
                  ? "Check your schedule to see assigned slots."
                  : "Once a coach approves you, your schedule will appear."}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isAdmin && (
          <DashCard to="/admin/accounts" title="Accounts" desc="Create coaches & students, edit or remove accounts." />
        )}
        {isCoach ? (
          <>
            <DashCard to="/coach/schedule" title="Schedule" desc="Build daily slots and assign students." />
            <DashCard to="/coach/students" title="Students" desc="Approve signups and manage students." />
            <DashCard to="/coach/requests" title="Requests" desc="Review reschedule requests." />
            <DashCard to="/coach/branches" title="Branches" desc="Add and edit branch locations." />
          </>
        ) : (
          <>
            <DashCard to="/schedule" title="My schedule" desc="See your upcoming range slots." />
            <DashCard to="/requests" title="My requests" desc="Track your reschedule requests." />
          </>
        )}
      </div>
    </div>
  );
}

function DashCard({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link to={to} className="rounded-lg border border-border bg-card p-5 transition hover:border-accent">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}
