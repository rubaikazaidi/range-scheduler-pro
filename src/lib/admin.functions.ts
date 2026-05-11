import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const createCoachInput = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(6).optional(),
});

export const createCoachAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createCoachInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is admin
    const { data: roleRow, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Response(roleErr.message, { status: 500 });
    if (!roleRow) throw new Response("Forbidden: admin only", { status: 403 });

    const password = data.password ?? "Lakshya@123";

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createErr || !created.user) {
      throw new Response(createErr?.message ?? "Failed to create user", { status: 400 });
    }

    const newId = created.user.id;

    // The signup trigger auto-inserted a student role + pending profile.
    // Replace with coach role and approved profile.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    const { error: roleInsertErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: "coach" });
    if (roleInsertErr) throw new Response(roleInsertErr.message, { status: 500 });

    await supabaseAdmin
      .from("profiles")
      .update({ status: "approved", full_name: data.fullName })
      .eq("id", newId);

    return { id: newId, email: data.email, password };
  });
