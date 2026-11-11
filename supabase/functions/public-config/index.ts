// Public catalog for the site: packages, shipping zones, game catalog, priced add-ons,
// occasion packs and the active season. Only public, non-personal data.
import { admin, cors, out } from "../_shared/wow.ts";

let cache: { at: number; body: unknown } | null = null;

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!["GET", "POST"].includes(req.method)) return out({ error: "Method not allowed" }, 405);
  try {
    if (cache && Date.now() - cache.at < 30_000) return out(cache.body);
    const today = new Date().toISOString().slice(0, 10);
    const [pk, zones, games, addons, packs, seasons, settings] = await Promise.all([
      admin.from("packages").select("id,label,price,sort_order,max_images,max_image_bytes,allow_video,max_video_bytes,allow_audio,max_audio_bytes,allow_song,max_games,is_recommended,tagline,features").eq("active", true).order("sort_order"),
      admin.from("shipping_zones").select("id,label,fee,sort_order").eq("active", true).order("sort_order"),
      admin.from("game_catalog").select("key,label,description,active,sort_order,min_package").order("sort_order"),
      admin.from("wow_addons").select("id,label,price").eq("active", true).not("price", "is", null).order("sort_order"),
      admin.from("wow_packs").select("id,label,price,moments,theme").eq("active", true).not("price", "is", null).order("sort_order"),
      admin.from("seasons").select("id,name,banner_text,order_cutoff,featured_pack,starts_on,ends_on").eq("active", true).lte("starts_on", today).gte("ends_on", today).order("starts_on", { ascending: false }).limit(1),
      admin.from("site_settings").select("key,value").eq("is_public", true)
    ]);
    const setting = (k: string) => (settings.data || []).find((r: any) => r.key === k)?.value || null;
    const ip = setting("instapay");
    const px = String(setting("meta_pixel")?.id || "");
    for (const r of [pk, zones]) if (r.error) throw r.error;
    const body = {
      packages: (pk.data || []).map((p: any) => ({ ...p, price: Number(p.price) })),
      shippingZones: (zones.data || []).map((z: any) => ({ ...z, fee: z.fee === null ? null : Number(z.fee) })),
      games: games.data?.length ? games.data : null,
      wowEnabled: true,
      turnstileSiteKey: Deno.env.get("TURNSTILE_SITE_KEY") || "",
      wowAddons: (addons.data || []).map((a: any) => ({ ...a, price: Number(a.price) })),
      wowPacks: (packs.data || []).map((a: any) => ({ ...a, price: Number(a.price) })),
      season: seasons.data?.[0] || null,
      payments: { methods: ["instapay"], instapay: ip && ip.ipa ? { name: String(ip.name || "Lamsa").slice(0, 40), ipa: String(ip.ipa), link: /^https:\/\/ipn\.eg\//.test(String(ip.link || "")) ? String(ip.link) : "" } : null },
      metaPixelId: /^[0-9]{8,20}$/.test(px) ? px : "",
      generatedAt: new Date().toISOString()
    };
    cache = { at: Date.now(), body };
    return out(body);
  } catch (e) { console.error(e); return out({ error: "تعذر تحميل الأسعار ومناطق الشحن" }, 502); }
});
