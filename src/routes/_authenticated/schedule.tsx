import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { Calendar, Repeat } from "lucide-react";

export const Route = createFileRoute("/_authenticated/schedule")({ component: StudentSchedule });

interface Slot { id: string; branch_id: string; slot_date: string; start_time: string; end_time: string; capacity: number; notes: string | null }
interface Assignment { id: string; slot_id: string; student_id: string }

function StudentSchedule() {
  const { user, profile } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mySlots, setMySlots] = useState<Record<string, Slot>>({});
  const [branchSlots, setBranchSlots] = useState<Slot[]>([]);
  const [openReq, setOpenReq] = useState<Assignment | null>(null);
  const [requestedSlot, setRequestedSlot] = useState<string>("");
  const [note, setNote] = useState("");

  const today = format(new Date(), "yyyy-MM-dd");

  const load = async () => {
    if (!user || !profile?.primary_branch_id) return;
    const { data: ass } = await supabase.from("slot_assignments").select("*").eq("student_id", user.id);
    const a = (ass as Assignment[]) ?? [];
    setAssignments(a);
    const ids = a.map((x) => x.slot_id);
    if (ids.length) {
      const { data: sl } = await supabase.from("slots").select("*").in("id", ids);
      const m: Record<string, Slot> = {};
      ((sl as Slot[]) ?? []).forEach((s) => { m[s.id] = s; });
      setMySlots(m);
    }
    const { data: bs } = await supabase.from("slots").select("*")
      .eq("branch_id", profile.primary_branch_id)
      .gte("slot_date", today)
      .order("slot_date").order("start_time");
    setBranchSlots((bs as Slot[]) ?? []);
  };
  useEffect(() => { void load(); }, [user, profile?.primary_branch_id]);

  if (profile?.status !== "approved") {
    return <p className="text-muted-foreground">Your account is {profile?.status}. Once a coach approves you, your schedule will appear here.</p>;
  }

  const ordinal = (n: number) => {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    switch (n % 10) { case 1: return `${n}st`; case 2: return `${n}nd`; case 3: return `${n}rd`; default: return `${n}th`; }
  };
  const batchNameFor = (slot: Slot) => {
    const sameDay = branchSlots
      .filter((b) => b.slot_date === slot.slot_date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const idx = sameDay.findIndex((b) => b.id === slot.id);
    return idx >= 0 ? `${ordinal(idx + 1)} Batch` : "";
  };

  const upcoming = useMemo(() => {
    return assignments
      .map((a) => ({ a, s: mySlots[a.slot_id] }))
      .filter((x) => x.s && x.s.slot_date >= today)
      .sort((x, y) => (x.s.slot_date + x.s.start_time).localeCompare(y.s.slot_date + y.s.start_time));
  }, [assignments, mySlots, today]);

  const submitRequest = async () => {
    if (!user || !openReq || !requestedSlot) return;
    const { error } = await supabase.from("reschedule_requests").insert({
      student_id: user.id,
      current_assignment_id: openReq.id,
      requested_slot_id: requestedSlot,
      note: note || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Request submitted");
    setOpenReq(null); setRequestedSlot(""); setNote("");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">My schedule</h1>
        <p className="text-sm text-muted-foreground">Your assigned shooting slots.</p>
      </div>

      {upcoming.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          <Calendar className="mx-auto mb-2 h-8 w-8" /> No upcoming slots.
        </div>
      ) : (
        <ul className="space-y-3">
          {upcoming.map(({ a, s }) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
              <div>
                <p className="font-semibold">{format(new Date(s.slot_date + "T00:00"), "EEE, MMM d")} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</p>
                {s.notes && <p className="text-sm text-muted-foreground">{s.notes}</p>}
              </div>
              <Button size="sm" variant="outline" onClick={() => setOpenReq(a)}>
                <Repeat className="mr-1 h-4 w-4" /> Request change
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!openReq} onOpenChange={(o) => !o && setOpenReq(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request a different slot</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Pick a new slot</Label>
              <Select value={requestedSlot} onValueChange={setRequestedSlot}>
                <SelectTrigger><SelectValue placeholder="Choose slot" /></SelectTrigger>
                <SelectContent>
                  {branchSlots.filter((s) => s.id !== openReq?.slot_id).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {format(new Date(s.slot_date + "T00:00"), "EEE, MMM d")} · {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for the change…" />
            </div>
          </div>
          <DialogFooter><Button onClick={submitRequest} disabled={!requestedSlot}>Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
