// Optional cover ("logo") and background images, uploaded after the order is complete.
// stage=prepare -> signed upload tickets; stage=finalize -> verify + attach to the memory.
import { admin, clean, cors, out } from "../_shared/wow.ts";
import { ORDER_BUCKET, event, orderByToken, storedNames } from "../_shared/orders.ts";

const LIMIT: Record<string, number> = { logo: 3 * 1048576, background: 5 * 1048576 };
const MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const safeName = (s: string) => s.normalize("NFKD").replace(/[^\w.\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(-100) || "image";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const order = await orderByToken(clean(body.orderNumber, 50), clean(body.trackingToken, 200), "id,submission_state,memories(id)");
    if (!order || order.submission_state !== "complete") return out({ error: "بيانات الطلب غير صحيحة" }, 401);
    const memory = Array.isArray(order.memories) ? order.memories[0] : order.memories;
    if (body.stage === "prepare") {
      const files = (Array.isArray(body.files) ? body.files : []).slice(0, 2);
      const kinds = new Set<string>(); const tickets = [];
      for (const f of files) {
        const kind = clean(f?.kind, 20), mime = clean(f?.mimeType, 40).toLowerCase(), size = Number(f?.size || 0);
        if (!LIMIT[kind] || kinds.has(kind) || !MIME.has(mime) || size <= 0 || size > LIMIT[kind]) return out({ error: "صورة الغلاف أو الخلفية غير صالحة" }, 400);
        kinds.add(kind);
        const { data: old } = await admin.from("order_uploads").select("id,storage_path").eq("order_id", order.id).eq("kind", kind);
        if (old?.length) { await admin.storage.from(ORDER_BUCKET).remove(old.map((x: any) => x.storage_path)); await admin.from("order_uploads").delete().in("id", old.map((x: any) => x.id)); }
        const path = `${order.id}/${crypto.randomUUID()}-${safeName(clean(f?.name, 100))}`;
        const { data: signed, error } = await admin.storage.from(ORDER_BUCKET).createSignedUploadUrl(path);
        if (error) throw error;
        const { error: iErr } = await admin.from("order_uploads").insert({ order_id: order.id, client_index: null, kind, storage_path: path, original_name: safeName(clean(f?.name, 100)), mime_type: mime, bytes: size });
        if (iErr) throw iErr;
        tickets.push({ kind, path, token: signed.token });
      }
      return out({ uploads: tickets });
    }
    if (body.stage === "finalize") {
      const { data: rows, error } = await admin.from("order_uploads").select("id,kind,storage_path,original_name").eq("order_id", order.id).in("kind", ["logo", "background"]);
      if (error) throw error;
      const stored = await storedNames(order.id), attached = [];
      for (const r of rows || []) {
        if (!stored.has(r.storage_path)) continue;
        await admin.from("order_uploads").update({ uploaded_at: new Date().toISOString() }).eq("id", r.id);
        if (memory?.id) {
          await admin.from("memory_media").delete().eq("memory_id", memory.id).eq("kind", r.kind);
          await admin.from("memory_media").insert({ memory_id: memory.id, kind: r.kind, storage_bucket: ORDER_BUCKET, storage_path: r.storage_path, caption: r.original_name, sort_order: r.kind === "logo" ? -2 : -1, source_upload_id: r.id });
        }
        attached.push(r.kind);
      }
      await event(order.id, "special_media_attached", { kinds: attached });
      return out({ ok: true, attached });
    }
    return out({ error: "stage غير معروف" }, 400);
  } catch (e) { console.error(e); return out({ error: "تعذر رفع صورة الغلاف أو الخلفية" }, 500); }
});
