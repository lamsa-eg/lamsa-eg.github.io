// Admin panel notifications + web push subscriptions. Requires an admin session (JWT).
import { actor, admin, clean, cors, out } from "../_shared/wow.ts";
import { notifyAdmins, pushAdmins } from "../_shared/orders.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);
  try {
    const who = await actor(req); if (!who) return out({ error: "غير مصرح" }, 401);
    const body = await req.json(), action = clean(body.action, 20);
    if (action === "list") {
      const [{ data: items, error }, { count: unread }, { data: set }, { count: subs }] = await Promise.all([
        admin.from("admin_notifications").select("id,event_key,title,body,href,severity,read_at,created_at").order("created_at", { ascending: false }).limit(60),
        admin.from("admin_notifications").select("id", { count: "exact", head: true }).is("read_at", null),
        admin.from("notification_settings").select("vapid_public_key").eq("id", "default").maybeSingle(),
        admin.from("admin_push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", who.user.id).eq("active", true)
      ]);
      if (error) throw error;
      return out({ notifications: items || [], unreadCount: unread || 0, vapidPublicKey: set?.vapid_public_key || "", pushSubscriptionCount: subs || 0 });
    }
    if (action === "mark-read") {
      let q = admin.from("admin_notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
      if (body.id) q = q.eq("id", clean(body.id, 40));
      const { error } = await q; if (error) throw error; return out({ ok: true });
    }
    if (action === "delete") {
      if (!["owner", "admin"].includes(who.profile.role)) return out({ error: "المسح للمالك أو المدير فقط" }, 403);
      const { error } = await admin.from("admin_notifications").delete().not("read_at", "is", null); if (error) throw error; return out({ ok: true });
    }
    if (action === "subscribe") {
      const s = body.subscription || {}, endpoint = clean(s.endpoint, 1000), p256dh = clean(s.keys?.p256dh, 200), auth = clean(s.keys?.auth, 100);
      if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return out({ error: "اشتراك غير صالح" }, 400);
      const { error } = await admin.from("admin_push_subscriptions").upsert({ user_id: who.user.id, endpoint, p256dh, auth, active: true }, { onConflict: "endpoint" });
      if (error) throw error; return out({ ok: true });
    }
    if (action === "unsubscribe") { await admin.from("admin_push_subscriptions").update({ active: false }).eq("endpoint", clean(body.endpoint, 1000)).eq("user_id", who.user.id); return out({ ok: true }); }
    if (action === "test") return out({ ok: true, sent: await pushAdmins({ title: "لمسة ✦", body: "اختبار إشعارات الإدارة", url: "/admin/dashboard.html", tag: `test-${Date.now()}` }) });
    if (action === "push-event") {
      const key = clean(body.eventKey, 120), m = key.match(/^memory:([0-9a-f-]{36}):published$/i);
      if (!m) return out({ error: "حدث غير معروف" }, 400);
      const { data: mem } = await admin.from("memories").select("id,recipient_name,orders(order_number)").eq("id", m[1]).maybeSingle();
      if (!mem) return out({ error: "الذكرى غير موجودة" }, 404);
      const order = Array.isArray(mem.orders) ? mem.orders[0] : mem.orders;
      return out({ ok: true, ...(await notifyAdmins({ eventKey: key, title: `اتنشرت ذكرى ${order?.order_number || ""}`, body: `ذكرى ${mem.recipient_name || ""} جاهزة للـQR والـNFC`, href: `/admin/memory-editor.html?id=${mem.id}`, severity: "info" })) });
    }
    return out({ error: "إجراء غير معروف" }, 400);
  } catch (e) { console.error(e); return out({ error: "تعذر تنفيذ الطلب" }, 500); }
});
