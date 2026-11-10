// Shared helpers for order lifecycle functions (v39).
import webpush from "web-push";
import { admin, sha256Text } from "./wow.ts";

export const ORDER_BUCKET = "order-uploads";

/** Finds an order by number + tracking token (any submission state). */
export async function orderByToken(orderNumber: string, trackingToken: string, columns = "*") {
  if (!orderNumber || !trackingToken || trackingToken.length > 200) return null;
  const hash = await sha256Text(trackingToken);
  const { data, error } = await admin.from("orders").select(columns).eq("order_number", orderNumber).eq("tracking_token_hash", hash).maybeSingle();
  if (error) throw error;
  return data as any;
}

/** Names of files that really exist in storage under orders/<id>/. */
export async function storedNames(orderId: string) {
  const { data, error } = await admin.storage.from(ORDER_BUCKET).list(orderId, { limit: 200 });
  if (error) throw error;
  return new Set((data || []).filter((x: any) => x.id !== null).map((x: any) => `${orderId}/${x.name}`));
}

export async function event(orderId: string, eventType: string, details: Record<string, unknown> = {}) {
  await admin.from("order_events").insert({ order_id: orderId, event_type: eventType, details });
}

/** Creates an admin notification (idempotent per eventKey) and sends web push to staff devices. */
export async function notifyAdmins(n: { eventKey: string; title: string; body?: string; href?: string; severity?: string }) {
  const { data, error } = await admin.from("admin_notifications")
    .upsert({ event_key: n.eventKey, title: n.title.slice(0, 140), body: (n.body || "").slice(0, 400), href: n.href || "/admin/dashboard.html", severity: n.severity || "info" }, { onConflict: "event_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  if (!data?.length) return { created: false, pushed: 0 };
  return { created: true, pushed: await pushAdmins({ title: n.title, body: n.body || "", url: n.href || "/admin/dashboard.html", tag: n.eventKey }) };
}

export async function pushAdmins(payload: { title: string; body: string; url: string; tag: string }) {
  const { data: set } = await admin.from("notification_settings").select("vapid_public_key,vapid_private_key").eq("id", "default").maybeSingle();
  if (!set?.vapid_public_key || !set?.vapid_private_key) return 0;
  const { data: subs } = await admin.from("admin_push_subscriptions").select("id,endpoint,p256dh,auth").eq("active", true);
  if (!subs?.length) return 0;
  webpush.setVapidDetails(`mailto:${Deno.env.get("NOTIFY_EMAIL") || "notifications@example.com"}`, set.vapid_public_key, set.vapid_private_key);
  let sent = 0;
  for (const s of subs) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 86400 }); sent++; }
    catch (e: any) { if ([404, 410].includes(Number(e?.statusCode || 0))) await admin.from("admin_push_subscriptions").update({ active: false }).eq("id", s.id); }
  }
  return sent;
}

export const money = (n: unknown) => Number(n || 0);
