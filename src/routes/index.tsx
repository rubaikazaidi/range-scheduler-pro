import { createFileRoute, Link } from "@tanstack/react-router";
import { Target, GraduationCap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary">
            <Target className="h-7 w-7 text-accent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Lakshya Shooting Club</h1>
          <p className="text-sm text-muted-foreground">Choose how you want to sign in</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <GraduationCap className="mx-auto h-8 w-8 text-accent" />
            <h2 className="mt-3 text-lg font-semibold">Student</h2>
            <p className="mt-1 text-sm text-muted-foreground">Check your batch timings and request changes.</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button asChild>
                <Link to="/login">Student log in</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/signup">Sign up</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-accent" />
            <h2 className="mt-3 text-lg font-semibold">Coach / Admin</h2>
            <p className="mt-1 text-sm text-muted-foreground">Manage schedules, students and branches.</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button asChild>
                <Link to="/login">Coach log in</Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                New coach accounts are created by the admin only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
