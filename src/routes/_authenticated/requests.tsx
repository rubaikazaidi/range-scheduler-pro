import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/requests")({ component: StudentRequests });

interface Req {
  id: string; requested_slot_id: string; note: string | null; status: "pending" | "approved" | "rejected";
  created_at: string; review_note: string | null; reviewed_at: string | null;
}
interface Slot { id: string; slot_date: string; start_time: string; end_time: string }

function StudentRequests() {
  const { user } = useAuth();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [slots, setSlots] = useState<Record<string, Slot>>({});

  const load = async () => {
    if (!user) return;
    const { data: r } = await supabase.from("reschedule_requests").select("*").eq("student_id", user.id).order("created_at", { ascending: false });
    const list = (r as Req[]) ?? [];
    setReqs(list);
    const ids = Array.from(new Set(list.map((x) => x.requested_slot_id)));
    if (ids.length) {
      const { data: sl } = await supabase.from("slots").select("id,slot_date,start_time,end_time").in("id", ids);
      const m: Record<string, Slot> = {};
      ((sl as Slot[]) ?? []).forEach((s) => { m[s.id] = s; });
      setSlots(m);
    }
  };
  useEffect(() => { void load(); }, [user]);

  const cancel = async (id: string) => {
    const { error } = await supabase.from("reschedule_requests").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Cancelled"); void load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">My requests</h1>
        <p className="text-sm text-muted-foreground">Status of your reschedule requests.</p>
      </div>
      {reqs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">No requests yet.</p>
      ) : (
        <ul className="space-y-3">
          {reqs.map((r) => {
            const s = slots[r.requested_slot_id];
            return (
              <li key={r.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {s ? `${format(new Date(s.slot_date + "T00:00"), "EEE, MMM d")} · ${s.start_time.slice(0,5)}–${s.end_time.slice(0,5)}` : "—"}
                    </p>
                    {r.note && <p className="text-sm text-muted-foreground">"{r.note}"</p>}
                    <p className="mt-1 text-xs text-muted-foreground">Submitted {format(new Date(r.created_at), "MMM d, HH:mm")}</p>
                    {r.review_note && <p className="mt-2 text-sm"><span className="font-medium">Coach:</span> {r.review_note}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === "pending" ? "secondary" : r.status === "approved" ? "default" : "destructive"}>{r.status}</Badge>
                    {r.status === "pending" && (
                      <Button size="icon" variant="ghost" onClick={() => cancel(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
