// Sends the one-time owner invitation to the owner email stored in app_config
// (key owner_email). Safe to expose: it can only ever email that fixed address,
// only while no owner exists, and is rate limited.
import { admin, cors, out, rateAllowed } from "../_shared/wow.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!(await rateAllowed("owner-invite", "GLOBAL", 3, 3600))) return out({ error: "محاولات كثيرة" }, 429);
    const { count } = await admin.from("admin_profiles").select("user_id", { count: "exact", head: true }).eq("role", "owner");
    if ((count || 0) > 0) return out({ error: "تم التأسيس بالفعل" }, 409);
    const { data: row } = await admin.from("app_config").select("value").eq("key", "owner_email").maybeSingle();
    const email = String(row?.value || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return out({ error: "إيميل المالك غير مضبوط" }, 400);
    const site = (Deno.env.get("SITE_URL") || "https://lamsa-eg.github.io").replace(/\/+$/, "");
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${site}/admin/set-password.html` });
    if (error || !data.user) return out({ error: error?.message || "تعذر إرسال الدعوة" }, 400);
    const { error: pErr } = await admin.from("admin_profiles").upsert({ user_id: data.user.id, role: "owner" }, { onConflict: "user_id" });
    if (pErr) throw pErr;
    await admin.from("app_config").delete().eq("key", "owner_email");
    return out({ ok: true });
  } catch (e) { console.error(e); return out({ error: "تعذر إرسال الدعوة" }, 500); }
});
