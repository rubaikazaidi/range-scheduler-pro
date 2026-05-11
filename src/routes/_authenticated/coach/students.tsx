import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/coach/students")({ component: StudentsPage });

interface Branch { id: string; name: string }
interface Profile { id: string; full_name: string; status: "pending" | "approved" | "rejected"; primary_branch_id: string | null }

function StudentsPage() {
  const { isCoach } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const load = async () => {
    const [{ data: br }, { data: pr }] = await Promise.all([
      supabase.from("branches").select("id,name").order("name"),
      supabase.from("profiles").select("id,full_name,status,primary_branch_id").order("created_at", { ascending: false }),
    ]);
    setBranches((br as Branch[]) ?? []);
    setStudents((pr as Profile[]) ?? []);
  };
  useEffect(() => { void load(); }, []);

  if (!isCoach) return <p>Access denied.</p>;

  const update = async (id: string, status: Profile["status"]) => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Set to ${status}`); void load();
  };

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "—";
  const filtered = students.filter((s) =>
    (filter === "all" || s.status === filter) &&
    (branchFilter === "all" || s.primary_branch_id === branchFilter)
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Students</h1>
        <p className="text-sm text-muted-foreground">Approve signups and manage student access.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {filtered.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">No students.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{s.full_name || "(no name)"}</p>
                  <p className="text-sm text-muted-foreground">{branchName(s.primary_branch_id)}</p>
                </div>
                <Badge variant={s.status === "approved" ? "default" : s.status === "pending" ? "secondary" : "destructive"}>{s.status}</Badge>
                {s.status !== "approved" && <Button size="sm" onClick={() => update(s.id, "approved")}>Approve</Button>}
                {s.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => update(s.id, "rejected")}>Reject</Button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
