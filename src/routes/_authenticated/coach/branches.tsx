import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, Building2, ChevronDown, ChevronRight, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/coach/branches")({ component: BranchesPage });

interface Branch { id: string; name: string; location: string | null }
interface Member { id: string; full_name: string; primary_branch_id: string | null; role: "coach" | "student" | "admin" }

function BranchesPage() {
  const { isCoach, isAdmin } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState<string | null>(null); // branchId
  const [addTab, setAddTab] = useState<"coach" | "student">("student");
  const [search, setSearch] = useState("");
  const [switchConfirm, setConfirm] = useState<{ member: Member; targetBranch: Branch } | null>(null);

  const branchById = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  const load = async () => {
    const [{ data: br }, { data: profs }, { data: roles }] = await Promise.all([
      supabase.from("branches").select("*").order("name"),
      supabase.from("profiles").select("id,full_name,primary_branch_id"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    setBranches((br as Branch[]) ?? []);
    const roleMap = new Map<string, string>();
    (roles ?? []).forEach((r) => {
      const cur = roleMap.get(r.user_id);
      if (cur === "admin") return;
      if (r.role === "admin" || (r.role === "coach" && cur !== "admin") || !cur) {
        roleMap.set(r.user_id, r.role as string);
      }
    });
    setMembers(((profs ?? []) as { id: string; full_name: string; primary_branch_id: string | null }[]).map((p) => ({
      ...p, role: (roleMap.get(p.id) ?? "student") as Member["role"],
    })));
  };
  useEffect(() => { void load(); }, []);

  if (!isCoach) return <p>Access denied.</p>;

  const create = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("branches").insert({ name: name.trim(), location: location.trim() || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Branch created");
    setName(""); setLocation(""); setOpen(false); void load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this branch? This will remove related slots.")) return;
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); void load();
  };
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const assign = async (memberId: string, branchId: string) => {
    const { error } = await supabase.from("profiles").update({ primary_branch_id: branchId }).eq("id", memberId);
    if (error) { toast.error(error.message); return; }
    toast.success("Member assigned");
    void load();
  };

  const handleAdd = (m: Member, branchId: string) => {
    if (m.primary_branch_id === branchId) {
      toast.info("Already in this branch");
      return;
    }
    if (m.role === "student" && m.primary_branch_id) {
      const target = branchById.get(branchId);
      if (target) { setConfirm({ member: m, targetBranch: target }); return; }
    }
    void assign(m.id, branchId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Branches</h1>
          <p className="text-sm text-muted-foreground">Manage range locations and view members.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> New branch</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New branch</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, address…" /></div>
            </div>
            <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {branches.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          <Building2 className="mx-auto mb-2 h-8 w-8" />
          No branches yet. Create your first one.
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map((b) => {
            const branchStudents = members.filter((m) => m.primary_branch_id === b.id && m.role === "student");
            const branchCoaches = members.filter((m) => m.primary_branch_id === b.id && (m.role === "coach" || m.role === "admin"));
            const isOpen = expanded.has(b.id);
            return (
              <div key={b.id} className="rounded-lg border border-border bg-card">
                <div className="flex items-start justify-between p-4">
                  <button className="flex flex-1 items-start gap-2 text-left" onClick={() => toggle(b.id)}>
                    {isOpen ? <ChevronDown className="mt-1 h-4 w-4" /> : <ChevronRight className="mt-1 h-4 w-4" />}
                    <div>
                      <h3 className="font-medium">{b.name}</h3>
                      {b.location && <p className="text-sm text-muted-foreground">{b.location}</p>}
                      <div className="mt-2 flex gap-2">
                        <Badge variant="secondary">{branchCoaches.length} coach{branchCoaches.length === 1 ? "" : "es"}</Badge>
                        <Badge variant="secondary">{branchStudents.length} student{branchStudents.length === 1 ? "" : "s"}</Badge>
                      </div>
                    </div>
                  </button>
                  <div className="flex gap-1">
                    {isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => { setAddOpen(b.id); setSearch(""); setAddTab("student"); }}>
                        <UserPlus className="mr-1 h-4 w-4" /> Add member
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {isOpen && (
                  <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Coaches</p>
                      {branchCoaches.length === 0 ? <p className="text-sm text-muted-foreground">None assigned.</p>
                        : <ul className="space-y-1 text-sm">{branchCoaches.map((m) => <li key={m.id}>{m.full_name || "(no name)"}</li>)}</ul>}
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Students</p>
                      {branchStudents.length === 0 ? <p className="text-sm text-muted-foreground">No students yet.</p>
                        : <ul className="space-y-1 text-sm">{branchStudents.map((m) => <li key={m.id}>{m.full_name || "(no name)"}</li>)}</ul>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen !== null} onOpenChange={(o) => !o && setAddOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add member to {addOpen ? branchById.get(addOpen)?.name : ""}</DialogTitle>
          </DialogHeader>
          <Tabs value={addTab} onValueChange={(v) => setAddTab(v as "coach" | "student")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="student">Students</TabsTrigger>
              <TabsTrigger value="coach">Coaches</TabsTrigger>
            </TabsList>
            <Input className="mt-3" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {(["student", "coach"] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-3 max-h-80 overflow-y-auto">
                {(() => {
                  const list = members.filter((m) => {
                    if (tab === "student" && m.role !== "student") return false;
                    if (tab === "coach" && m.role !== "coach" && m.role !== "admin") return false;
                    if (m.primary_branch_id === addOpen) return false;
                    if (search && !(m.full_name || "").toLowerCase().includes(search.toLowerCase())) return false;
                    return true;
                  });
                  if (list.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">No {tab}s available.</p>;
                  return (
                    <ul className="divide-y divide-border">
                      {list.map((m) => {
                        const cur = m.primary_branch_id ? branchById.get(m.primary_branch_id) : null;
                        return (
                          <li key={m.id} className="flex items-center justify-between py-2">
                            <div>
                              <p className="text-sm font-medium">{m.full_name || "(no name)"}</p>
                              <p className="text-xs text-muted-foreground">{cur ? `In ${cur.name}` : "Unassigned"}</p>
                            </div>
                            <Button size="sm" onClick={() => addOpen && handleAdd(m, addOpen)}>Add</Button>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={switchConfirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch branch?</AlertDialogTitle>
            <AlertDialogDescription>
              {switchConfirm && (() => {
                const cur = switchConfirm.member.primary_branch_id ? branchById.get(switchConfirm.member.primary_branch_id) : null;
                return `Student is already in '${cur?.name ?? "another branch"}'. Continue to switch them to '${switchConfirm.targetBranch.name}' branch?`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (switchConfirm) void assign(switchConfirm.member.id, switchConfirm.targetBranch.id);
              setConfirm(null);
            }}>Switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
