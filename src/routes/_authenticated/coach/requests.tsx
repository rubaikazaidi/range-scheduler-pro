import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/coach/requests")({ component: CoachRequests });

interface Req {
  id: string; student_id: string; current_assignment_id: string | null;
  requested_slot_id: string; note: string | null; status: "pending" | "approved" | "rejected"; created_at: string;
}
interface Slot { id: string; slot_date: string; start_time: string; end_time: string; branch_id: string; capacity: number }
interface Profile { id: string; full_name: string }

function CoachRequests() {
  const { isCoach, user } = useAuth();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});

  const load = async () => {
    const { data: r } = await supabase.from("reschedule_requests").select("*").order("created_at", { ascending: false });
    const requests = (r as Req[]) ?? [];
    setReqs(requests);
    const slotIds = Array.from(new Set(requests.map((q) => q.requested_slot_id)));
    const studentIds = Array.from(new Set(requests.map((q) => q.student_id)));
    if (slotIds.length) {
      const { data: sl } = await supabase.from("slots").select("*").in("id", slotIds);
      const map: Record<string, Slot> = {};
      ((sl as Slot[]) ?? []).forEach((s) => { map[s.id] = s; });
      setSlots(map);
    }
    if (studentIds.length) {
      const { data: pr } = await supabase.from("profiles").select("id,full_name").in("id", studentIds);
      const m: Record<string, Profile> = {};
      ((pr as Profile[]) ?? []).forEach((p) => { m[p.id] = p; });
      setProfiles(m);
    }
  };
  useEffect(() => { void load(); }, []);

  if (!isCoach) return <p>Access denied.</p>;

  const approve = async (req: Req) => {
    if (!user) return;
    const slot = slots[req.requested_slot_id];
    if (!slot) { toast.error("Requested slot not found"); return; }

    // capacity check
    const { count } = await supabase.from("slot_assignments").select("id", { count: "exact", head: true }).eq("slot_id", slot.id);
    if ((count ?? 0) >= slot.capacity) { toast.error("Requested slot is now full"); return; }

    // remove old assignment if any
    if (req.current_assignment_id) {
      await supabase.from("slot_assignments").delete().eq("id", req.current_assignment_id);
    }
    // create new assignment (avoid duplicate)
    const { error: insErr } = await supabase.from("slot_assignments").insert({ slot_id: slot.id, student_id: req.student_id });
    if (insErr && !String(insErr.message).includes("duplicate")) { toast.error(insErr.message); return; }

    const { error } = await supabase.from("reschedule_requests")
      .update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_note: reviewNote[req.id] || null })
      .eq("id", req.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Approved & moved"); void load();
  };

  const reject = async (req: Req) => {
    if (!user) return;
    const { error } = await supabase.from("reschedule_requests")
      .update({ status: "rejected", reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_note: reviewNote[req.id] || null })
      .eq("id", req.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rejected"); void load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reschedule requests</h1>
        <p className="text-sm text-muted-foreground">Approve or reject student requests to change their slot.</p>
      </div>
      {reqs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">No requests yet.</p>
      ) : (
        <ul className="space-y-3">
          {reqs.map((r) => {
            const slot = slots[r.requested_slot_id];
            return (
              <li key={r.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{profiles[r.student_id]?.full_name || "Student"}</p>
                    <p className="text-sm text-muted-foreground">
                      Wants: {slot ? `${slot.slot_date} · ${slot.start_time.slice(0,5)}–${slot.end_time.slice(0,5)}` : "—"}
                    </p>
                    {r.note && <p className="mt-1 text-sm">"{r.note}"</p>}
                    <p className="mt-1 text-xs text-muted-foreground">Requested {format(new Date(r.created_at), "MMM d, HH:mm")}</p>
                  </div>
                  <Badge variant={r.status === "pending" ? "secondary" : r.status === "approved" ? "default" : "destructive"}>{r.status}</Badge>
                </div>
                {r.status === "pending" && (
                  <div className="mt-3 space-y-2">
                    <Textarea placeholder="Optional note to student" value={reviewNote[r.id] ?? ""} onChange={(e) => setReviewNote((prev) => ({ ...prev, [r.id]: e.target.value }))} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approve(r)}>Approve & move</Button>
                      <Button size="sm" variant="outline" onClick={() => reject(r)}>Reject</Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
