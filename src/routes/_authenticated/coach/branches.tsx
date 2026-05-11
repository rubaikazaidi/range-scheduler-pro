import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Building2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/coach/branches")({ component: BranchesPage });

interface Branch { id: string; name: string; location: string | null }

function BranchesPage() {
  const { isCoach } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  const load = async () => {
    const { data } = await supabase.from("branches").select("*").order("name");
    setBranches((data as Branch[]) ?? []);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Branches</h1>
          <p className="text-sm text-muted-foreground">Manage range locations.</p>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <div key={b.id} className="flex items-start justify-between rounded-lg border border-border bg-card p-4">
              <div>
                <h3 className="font-medium">{b.name}</h3>
                {b.location && <p className="text-sm text-muted-foreground">{b.location}</p>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
