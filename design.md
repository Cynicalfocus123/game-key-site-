# Phase 1 design

CoreCart uses quiet white retail layout, `#2563EB` primary action, dark `#111827` type, thin dividers, open sections, and square corners. Geist is primary typeface. Content max width is 1440px with 32px desktop and 16px mobile gutters.

Homepage order: header, navigation, hero, categories, deals, component deals, game deals, gaming hardware, brands, clearance, recently viewed, footer. Product cards are only repeated-item containers. No gradients, glassmorphism, neon, or section boxes.

Desktop header centers search. Mobile uses menu, logo, cart, separate search, and delivery row. Products opens left drawer with drill-in levels. Hero supports controls, keyboard arrows, pause on hover, 7 second autoplay, and reduced motion.

Keyboard focus remains visible. Drawer keeps keyboard focus until closed.

All homepage imagery is temporary placeholder artwork for Phase 1. Replace files in `public/images/placeholders/` without changing card or hero containers. Normal campaign copy stays HTML.

GitHub Pages deploy serves current homepage as static prototype at project base path. It is review surface, not production ecommerce launch.

Hero controls sit in bottom-right rail. CTA keeps own content space and never shares control area.

New order: hardware categories, horizontal Digital & services quick links, Featured promotions, then Today's deals. Quick links are exactly Steam, Xbox, Sony, eGift Card, Nintendo, Netflix, Apple, Spotify. Desktop distributes eight links with subtle arrows; tablet and mobile preserve touch-sized items in horizontal scrolling row. Three promotions use one wide banner above two equal banners. Lower banners stack on mobile. Banner artwork zooms 1.035 on hover inside clipped image area.

Updated order: hero, quick category icon row without heading text, Shop by category, three promotional banners, Today's deals. Quick icon row has no visible `Digital & services` heading or `Fast access` label.

Quick-category strip now uses supplied recognizable logo artwork for Steam, Xbox, Sony, Nintendo, Netflix, Apple, and Spotify. eGift Card keeps dedicated gift icon. Logo sizing remains contained in same 52px desktop / 46px mobile slot.

Project layout cleanup moves live mirror under `live/` in main project folder. Visual output remains unchanged.

Tooling handoff to Claude (2026-09-25): no visual change. Design direction above remains current source of truth.

Sync rule added 2026-09-25: no visual change.

Token saving rules added to `agents.md` 2026-09-25: no visual change.

Claude review 2026-09-25: no visual change. Pending user visual approval of Phase 1 homepage.

Next-step plan logged 2026-09-25: no visual change.

## Phase 2 accounts design (2026-09-25)

Auth pages: single 480px card, 1px border, square corners, 44px inputs, blue primary button, Google button outlined, "or" divider, footer link row. Demo mode shows yellow notice bar and dashed "Demo inbox" box.
Account: 240px left sidebar (Overview, Orders, Payment methods, Settings, Sign out) with blue active bar; turns into horizontal tab row under 900px. Overview uses four bordered stat tiles. Orders use bordered order blocks with grey header, status badges (green paid/completed, red refunded/cancelled), masked key with Reveal. Header account link shows "Hello, {first name}" when signed in; mobile adds account icon beside cart.

D: drive rule logged 2026-09-25: no visual change.

Handoff v3 logged 2026-09-25: no visual change.

## Admin panel design (2026-09-26)

Admin pages use own top bar (logo + black "ADMIN" tag, admin email, View store, Sign out); no storefront header/footer. Login/register reuse 480px auth card. Layout reuses account sidebar (Overview, Users; greyed "Orders & payments — next step", "Products — later").
Overview: six bordered stat tiles (total, new today, new 7 days, verified %, active 7 days, marketing opt-in); 30-day sign-up bar chart (plain CSS columns, blue); sign-in method bars; newest registrations table. Users: filter row (search, method, email status, role, sort), bordered table with grey header, clickable rows, Google badge light blue, admin badge black, verified green / not verified red, prev/next pager. Detail: four tiles, sign-in methods, active sessions table, sign-in history table. Times in Bangkok time. Tables scroll sideways on mobile; tiles 3 columns under 1100px, 2 under 640px.

Playwright added 2026-09-26: no visual change.

Live mirror test-file exception 2026-09-26: no visual change.

Handoff v4 logged 2026-09-26: no visual change.

## Currency selector design (2026-09-26)

