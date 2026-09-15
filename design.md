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
