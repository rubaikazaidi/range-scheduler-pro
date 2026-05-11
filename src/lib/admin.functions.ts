import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getRoles(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as string);
}
async function assertAdmin(userId: string) {
  const roles = await getRoles(userId);
  if (!roles.includes("admin")) throw new Response("Forbidden: admin only", { status: 403 });
}
async function assertStaff(userId: string) {
  const roles = await getRoles(userId);
  if (!roles.includes("admin") && !roles.includes("coach"))
    throw new Response("Forbidden: staff only", { status: 403 });
}

const createCoachInput = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(6).optional(),
});

export const createCoachAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createCoachInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const password = data.password ?? "Lakshya@123";
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password, email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Response(error?.message ?? "Failed", { status: 400 });
    const newId = created.user.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: "coach" });
    await supabaseAdmin.from("profiles").update({ status: "approved", full_name: data.fullName }).eq("id", newId);
    return { id: newId, email: data.email, password };
  });

const createStudentInput = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  branchId: z.string().uuid(),
  password: z.string().min(6).optional(),
});

export const createStudentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createStudentInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertStaff(context.userId);
    const password = data.password ?? "Lakshya@123";
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password, email_confirm: true,
      user_metadata: { full_name: data.fullName, primary_branch_id: data.branchId },
    });
    if (error || !created.user) throw new Response(error?.message ?? "Failed", { status: 400 });
    const newId = created.user.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: "student" });
    await supabaseAdmin.from("profiles").update({
      status: "approved", full_name: data.fullName, primary_branch_id: data.branchId,
    }).eq("id", newId);
    return { id: newId, email: data.email, password };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Response("Cannot delete yourself", { status: 400 });
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    userId: z.string().uuid(),
    fullName: z.string().min(1).optional(),
    branchId: z.string().uuid().nullable().optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const patch: { full_name?: string; primary_branch_id?: string | null } = {};
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.branchId !== undefined) patch.primary_branch_id = data.branchId;
    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Response(error.message, { status: 400 });
    }
    return { ok: true };
  });

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context.userId);
    const { data: usersResp, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Response(error.message, { status: 500 });
    const ids = usersResp.users.map((u) => u.id);
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,full_name,primary_branch_id,status").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids),
    ]);
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role as string);
      roleMap.set(r.user_id, arr);
    });
    return usersResp.users.map((u) => {
      const p = profMap.get(u.id);
      const rs = roleMap.get(u.id) ?? [];
      return {
        id: u.id,
        email: u.email ?? "",
        fullName: p?.full_name ?? "",
        branchId: p?.primary_branch_id ?? null,
        status: (p?.status as string) ?? "pending",
        role: rs.includes("admin") ? "admin" : rs.includes("coach") ? "coach" : "student",
      };
    });
  });

const createFirstAdminInput = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(6),
});

export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createFirstAdminInput.parse(data))
  .handler(async ({ data }) => {
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
    if (countErr) throw new Response(countErr.message, { status: 500 });
    if ((count ?? 0) > 0) throw new Response("An admin account already exists.", { status: 403 });
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Response(error?.message ?? "Failed", { status: 400 });
    const newId = created.user.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: "admin" });
    await supabaseAdmin.from("profiles").update({ status: "approved", full_name: data.fullName }).eq("id", newId);
    return { id: newId, email: data.email };
  });
