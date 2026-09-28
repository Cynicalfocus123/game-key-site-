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

Breadcrumb fix (2026-09-26): `nav.crumbs` on /cart and /checkout no longer inherits header nav styles (borders, 47px height, indent, 29px gaps; was hidden under 640px). Own style: 13px muted links, › separators, current page dark, wraps.

## Customer dashboard step 1 (2026-09-26, Handoff v8 Part 2)

Sidebar: "Hello, {name}", MY ACCOUNT group label (Overview, Login history indented), Balance, Orders, Keys library, Tickets (blue count badge, shown when unread > 0, tickets step), Payment methods, Settings, Sign out; blue active bar. 1024–768px sidebar 200px. Under 768px sidebar hidden, "Account section" native select (full width, 46px) replaces it (includes Sign out). Every dashboard page: breadcrumb "My account › {page}" above the H1.
Overview: two cards side by side (stack under 900px). Profile card: square initials avatar (preset colour or grey), name, email, ✎ edit (→ Settings #profile), "Complete your profile (N%)" + 6px blue bar, "X of 6 tasks completed ›" toggles a checklist (✓ green done, ○ blue links). Balance card: TOTAL BALANCE, green 28px amount (฿0 until step 3), note, Wallet overview (outline); divider; GIFT CARD BALANCE row + blue-outlined + button (→ Balance #redeem). RECENT PURCHASES card (full width): caps header + All orders ›; stats strip Keys owned | Not revealed (blue); 3 rows (44px cover, title, "Steam · Global · 2 days ago", chip NEW KEY blue / REVEALED grey, Reveal › / View ›); grey footer "N keys waiting" + Open keys library (primary). Empty: blue box icon, "No purchases yet", Browse today's deals.
Login history: intro "Sign-ins … last 90 days" + "Not you? Change password"; bordered table (grey caps header) Date (+ LATEST chip), Method, Device, IP address (masked, monospace).
Orders: bordered table Date, Order ID (mono + "sample"), Items ("Elden Ring +1 more"), Total (charged + ≈ converted), Status chip, Details › (opens item rows below: 40px cover, name, meta, masked key + Reveal key, price; label turns "Hide details").
Settings: Profile (name, 6 avatar colour swatches blue/green/amber/red/teal/slate with dark outline on selected, country select), Currency select, Deal emails checkbox + Save choice, Password, Email.
Mobile (<768): tables become bordered cards (label left, value right), Details full-width outlined button, card buttons full width. Balance, Keys library, Tickets pages are placeholders until their steps.

Handoff v11 logged 2026-09-27: step 2 adds currency button without box, wider checkout gate on desktop/tablet, coloured region/limit/coupon/charge text on cart + checkout, product detail page + favorites, payment page (method list left, order summary right, CoreCart look). Spec in `agents.md` Handoff v11. No visual change yet.

Handoff v11 update 2026-09-27: payment page methods = PayPal, card (Visa/Mastercard), Apple Pay, Google Pay; Favorites page in dashboard + ♡ next to product title + card ♡ + header ♡; header order ♡ · Cart · Profile on every device. No visual change yet.

Handoff v11 update 2 (2026-09-27): admin Promo codes page planned (create form, table with Active/Scheduled/Expired/Disabled chips, edit, disable, delete with confirm); cart shows amber note when an applied code stops being valid. No visual change yet.

Handoff v11 update 3 (2026-09-27): promo code admin = list page + create/edit page with option cards and a live Summary card (vendor-style layout, CoreCart look); all options optional; category restriction. No visual change yet.

Handoff v12 logged 2026-09-27: remaining work split into PART A (2a–2d) and PART B (3, 3b, 4a, 4b, 5). No visual change.

## Step 2a quick fixes (2026-09-27, Handoff v12 Part A)

Header right side on every device: ♡ Favorites · Cart (count) · Profile; profile always right next to the cart. Icons: SVG line heart + person (22px, ink, hover blue); cart keeps its icon. Desktop/tablet: person + "Sign in | Register" (grey divider; each opens its gate popup ≥768) or "Hello, {name} / Account" when signed in. Mobile ≤640: icons only (text kept for screen readers), right aligned. "Returns & Orders" stays desktop only (>900). Old separate mobile account icon removed.
Currency button: no box; plain `flag + code ▾`, soft grey background on hover/open, blue focus ring.
Checkout gate choice view: 720px wide, two equal columns + "or", buttons one line, grey footer full width (bug: the modal itself carried the `.gate-choice` grid class). Gate buttons never wrap.
Coloured text (cart + checkout review rows): region line green "✓ Global — works in Thailand", red bold "⚠ ROW — does not work in Thailand" (country = account country, else browser guess); "Max 5 per order" amber bold; coupon line all green ("Coupon WELCOME10 Remove −฿…"); ChargeNotice = amber box (#fff8e6, #f5d38a border). Black Myth: Wukong is the sample ROW key (excludes East + Southeast Asia).

## Step 2b keys library + key detail (2026-09-27, Handoff v12 Part A, spec C5–C8)

Keys library: search field "Search by product name / order ID" (44px, max 460px) + segmented filter All · Not revealed · Revealed with counts (selected = black). Bordered table: 40px cover, Date, Order ID (mono), Product name + blue NEW chip + grey "Steam · Global", Price, button Reveal key (blue) / View key (outline). 20 per page, pager "‹ Previous · Page 1 of 2 · Next ›". No Seller column. Empty: "No keys yet" + Browse today's deals. Mobile: stacked search + 3-column filter, rows become cards, full-width button.
Key detail: breadcrumb My account › Keys library › {game}; H1 game; 132px cover left (96px on mobile); four fact tiles in one bordered row (Region + Check region restrictions, Platform + Activation guide, Product type "Digital key" with round ? tooltip, Works on), 2×2 on mobile. "Your key" box: dashed grey code field (masked •••••-•••••-•••••) + blue Reveal key; amber "Revealing the key ends the refund window." After reveal: code + Copy (green "Copied ✓" 2 s), Activate on {platform} ↗ (blue, platform redeem page in new tab), Print as a gift (outline), "Don't want to use it now? … My library", amber refund box. Meta line: Sold by CoreCart · Order CC-… · date · Revealed {date time}. "Report a problem with this key" link (tickets placeholder until 4a).
Print as a gift: own page without header/footer; To / From / Message fields (screen only); card with black border: logo, "A gift for you", names, message, cover + title, YOUR KEY in black dashed box (24px mono), numbered activation steps; print = black and white, cover greyscale, tools hidden.
Activation guides: /help/activate (list) and /help/activate/{steam,xbox,playstation,nintendo,ea,ubisoft}: numbered steps with blue square numbers, "Open {site} ↗", Region restrictions box (#region), Key not working box, links to other platforms.
Orders details: key items show "Reveal key ›" / "View key ›" links (numbered when qty > 1) instead of the inline reveal. Overview Recent purchases rows link to the key detail.

## Step 2c product page + favorites (2026-09-27, Handoff v12 Part A)

Product page /product?id=: breadcrumb Home › Digital games / PC parts › name. Desktop: cover left (games 3:4 up to 420px, hardware 4:3), info right: H1 (32px) + square 44px outlined ♡ button (filled blue ♥ + light blue background when saved), meta "Steam · Global · Instant key" (hardware: rating · Hardware), region line (green / red), four fact tiles in one bordered row (games: Region + "Can be activated in {country}" green / "Cannot…" red + Check region restrictions; Platform + Activation guide; Digital key / Instant delivery; Refunds / Before reveal — hardware: Stock, Shipping, Warranty, Returns), buy box (30px price + struck old price, amber "Max 5 per order · N in your cart", red note when the key does not work in the visitor country, Add to cart outline + Buy now blue, trust list). Below a divider: Description, System requirements (minimum, games), How to activate (first 3 steps + full guide link). Under 900px stacked, tiles 2×2. Under 768px: Add to cart + Buy now move to a sticky bottom bar (price + two buttons).
Favorites: ♡ in the image corner of every product card (white 36px square, blue when saved), on the product title, in cart rows (blue when saved; old red ♥ gone). Toast at the bottom "♥ Saved to favorites" / "Removed from favorites" (2.5 s, aria-live). Header ♡ turns filled blue with a count badge. Dashboard sidebar + mobile select: "Favorites" after Keys library; page = grid of cards (4:3 cover, title link, platform · region, price, Add to cart, "♥ Remove"); empty state "No favorites yet" + Browse today's deals. Card and cart titles/images link to the product page.
Reviews: not on the product page yet (open question; default = with the catalog DB).

## Step 2d payment page UI (2026-09-27, Handoff v12 Part A)

/checkout review now ends with "Continue to payment" (blue) → /checkout/payment. Breadcrumb Home › Cart › Checkout › Payment. Left: "Choose how to pay", blue info note (payment coming next, nothing taken), four bordered rows (120px text logo tile, name + short line, radio right): PayPal (italic navy text), Credit or debit card (VISA + Mastercard text badges), Apple Pay (black tile), Google Pay ("G Pay"). Selected row: blue border + light blue background. Card row expands inline: note "These fields will be the payment provider's secure form…", dashed box with disabled Card number, Cardholder's name, Exp. date, CVC, green "🔒 Your payment is secure". Other methods show "You will continue to {method} to confirm the payment." Right (400px): Order summary — item rows (56px cover, title link, "Digital product ?" tooltip or "Hardware · free shipping", small − n + stepper, price, ♡, ×), Sub-total, coupon, Service fee ? (฿0), Email + Edit, Total 28px, ChargeNotice, amber-outline "⚠ Know more about online gift card fraud here" (→ /help/gift-card-fraud), Pay button (blue, disabled; "Pay with {method}" once chosen), hint line, terms line, trust line. No cashback, no Trustpilot. Mobile: collapsible "Order summary (N) · total" box on top, methods, legal lines, sticky Total + Pay bar.
/help/gift-card-fraud: static guide page (numbered tips + "Think it happened to you?" box).

Handoff v13 logged 2026-09-27: Part A done, Part B next. No visual change.

## Step 3 balance + gift cards (2026-09-27, Handoff v12 Part B, spec C3)

Balance page: "Total balance ฿…" line (green) + "Estimated from the most recent conversion rate."; two bordered tiles Wallet ("Refunds and store credit. Top-ups are coming later.") and Gift card balance ("Available to spend on CoreCart only"), 28px amounts; "Redeem a gift card" card (#redeem): mono code field XXXX-XXXX-XXXX-XXXX (auto groups of 4, upper case) + blue Redeem (disabled until 16 characters), help line, demo hint, green / red notice; Transactions table Date · Type · Ref (masked ••••-••••-••••-AB12) · Amount (green +฿) · Balance, empty row "No transactions yet…". Mobile: tiles stack, field + full-width button stacked, rows become cards. Overview balance card shows real totals; + links to #redeem.
Admin Gift cards (sidebar after Currencies): "Create gift cards" panel (Amount THB, How many 1–50, Expires optional date = end of day Bangkok, Note) → green panel with the new codes in dashed boxes + Copy all / Done ("Copy the codes now… cannot be shown again"). Search (last 4, note, email) + Status select with counts. Table: masked code, amount, chip Active green / Redeemed blue / Expired grey / Disabled grey, note, created, expires (Never), redeemed by email + time, Disable / Enable outline button (none after redeem).

## Future task logged — search + filters + card region (2026-09-27)

Not built yet. Look for S1–S5 (spec at end of agents.md): search dropdown rows (thumb, tag, title, From + old/new price, sold out grey, scroll, "Show all N results"), `/search?q=` results page + sort menu, left filter sidebar (mobile sheet), admin `/admin/filters`, upper-case region line on every product card (Global green, limited regions red/amber). CoreCart colours only, Eneba screenshots = layout reference. Wireframes need approval first.

- 2026-09-27 add-on S6 (spec in agents.md): payment logos, transparent WebP from `site image/payment provider images/`, "Safe and secure payment methods" logo grid in cart/checkout/payment summary (replaces text badges, no boxes), logo strip above the dark footer on white, wraps on mobile.

## Step 3b promo codes (2026-09-27, Handoff v12 Part B)

Admin Promo codes list: intro line + blue "Create promo code"; search + status segment (All · Active · Scheduled · Expired · Disabled with counts; one scrollable row on phones); table Code (mono) + Copy, Discount ("10% off" / "฿200.00 off", max under it), Applies to, Min order, Uses "0 / 100" (+ "1 per customer"), Active dates (start, "to …" or "No end date"), chip Active green / Scheduled blue / Expired, Used up, Disabled grey, ⋯ menu (Edit, Duplicate, Disable/Enable, Delete red). Delete asks in a modal "Delete CODE? Carts using it lose the discount." (Cancel / red Delete). Under 1000px rows become cards with ⋯ top right.
Create / edit: "‹ Promo codes" back link; left column of bordered cards — Code (mono field + Generate), Discount (black segmented Percentage | Fixed amount, % or ฿ prefix field, optional max discount), Applies to (All products | Specific categories → Digital games with platform sub-choices, PC parts, Monitors, Gaming hardware), Minimum requirement (None | amount), Usage limits (total uses, one per customer, note that counting starts with real checkout), Active dates (start + optional end, Bangkok time). Right: sticky Summary card (code, plain-words bullets, Enabled checkbox, blue Save / outline Discard, "Unsaved changes"); under 1000px it moves below. Errors in red under each field after the first Save.
Storefront: coupon line "Coupon GAMES20 (Digital games) −฿198.00" green; grey "—" while it gives nothing, with an amber box "GAMES20 applies to Digital games only." or "Add ฿371.00 more to use FIX200."; amber "Code X is no longer valid." when a re-check removes it (every open tab). Apply button shows "Checking…"; errors: "This code was not found.", "This code is not active.", "…not active yet.", "…has expired.", "…has been used up.", "Minimum order ฿1,000.00 for this code.", "Too many tries…".

Handoff v14 logged 2026-09-27 (agents.md): next = rerun failed desktop tests, Returns & Orders, tickets 4a/4b, polish. No visual change.

- 2026-09-27 add-on S7 (bug, spec in agents.md): new registrations missing from admin Users. Planned UI: "Demo mode — accounts live only in this browser" note on Pages register + admin; "Add user" button (name, email, role) on admin Users; role change on user detail with confirm.

Local backend start script (2026-09-27): no visual change.

- 2026-09-27 S7 update: user registered on Pages. Plan A = one real site on Vercel + Neon, Pages link redirects there (no demo-mode note needed on the real site). Plan B = Pages frontend calling the Vercel API cross-site.

- 2026-09-27 S7 update 2: one real database for Pages link, real server (from `live/`), localhost main + `live/`. No visual change.

- 2026-09-27 future task order (user): S1 → S6 first, S7 after. Not started.

- Handoff v14 task 1 (2026-09-27): Geist now self-hosted (same font, same weights via variable font); size-matched fallback while it loads. No visual change.

- 2026-09-27 future task answers: left filter sidebar; filter-driven listing pages (genre / platform); one "On sale" filter; hardware hides OS / platform / region; payment logos in equal white rounded tiles, 4 per row, lock + "Safe and secure payment methods" (also above footer); register gets Customer / Seller choice.

## Returns & Orders (2026-09-27, Handoff v14 task 2)

Dashboard nav item "Returns & Orders" (sidebar + mobile select); H1 "Returns & Orders". Underline tabs under the H1: Orders (grey count) | Returns (blue count badge when open returns); active tab dark text + 3px blue bottom bar; on phones the two tabs share the width. Orders tab = existing table; in Details each line gets a small blue "Request return" link or grey text ("Not eligible for return: the key was shown. Key not working? Open a ticket" / "A return is already requested…") plus "RT-… requested" status text. Return form inline under the line: bordered white box (max 620px), bold title, Quantity (120px) + Reason selects, Message textarea, amber note for keys ("Do not reveal the key while the return is open…"), blue "Send return request" + outline Cancel (full width on phones). After sending: green notice "Return RT-… requested. We will reply within 2 working days." and the Returns tab opens. Returns tab: grey intro line with ticket link, table Date · Return ID (mono, one line) · Item (bold + grey "Order CC-…") · Qty · Reason · Status chip (Requested amber, Approved blue, Rejected grey, Refunded green) with the admin note in small grey under it; cards on phones. Empty: "No returns yet…".
Admin Returns (nav after Promo codes): intro line, Search (return ID, order ID, item, email) + Status select with counts; table Date/time · Return (mono + order) · Customer · Item · Qty · Reason · Status chip · Open (outline small). Open adds a light grey detail row: fact list (Customer, Order, Item, Reason, Message, Note to customer, Updated) left, form right (Change status select with only allowed moves: Approve / Reject / Mark refunded, Note to customer textarea "(required)" for Reject, blue Save); final returns say "No further changes." Stacks under 900px.

## Tickets, customer (2026-09-27, Handoff v14 task 3, C9 + C10)

List: blue "New ticket" button + grey line "We answer within one working day…"; table # (mono) · Subject (bold + grey category, blue "· New reply" when unread, light blue row) · Order (mono or —) · Status chip (Open amber, Answered green, Closed grey) · Last reply ("2 hours ago" + grey You / Support) · View ›. Cards on phones. Empty: "No tickets yet." + help line.
New ticket (max 760px): "‹ All tickets" link, H2, Category + "Order or key (optional)" selects side by side (grouped by order: Whole order / Key: name (revealed)), Subject, Message (6 rows), grey "No attachments yet. Never send passwords or card numbers.", blue Send + outline Cancel (full width on phones).
Thread: back link, H2 "#1001 Subject" + status chip, grey meta line (category · Order CC-… · Key: name link (revealed date) · Opened date); messages as bordered boxes, name + time on top; support messages with a 4px blue left bar and light blue background ("CoreCart support"); closed note; reply box above a thin divider: "Your reply" textarea, blue Reply + outline Close ticket. Sidebar Tickets shows a blue count badge for unread support replies (mobile select "Tickets (N)").

## Tickets, customer — simplified form (2026-09-28, Handoff v15 task 3; replaces the New ticket + list lines above)
New ticket (max 760px): "‹ All tickets", H2, row of two fields side by side (stacked on phones): **Subject** select ("Choose a subject", Order issue, Return/refund, General support, Questions) + **Order number** input (placeholder "e.g. CC-12345678", label "Order number (optional)" for General support / Questions), grey line "Order numbers are on Returns & Orders and in your order email." (link), **Description** textarea (6 rows), grey no-attachments note, blue Send + outline Cancel.
List: # · Subject (bold label, blue "New reply" under it when unread) · Order number (mono or —) · Status · Last reply · View ›. Thread H2 "#1001 Order issue", meta "Order CC-… · Key: name (revealed date) · Opened date".

Rate limit fix logged 2026-09-28 (code.md): no visual change.

## Search + listing pages (future task S1–S3, 2026-09-28)

Header search: dropdown under the field (blue top line, shadow), first row "⌕ Search for “…”", product rows = 44×58 cover, grey tag line "Digital key · Steam · REGION" (region upper case, bold; GLOBAL green #16803C, limited region red), bold 2-line title, right column "From" + old price struck + green "-32%" + bold price. Sold out rows at 55% opacity with "Sold out". List scrolls inside (max 70vh / 620px), "Show all N results" full-width outline button. No results: bold line + tip + "Browse all games" link. ✕ clears the field. Mobile: same, full width under the header, smaller cover (36×48).
Listing (/search, /games, /hardware): breadcrumb, 30px title ("Search results", "FPS games", "Steam games", "All games", "PC hardware"), left sidebar 264px (sticky, bordered groups with ▴/▾ toggles remembered per browser: Price range (currency) min/max fields, Country select, Product type, Operating system, Sale "On sale", Platform, Genre, Region; checkbox + label + count; groups over 8 options get a search field + "N more ▾"; picked options stay on top). Chips row (grey boxes with ×) + blue "Clear all". "Results found: N" left, "Sort: Most popular ▾" menu right (✓ green on the active one; "Best match" only with a search text). Grid 4 columns (3 under 1100px, 2 on phones), "Load more (N left)" outline button, empty state box with Clear all. Under 901px: "Filters (n)" outline button opens a full-screen sheet (Clear | blue "Show N results").

- Future task S5 (2026-09-28): product cards (home + listing) = title → platform (grey) → REGION in capitals (bold 12px; GLOBAL green #16803C, limited red #D92D20) + grey 11px "Not for Thailand" when the key does not work for the visitor → price, old price struck, green bold "-51%". Hardware cards unchanged (rating line).

- 2026-09-28 decisions: S6 without AMEX / PromptPay tiles. Proposed S8 admin wallet (user detail: balances + transactions + Adjust balance with reason and confirm; Users list Balance column) — waiting for approval.

- 2026-09-28 S8 approved (admin wallet): user detail balance cards + transaction table + "Adjust balance" (Credit/Debit, amount, reason, confirm); Users list Balance column; overview "Balance owed" total.

- Future task S4 (2026-09-28): /admin/filters = admin nav "Filters". Left column 200px of group buttons (blue left bar + light blue on the current one, grey "HIDDEN" tag when the group is off); under 768px a "Filter group" select instead. Right: bordered panel, group title, two checkboxes "Show group on the store" · "Starts open", "Add {genre}" field + blue Add, list rows with thin dividers: name (bold; grey "Catalog value: FPS" after a rename) · "12 products" · chip SHOWN (green) / HIDDEN (grey) · small outline buttons ↑ ↓ Rename Hide/Show Delete (wrap under the name on phones). Rename = inline field + Save / Cancel. Delete = amber box under the row: "Delete “FPS”? 3 products use it — they lose this genre." + Delete / Cancel. Price range: only the two checkboxes + a note.
