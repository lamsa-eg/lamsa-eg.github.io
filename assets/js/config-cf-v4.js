// Runtime config. SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SITE_URL come from
// Cloudflare Pages environment variables via /env.js (served by _worker.js),
// so a new Supabase project never needs a code change. No secrets here.
(function () {
  var env = window.LAMSA_ENV || {};
  window.LAMSA_CONFIG = {
    SUPABASE_URL: env.SUPABASE_URL || "__SUPABASE_URL__",
    SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY || "__SUPABASE_PUBLISHABLE_KEY__",
    SITE_URL: env.SITE_URL || location.origin,
    BRAND_NAME: "LAMSA",
    CURRENCY: "EGP",
    LEGAL_VERSION: "2026-09-11",
    BUILD_VERSION: "cf-v40-fresh-start"
  };
})();
