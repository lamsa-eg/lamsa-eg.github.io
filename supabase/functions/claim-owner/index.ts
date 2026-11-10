// One-time owner setup: creates the first owner account when OWNER_SETUP_CODE matches.
// After an owner exists this function always refuses.
import { admin, clean, cors, gatewayOk, out, rateAllowed, sha256Text, trustedIp } from "../_shared/wow.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);
  try {
    const ip = (await gatewayOk(req)) ? trustedIp(req) : (req.headers.get("cf-connecting-ip") || "unknown");
    if (!(await rateAllowed("claim-owner", ip, 5, 3600))) return out({ error: "محاولات كثيرة" }, 429);
    const expected = Deno.env.get("OWNER_SETUP_CODE") || "";
    if (expected.length < 20) return out({ error: "التأسيس غير مفعل" }, 403);
    const body = await req.json();
    const code = clean(body.code, 200), email = clean(body.email, 200).toLowerCase(), password = String(body.password || ""), displayName = clean(body.displayName, 80);
    if ((await sha256Text(code)) !== (await sha256Text(expected))) return out({ error: "كود التأسيس غير صحيح" }, 403);
    const { count, error: cErr } = await admin.from("admin_profiles").select("user_id", { count: "exact", head: true }).eq("role", "owner");
    if (cErr) throw cErr; if ((count || 0) > 0) return out({ error: "تم التأسيس بالفعل" }, 409);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 12) return out({ error: "اكتب إيميل صحيح وكلمة سر 12 حرف على الأقل" }, 400);
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
    if (error || !data.user) return out({ error: error?.message || "تعذر إنشاء الحساب" }, 400);
    const { error: pErr } = await admin.from("admin_profiles").insert({ user_id: data.user.id, display_name: displayName || null, role: "owner" });
    if (pErr) { await admin.auth.admin.deleteUser(data.user.id); throw pErr; }
    return out({ ok: true });
  } catch (e) { console.error(e); return out({ error: "تعذر إتمام التأسيس" }, 500); }
});
