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
