import { createFileRoute, Link } from "@tanstack/react-router";
import { Target, Calendar, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <Target className="h-5 w-5 text-accent" />
            <span>RangeOps</span>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link to="/login">Log in</Link></Button>
            <Button asChild><Link to="/signup">Sign up</Link></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <section className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Range scheduling, <span className="text-accent">on target.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Run multiple rifle range branches from one app. Coaches build daily batch
            timings. Students see their slots and request changes.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg"><Link to="/signup">Get started</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/login">I have an account</Link></Button>
          </div>
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            { icon: Calendar, title: "Daily batches", desc: "Coaches assign students to time slots, day by day." },
            { icon: Users, title: "Multi-branch", desc: "Coaches access every branch network from one login." },
            { icon: Target, title: "Reschedule requests", desc: "Students request a different slot, coaches approve." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-6">
              <f.icon className="h-6 w-6 text-accent" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
