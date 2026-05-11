import { createFileRoute, Outlet, redirect, Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Target, Calendar, Users, Inbox, Building2, LogOut, LayoutDashboard, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { loading, user, profile, isCoach, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return null;

  const studentLinks = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/schedule", label: "My schedule", icon: Calendar },
    { to: "/requests", label: "My requests", icon: ListChecks },
  ];
  const coachLinks = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/coach/schedule", label: "Schedule", icon: Calendar },
    { to: "/coach/students", label: "Students", icon: Users },
    { to: "/coach/requests", label: "Requests", icon: Inbox },
    { to: "/coach/branches", label: "Branches", icon: Building2 },
  ];
  const links = isCoach ? coachLinks : studentLinks;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
            <Target className="h-5 w-5 text-accent" /> Lakshya Shooting Club
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm opacity-80 sm:inline">
              {profile?.full_name || user.email} · {isCoach ? "Coach" : "Student"}
            </span>
            <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={signOut}>
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {links.map((l) => {
            const active = location.pathname === l.to || location.pathname.startsWith(l.to + "/");
            return (
              <Link key={l.to} to={l.to}
                className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition ${active ? "bg-accent text-accent-foreground" : "hover:bg-primary-foreground/10"}`}>
                <l.icon className="h-4 w-4" /> {l.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
