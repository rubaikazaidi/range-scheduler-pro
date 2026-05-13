import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { createStudentAccount } from "@/lib/admin.functions";
import { Plus, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/coach/students")({ component: StudentsPage });

interface Branch { id: string; name: string }
interface Profile { id: string; full_name: string; status: "pending" | "approved" | "rejected"; primary_branch_id: string | null }

function StudentsPage() {
  const { isCoach } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(""); const [name, setName] = useState("");
  const [pwd, setPwd] = useState(""); const [branchId, setBranchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  const load = async () => {
    const [{ data: br }, { data: pr }, { data: roles }] = await Promise.all([
      supabase.from("branches").select("id,name").order("name"),
      supabase.from("profiles").select("id,full_name,status,primary_branch_id").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    const studentIds = new Set((roles ?? []).filter((r) => r.role === "student").map((r) => r.user_id));
    setBranches((br as Branch[]) ?? []);
    setStudents(((pr as Profile[]) ?? []).filter((p) => studentIds.has(p.id)));
  };
  useEffect(() => { void load(); }, []);

  if (!isCoach) return <p>Access denied.</p>;

  const update = async (id: string, status: Profile["status"]) => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Set to ${status}`); void load();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) { toast.error("Pick a branch"); return; }
    setBusy(true);
    try {
      const r = await createStudentAccount({ data: { email, fullName: name, branchId, password: pwd || undefined } });
      setLastCreated({ email: r.email, password: r.password });
      toast.success("Student created");
      setEmail(""); setName(""); setPwd(""); setBranchId(""); setOpen(false);
      await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  };

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "—";
  const filtered = students.filter((s) =>
    (filter === "all" || s.status === filter) &&
    (branchFilter === "all" || s.primary_branch_id === branchFilter)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Students</h1>
          <p className="text-sm text-muted-foreground">Approve signups, manage students, and create new student accounts.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> New student</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New student account</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div><Label>Full name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div>
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Password (optional)</Label><Input placeholder="Default: Lakshya@123" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
              <DialogFooter><Button type="submit" disabled={busy}>{busy ? "…" : "Create"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {lastCreated && (
        <div className="rounded-lg border border-accent/50 bg-accent/5 p-4 text-sm">
          <p className="font-medium">New student credentials</p>
          <p className="mt-1">Email: <span className="font-mono">{lastCreated.email}</span></p>
          <p>Password: <span className="font-mono">{lastCreated.password}</span></p>
          <Button size="sm" variant="outline" className="mt-2"
            onClick={() => { void navigator.clipboard.writeText(`${lastCreated.email} / ${lastCreated.password}`); toast.success("Copied"); }}>
            <Copy className="mr-1 h-3 w-3" /> Copy
          </Button>
        </div>
      )}

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
