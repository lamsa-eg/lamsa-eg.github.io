# LAMSA V35 — Story WOW

V35 keeps the V34 Cloudflare Pages/Supabase architecture and adds the story questionnaire, gender-aware copy, server-authoritative game completion and rewards, secure physical hunt steps, themed envelope games, sender timeline, referral/share growth loop, season-driven homepage, ten new game modules and local Arabic fonts.

Database migration: `supabase/migrations/20260926_lamsa_v35.sql`.

New Edge Functions: `wow-generate`, `wow-hunt-step`, `wow-sender-timeline`, `wow-rewrite`.

Updated Edge Functions: `public-memory`, `wow-event`, `order-wow-selection`, `wow-admin-config`, `wow-catalog`.

The Claude rewrite button is optional and never changes text without buyer confirmation. Production needs `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in Supabase secrets. Turnstile needs Cloudflare `TURNSTILE_SITE_KEY` and Supabase `TURNSTILE_SECRET_KEY`.

V36 completion adds `love_wrapped` and `remote_touch` to the buyer's game picker. WhatsApp TXT is parsed server-side and only aggregate statistics are retained in the order/game configuration; the raw chat is never written to storage. Remote Touch uses a per-memory Supabase Realtime channel and falls back gracefully when a live connection is unavailable.

Game share/open/touch events continue to be accepted after completion, while duplicate wins stay idempotent. Media rewards are returned from `wow-event` as short-lived signed URLs only after an authorized win/skip response.
