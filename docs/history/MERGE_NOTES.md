# LAMSA V34 — customer-selected games in the order flow

V34 adds a mobile-friendly **اختار ألعاب الذكرى** section directly to the
customer order form. Customers can select one or more games and enter their
real quiz answers, balloon messages, story endings, outing-wheel choices,
treasure clues, and love coupons. The selections are securely attached to the
new memory through `order-wow-selection` after uploads are verified, and the
chosen games appear in the order details and memory editor automatically.

## V33 foundation

V33 replaces the fixed demo answers with a per-memory mobile editor. Admins can
now enter real quiz questions and correct answers, choose puzzle and memory-game
photos from the customer's uploaded media, and customize balloon messages,
story endings, date-wheel options, treasure clues, and love coupons.

V32 bundles the private Worker-to-Supabase gateway credential into the
server-side deployment code and enables WOW by default. A Cloudflare Pages
Direct Upload now works without manually adding `WOW_ENABLED` or
`LAMSA_WOW_GATEWAY_SECRET` environment variables.

This build combines the production LAMSA Cloudflare Pages project with the
attached LAMSA WOW games and moments bundle.

## Production project

The existing Phase 1 and Phase 2 implementation remains unchanged, including
the synchronized gender reveal, Supabase functions, worker routes, admin
editor, and Cloudflare configuration files.

## Production games integration

The attached games are now available from the real memory editor and the live
memory page. The production adapter uses the existing ES-module WOW engine,
sanitized server configuration, rate-limited event storage, and RLS-protected
Supabase tables.

Available moments: quiz, puzzle, hearts, memory, balloons, branching story,
wheel, treasure hunt, and coupons.

## Original WOW bundle

The complete attached bundle is available under `wow-lab/` so its older global
runtime does not overwrite the production ES-module runtime.

- Split demo: `/wow-lab/memory-wow-demo.html`
- Self-contained preview: `/wow-lab/preview/wow-preview.html`
- Source modules: `/wow-lab/assets/js/wow/`
- Demo media: `/wow-lab/assets/wow-demo/`
- Source checksum notes: `/wow-lab/checksums/`

The original attached bundle remains under `wow-lab/` as a reference and
self-contained preview. Production uses the compatible adapter under
`assets/js/wow/`, so the older global runtime does not overwrite Phase 1/2.
