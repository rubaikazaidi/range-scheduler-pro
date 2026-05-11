import { createFileRoute, Link } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary">
            <Target className="h-7 w-7 text-accent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Lakshya Shooting Club</h1>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>
        <div className="space-y-3">
          <Button asChild size="lg" className="w-full">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link to="/signup">Student sign up</Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Coaches: use your existing account to log in.
        </p>
      </div>
    </div>
  );
}
