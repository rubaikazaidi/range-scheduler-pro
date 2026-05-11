import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  createCoachAccount, createStudentAccount, deleteAccount, updateAccount, listAccounts,
} from "@/lib/admin.functions";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Copy, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/accounts")({ component: AdminAccounts });

interface Branch { id: string; name: string }
interface Account {
  id: string; email: string; fullName: string;
  branchId: string | null; status: string; role: "admin" | "coach" | "student";
}

function AdminAccounts() {
  const { isAdmin, loading } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState("coaches");

  const [coachOpen, setCoachOpen] = useState(false);
  const [studentOpen, setStudentOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  const reload = async () => {
    const [{ data: br }, list] = await Promise.all([
      supabase.from("branches").select("id,name").order("name"),
      listAccounts(),
    ]);
    setBranches((br as Branch[]) ?? []);
    setAccounts(list as Account[]);
  };
  useEffect(() => { if (isAdmin) void reload(); }, [isAdmin]);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!isAdmin) return <p className="text-muted-foreground">Admin access required.</p>;

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "—";
  const coaches = accounts.filter((a) => a.role === "coach" || a.role === "admin");
  const students = accounts.filter((a) => a.role === "student");

  const remove = async (a: Account) => {
    if (!confirm(`Delete ${a.email}? This cannot be undone.`)) return;
    try { await deleteAccount({ data: { userId: a.id } }); toast.success("Deleted"); await reload(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-accent" />
        <h1 className="text-2xl font-semibold">Accounts</h1>
      </div>

      {lastCreated && (
        <div className="rounded-lg border border-accent/50 bg-accent/5 p-4 text-sm">
          <p className="font-medium">New account credentials</p>
          <p className="mt-1">Email: <span className="font-mono">{lastCreated.email}</span></p>
          <p>Password: <span className="font-mono">{lastCreated.password}</span></p>
          <Button size="sm" variant="outline" className="mt-2"
            onClick={() => { void navigator.clipboard.writeText(`${lastCreated.email} / ${lastCreated.password}`); toast.success("Copied"); }}>
            <Copy className="mr-1 h-3 w-3" /> Copy
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="coaches">Coaches & admins ({coaches.length})</TabsTrigger>
            <TabsTrigger value="students">Students ({students.length})</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <CreateCoachDialog open={coachOpen} setOpen={setCoachOpen}
              onCreated={(c) => { setLastCreated(c); void reload(); }} />
            <CreateStudentDialog open={studentOpen} setOpen={setStudentOpen} branches={branches}
              onCreated={(c) => { setLastCreated(c); void reload(); }} />
          </div>
        </div>

        <TabsContent value="coaches" className="mt-4">
          <AccountList accounts={coaches} branchName={branchName} onEdit={setEditing} onDelete={remove} showBranch={false} />
        </TabsContent>
        <TabsContent value="students" className="mt-4">
          <AccountList accounts={students} branchName={branchName} onEdit={setEditing} onDelete={remove} showBranch />
        </TabsContent>
      </Tabs>

      <EditDialog account={editing} branches={branches} onClose={() => setEditing(null)} onSaved={reload} />
    </div>
  );
}

function AccountList({ accounts, branchName, onEdit, onDelete, showBranch }: {
  accounts: Account[]; branchName: (id: string | null) => string;
  onEdit: (a: Account) => void; onDelete: (a: Account) => void; showBranch: boolean;
}) {
  if (accounts.length === 0) return <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">None yet.</p>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {accounts.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium">{a.fullName || "(no name)"}</p>
            <p className="text-sm text-muted-foreground">{a.email}{showBranch && ` · ${branchName(a.branchId)}`}</p>
          </div>
          <Badge variant={a.role === "admin" ? "default" : "secondary"}>{a.role}</Badge>
          <Button size="sm" variant="outline" onClick={() => onEdit(a)}><Pencil className="h-3 w-3" /></Button>
          {a.role !== "admin" && (
            <Button size="sm" variant="ghost" onClick={() => onDelete(a)}><Trash2 className="h-3 w-3" /></Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function CreateCoachDialog({ open, setOpen, onCreated }: {
  open: boolean; setOpen: (b: boolean) => void;
  onCreated: (c: { email: string; password: string }) => void;
}) {
  const [email, setEmail] = useState(""); const [name, setName] = useState(""); const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await createCoachAccount({ data: { email, fullName: name, password: pwd || undefined } });
      onCreated({ email: r.email, password: r.password });
      toast.success("Coach created"); setEmail(""); setName(""); setPwd(""); setOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="mr-1 h-4 w-4" /> New coach</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New coach account</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Full name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Password (optional)</Label><Input placeholder="Default: Lakshya@123" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={busy}>{busy ? "…" : "Create"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateStudentDialog({ open, setOpen, branches, onCreated }: {
  open: boolean; setOpen: (b: boolean) => void; branches: Branch[];
  onCreated: (c: { email: string; password: string }) => void;
}) {
  const [email, setEmail] = useState(""); const [name, setName] = useState("");
  const [pwd, setPwd] = useState(""); const [branchId, setBranchId] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) { toast.error("Pick a branch"); return; }
    setBusy(true);
    try {
      const r = await createStudentAccount({ data: { email, fullName: name, branchId, password: pwd || undefined } });
      onCreated({ email: r.email, password: r.password });
      toast.success("Student created"); setEmail(""); setName(""); setPwd(""); setBranchId(""); setOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> New student</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New student account</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
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
  );
}

function EditDialog({ account, branches, onClose, onSaved }: {
  account: Account | null; branches: Branch[]; onClose: () => void; onSaved: () => Promise<void> | void;
}) {
  const [name, setName] = useState(""); const [branchId, setBranchId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(account?.fullName ?? "");
    setBranchId(account?.branchId ?? "");
  }, [account]);
  if (!account) return null;
  const save = async () => {
    setBusy(true);
    try {
      await updateAccount({ data: {
        userId: account.id, fullName: name,
        branchId: account.role === "student" ? (branchId || null) : undefined,
      }});
      toast.success("Saved"); await onSaved(); onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {account.email}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          {account.role === "student" && (
            <div>
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? "…" : "Save"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
