import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ChevronLeft, ChevronRight, Plus, Trash2, UserPlus, X } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";

export const Route = createFileRoute("/_authenticated/coach/schedule")({ component: CoachSchedule });

interface Branch { id: string; name: string }
interface Slot { id: string; branch_id: string; slot_date: string; start_time: string; end_time: string; capacity: number; notes: string | null }
interface Assignment { id: string; slot_id: string; student_id: string }
interface Profile { id: string; full_name: string; primary_branch_id: string | null; status: string }

function CoachSchedule() {
  const { isCoach, user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);

  // create slot dialog
  const [openNew, setOpenNew] = useState(false);
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("07:00");
  const [capacity, setCapacity] = useState(10);
  const [notes, setNotes] = useState("");

  // assign dialog
  const [assignSlot, setAssignSlot] = useState<Slot | null>(null);
  const [studentToAdd, setStudentToAdd] = useState<string>("");

  useEffect(() => {
    supabase.from("branches").select("*").order("name").then(({ data }) => {
      const list = (data as Branch[]) ?? [];
      setBranches(list);
      if (list[0] && !branchId) setBranchId(list[0].id);
    });
  }, []);

  const load = async () => {
    if (!branchId) return;
    const [{ data: sl }, { data: st }] = await Promise.all([
      supabase.from("slots").select("*").eq("branch_id", branchId).eq("slot_date", date).order("start_time"),
      supabase.from("profiles").select("id,full_name,primary_branch_id,status").eq("primary_branch_id", branchId).eq("status", "approved"),
    ]);
    setSlots((sl as Slot[]) ?? []);
    setStudents((st as Profile[]) ?? []);
    const ids = ((sl as Slot[]) ?? []).map((s) => s.id);
    if (ids.length) {
      const { data: ass } = await supabase.from("slot_assignments").select("*").in("slot_id", ids);
      setAssignments((ass as Assignment[]) ?? []);
    } else setAssignments([]);
  };
  useEffect(() => { void load(); }, [branchId, date]);

  if (!isCoach) return <p>Access denied.</p>;

  const studentName = (id: string) => students.find((s) => s.id === id)?.full_name || "Student";
  const slotAssignments = (slotId: string) => assignments.filter((a) => a.slot_id === slotId);

  const createSlot = async () => {
    if (!branchId || !user) return;
    const { error } = await supabase.from("slots").insert({
      branch_id: branchId, slot_date: date, start_time: start, end_time: end, capacity, notes: notes || null, created_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Slot created");
    setOpenNew(false); setNotes(""); void load();
  };
  const deleteSlot = async (id: string) => {
    if (!confirm("Delete this slot?")) return;
    const { error } = await supabase.from("slots").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void load();
  };
  const assignStudent = async () => {
    if (!assignSlot || !studentToAdd) return;
    const taken = slotAssignments(assignSlot.id).length;
    if (taken >= assignSlot.capacity) { toast.error("Slot is full"); return; }
    const { error } = await supabase.from("slot_assignments").insert({ slot_id: assignSlot.id, student_id: studentToAdd });
    if (error) { toast.error(error.message); return; }
    toast.success("Assigned");
    setStudentToAdd(""); void load();
  };
  const unassign = async (id: string) => {
    const { error } = await supabase.from("slot_assignments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const availableToAssign = useMemo(() => {
    if (!assignSlot) return [];
    const assignedIds = new Set(slotAssignments(assignSlot.id).map((a) => a.student_id));
    return students.filter((s) => !assignedIds.has(s.id));
  }, [assignSlot, students, assignments]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Schedule</h1>
          <p className="text-sm text-muted-foreground">Build daily slots and assign students.</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button disabled={!branchId}><Plus className="mr-1 h-4 w-4" /> New slot</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New slot</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div><Label>End</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
              <div><Label>Capacity</Label><Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Lane assignments, equipment notes…" /></div>
            </div>
            <DialogFooter><Button onClick={createSlot}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Branch</Label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Select branch" /></SelectTrigger>
            <SelectContent>
              {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setDate(format(addDays(parseISO(date), -1), "yyyy-MM-dd"))}><ChevronLeft className="h-4 w-4" /></Button>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          <Button size="icon" variant="outline" onClick={() => setDate(format(addDays(parseISO(date), 1), "yyyy-MM-dd"))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {!branchId ? (
        <p className="text-muted-foreground">Create a branch first.</p>
      ) : slots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">No slots for this day.</div>
      ) : (
        <div className="space-y-3">
          {slots.map((s) => {
            const ass = slotAssignments(s.id);
            return (
              <div key={s.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</p>
                    <p className="text-sm text-muted-foreground">{ass.length} / {s.capacity} shooters{s.notes ? ` · ${s.notes}` : ""}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setAssignSlot(s)}><UserPlus className="mr-1 h-4 w-4" /> Assign</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteSlot(s.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {ass.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ass.map((a) => (
                      <Badge key={a.id} variant="secondary" className="gap-1">
                        {studentName(a.student_id)}
                        <button onClick={() => unassign(a.id)} className="ml-1 opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!assignSlot} onOpenChange={(o) => !o && setAssignSlot(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign student</DialogTitle></DialogHeader>
          {availableToAssign.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approved students available in this branch.</p>
          ) : (
            <Select value={studentToAdd} onValueChange={setStudentToAdd}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {availableToAssign.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name || "(no name)"}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <DialogFooter><Button onClick={assignStudent} disabled={!studentToAdd}>Assign</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