Header (desktop/tablet): bordered `flag + code ▾` button left of Account. Opens a 380px white dropdown: rows Currency (flag + code ›), Language (English), Help and support. Currency slides the panel left to: ‹ Go back, "Currency", search box, 3-column grid of flag + code tiles (40px); selected tile has dark border, bold text, blue ✓; grid scrolls inside 300px. Note under the grid when the chosen currency is not chargeable. Motion: fade + 6px drop (0.18–0.22s), pane slide 0.28s, height eases to the showing pane, arrow rotates; reduced motion = instant. Closes on outside click, Escape, or pick.
Mobile: drawer gets a "Currency  flag USD ›" row above the help links; opens a full-screen sheet sliding in from the right (0.28s) with Go back, search, 2-column list.
Flags: 20×15 SVG with hairline outline, from flag-icons. No flag emoji.
Orders: charged amount stays primary; grey "≈ €…" line under it when the visitor currency differs.
Admin currencies: rate status line + "Update rates now" (outline button), red notice when the last fetch failed, search + Show filter, table: flag/code/name, Enabled + Chargeable switches (blue on; USD locked), auto rate (struck through when override in use), override input (saves on blur/Enter), rounding select, ฿1,000 preview, updated times.
Footer: "Rates by Exchange Rate API" link after copyright.

Status 2026-09-26: currency selector pushed in `39a21d8`; no further visual change.

Admin sign-in (2026-09-26): Google button, "or" divider and "Create admin account" link removed. Card: email, password, Forgot password, Sign in; footer "Admin accounts are created by the site owner. Back to store". Demo only: dashed "Demo admin" box with the demo email/password and a "Fill demo admin" button.

Handoff v6 logged 2026-09-26: no visual change.

Handoff v7 logged 2026-09-26: next wireframes = cart (popup desktop/mobile, cart page) and customer dashboard (sidebar Balance, Orders, Keys library, Tickets; key detail page). Keep CoreCart look, not Eneba purple. No visual change yet.

Handoff v8 logged 2026-09-26: cart (A1–A8), checkout gate (B1–B6, desktop split sign-in with blue panel), customer dashboard (C1–C12, own Recent purchases card) wireframes approved; full spec in `agents.md` Handoff v8. No visual change yet.

## Cart + checkout gate (2026-09-26, Handoff v8 Part 1)

Header cart icon: live count badge (hidden at 0), all tabs. Desktop/tablet popup under the icon (380px, thin border, soft shadow): "✓ Added to cart" (or "Your cart" when reopened by hover/click), last 3 rows (44px cover, title, "Steam · Global · ×1", price, × remove), "and N more", Subtotal (N items), View cart (outline) + Checkout (blue). Closes on ×, outside click, Esc, 6 s idle (not while hovered). Mobile (<768): centered white box over dimmed page, ✓ icon, "Added to cart", "You have N items in your cart", Continue shopping (primary), View cart.
Cards: every card (games too) has Add to cart; green "Added ✓" 1.5 s; grey disabled "Limit reached" at 5 keys / stock.
/cart: breadcrumb, "Your cart (N)", rows (80px cover, title, platform · OS · Instant key, green region line "Global — works in Thailand", amber limit note, − n + stepper, price + each, ♡/♥ save, ×), Continue shopping / Remove all; 360px summary box: Subtotal, Shipping Free, coupon line (green, Remove), "Have a coupon?" field + Apply, Total 24px, ChargeNotice, Checkout, text payment badges (VISA, Mastercard, AMEX, PromptPay), trust list. Under 900px summary stacks; under 768px coupon collapsed and sticky bottom bar (Total + Checkout). Empty: icon, "Your cart is empty", Browse today's deals, signed-out "Have an account? Sign in to see your saved cart".
/checkout: review rows, info notice "Payment is coming in the next step", disabled "Pay now (coming next)", Back to cart.
Checkout gate modal (square, white, dim backdrop, focus trap, Esc/outside/× close): choice (two bordered columns + "or", grey footer "N items · $X stay in your cart" / 🔒 Secure checkout); register (Back, 🔒 title, grey benefits strip with green ✓, Email, Password + Show/Hide, Keep me signed in, deals opt-in unchecked, Create account, or, Google, terms line); sign in (Keep me signed in + Forgot password?, inline error); check email (✉ icon, demo inbox, "I've verified — sign in", Resend email). ≥768 register/sign-in = split: form left, 300px blue #2563EB panel right (artwork slot, "New to CoreCart?" / white Create account button, or "Already have an account?" / Sign in). Mobile: bottom sheet, single column, grey footer bar link. Header "Hello, sign in" opens the sign-in popup on desktop/tablet; mobile keeps /login.
