# Agent workflow — Phase 1

Current task: homepage frontend only. Completed: visual system, responsive header/navigation, category drawer, promotional slider, mock homepage sections, footer, placeholder image system.

Hard limits: no listing, detail, checkout, accounts, seller, admin, backend, payment, or authentication work. Do not add heavy dependencies. Do not launch localhost unless user asks.

Placeholder images are approved for current Phase 1 prototype only. Replace local files in `public/images/placeholders/` when production assets arrive. Update `weight.md`, `design.md`, `agents.md`, and `code.md` on every task. Next approved phase requires homepage approval.

Accessibility review complete for Phase 1 drawer focus, Escape close, navigation controls, keyboard slider controls, reduced motion, image alt treatment, and visible focus.

GitHub Pages workflow deploys `main` for homepage review. Keep Phase 1 scope only.

Latest homepage review fix: slider navigation moved away from campaign CTA after mobile overlap report.

Latest homepage update: quick category strip and three promo banners added above Today's deals. Affected files: `app/storefront.tsx`, `app/globals.css`, `public/images/placeholders/categories/`, `public/images/placeholders/promos/`, and all four Markdown docs. Remaining approval item: review exact quick-link and promo visual direction before Phase 2.

Latest user correction: moved quick icon row above hardware categories, removed its heading labels, moved banners below hardware categories, and fixed hosted asset prefix.

Latest user asset update: replaced quick-category logos with supplied reference images. Assets remain in `public/images/placeholders/categories/` for later production replacement. Phase 1 remains open for visual approval only.

Latest folder update: moved live mirror from sibling `Game keys and ecommerce pc site-live` into `live/` under main Git folder. Old sibling path removed. Keep `live/` synchronized after each source change; keep it Git-ignored to prevent recursive project copies.
