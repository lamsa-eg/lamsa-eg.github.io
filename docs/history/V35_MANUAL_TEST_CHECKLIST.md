# LAMSA V35 — Manual test checklist

## Order and pricing

- [ ] Open `order-v19.html` at 360px, 390px and 430px widths.
- [ ] Choose “هو” once and “هي” once; complete both orders and confirm `memories.recipient_gender`.
- [ ] Answer the eight optional story questions and confirm `orders.story_answers` contains only those answers.
- [ ] Memory allows two included games; Premium allows three. A fourth game is never selectable.
- [ ] Simple mode offers only tap games and automatically activates for mother/father/memorial wording.
- [ ] Select an occasion pack, extra game and hunt stickers. Confirm the summary and server `total_amount` include the same WOW line.
- [ ] Treasure is not offered until “٣ ستيكرات صيد الكنز” is checked.

## Receiver experience

- [ ] Four enabled moments on `after_gallery` render 1→2→3→4. Automated check: `node --test tests/wow-core-order.test.mjs`.
- [ ] Search the production bundle for `(تجربة)` and `demo:true`; both return zero matches.
- [ ] Male and female memories show the correct seal, secret question and skip copy. Unknown gender is neutral.
- [ ] Test black_rose, black_gold/gold_black, elegant_cream and birthday_balloons; envelope, buttons, rewards and game surfaces inherit theme colors.
- [ ] Each game starts as a closed envelope, opens inline, has a reward, unlocks skip after 30 seconds or two failures, and later shows its completed state.
- [ ] Test reduced motion and tap fallback with motion/sensors disabled.
- [ ] A memory without WOW makes no request for `wow-core.js`, `wow.css` or game modules.

## Security

- [ ] `curl` public-memory before a win and verify no `config.reward`, reward text or reward media URL is present.
- [ ] Win once and verify `wow-event` returns the reward; request `status` and verify it returns the completion time and reward.
- [ ] Try skip before 30 seconds and before two failures: expect HTTP 409.
- [ ] Unlock, reply, coupon redeem and hunt step reject a missing/invalid Turnstile token.
- [ ] Generate treasure URLs in Admin. Each `/m/?clue=&k=` writes `wow_hunt_progress`; a modified HMAC is rejected.
- [ ] Confirm RLS is enabled on every `wow_*` table and anon/authenticated cannot write directly.

## Sender and growth

- [ ] Track page shows starts, wins, times, promises, coupon redemption, letters and replies chronologically.
- [ ] Enable Web Push and verify the subscription survives reload.
- [ ] Download a win share card and confirm it contains no names, answers, photos, message or private content.
- [ ] End of memory shows only the quiet referral line and its sender-linked 10% code.
- [ ] Order-success shows the consented reaction-video invitation and WOW pricing line.
- [ ] Current season controls the home banner; occasion doors preselect their pack.

## Performance and release

- [ ] Run Lighthouse mobile on index/order/memory; target ≥85.
- [ ] Confirm the hero uses the 21KB/36KB WebP `srcset`, not the removed 1.8MB PNG.
- [ ] Verify fonts load locally from `/assets/fonts/` and no Google Fonts request occurs.
- [ ] Upload the ZIP contents to Cloudflare Pages and test `/`, `/order-v19.html`, `/m/<slug>`, `/m/?clue=&k=` and `/track.html`.
