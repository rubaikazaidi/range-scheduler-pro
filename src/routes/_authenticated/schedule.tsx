import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { Calendar, Repeat } from "lucide-react";

export const Route = createFileRoute("/_authenticated/schedule")({ component: StudentSchedule });

interface Slot { id: string; branch_id: string; slot_date: string; start_time: string; end_time: string; capacity: number; notes: string | null }
interface Assignment { id: string; slot_id: string; student_id: string }
interface ProfileLite { id: string; full_name: string }

function StudentSchedule() {
  const { user, profile } = useAuth();
  const [branchSlots, setBranchSlots] = useState<Slot[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [shooters, setShooters] = useState<Record<string, ProfileLite>>({});
  const [openReq, setOpenReq] = useState<Assignment | null>(null);
  const [requestedSlot, setRequestedSlot] = useState<string>("");
  const [note, setNote] = useState("");

  const today = format(new Date(), "yyyy-MM-dd");

  const load = async () => {
    if (!user || !profile?.primary_branch_id) return;
    const { data: bs } = await supabase.from("slots").select("*")
      .eq("branch_id", profile.primary_branch_id)
      .gte("slot_date", today)
      .order("slot_date").order("start_time");
    const slotList = (bs as Slot[]) ?? [];
    setBranchSlots(slotList);

    const ids = slotList.map((s) => s.id);
    if (ids.length) {
      const { data: ass } = await supabase.from("slot_assignments").select("*").in("slot_id", ids);
      const aList = (ass as Assignment[]) ?? [];
      setAllAssignments(aList);
      const studentIds = Array.from(new Set(aList.map((a) => a.student_id)));
      if (studentIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name").in("id", studentIds);
        const map: Record<string, ProfileLite> = {};
        ((profs as ProfileLite[]) ?? []).forEach((p) => { map[p.id] = p; });
        setShooters(map);
      } else setShooters({});
    } else {
      setAllAssignments([]);
      setShooters({});
    }
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

  // Group slots by date, ordered by start_time
  const days = useMemo(() => {
    const byDate = new Map<string, Slot[]>();
    branchSlots.forEach((s) => {
      const arr = byDate.get(s.slot_date) ?? [];
      arr.push(s);
      byDate.set(s.slot_date, arr);
    });
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, sl]) => ({
        date,
        slots: sl.sort((a, b) => a.start_time.localeCompare(b.start_time)),
      }));
  }, [branchSlots]);

  const myAssignmentForSlot = (slotId: string) =>
    allAssignments.find((a) => a.slot_id === slotId && a.student_id === user?.id);

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
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My schedule</h1>
        <p className="text-sm text-muted-foreground">View all batches for your branch. You can request a change for your own batch only.</p>
      </div>

      {days.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          <Calendar className="mx-auto mb-2 h-8 w-8" /> No upcoming slots.
        </div>
      ) : (
        days.map(({ date, slots }) => (
          <div key={date} className="space-y-2">
            <h2 className="text-lg font-semibold">{format(new Date(date + "T00:00"), "EEE, MMM d")}</h2>
            <div className="space-y-3">
              {slots.map((s, idx) => {
                const mine = myAssignmentForSlot(s.id);
                const ass = allAssignments.filter((a) => a.slot_id === s.id);
                return (
                  <div key={s.id} className={`rounded-lg border bg-card p-4 ${mine ? "border-primary" : "border-border"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {ordinal(idx + 1)} Batch · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                          {mine && <Badge className="ml-2" variant="default">Your batch</Badge>}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {ass.length} / {s.capacity} shooters{s.notes ? ` · ${s.notes}` : ""}
                        </p>
                      </div>
                      {mine && (
                        <Button size="sm" variant="outline" onClick={() => setOpenReq(mine)}>
                          <Repeat className="mr-1 h-4 w-4" /> Request change
                        </Button>
                      )}
                    </div>
                    {ass.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ass.map((a) => (
                          <Badge key={a.id} variant={a.student_id === user?.id ? "default" : "secondary"}>
                            {shooters[a.student_id]?.full_name || "Shooter"}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
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
