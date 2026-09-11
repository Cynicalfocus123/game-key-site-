# Phase 1 design

CoreCart uses quiet white retail layout, `#2563EB` primary action, dark `#111827` type, thin dividers, open sections, and square corners. Geist is primary typeface. Content max width is 1440px with 32px desktop and 16px mobile gutters.

Homepage order: header, navigation, hero, categories, deals, component deals, game deals, gaming hardware, brands, clearance, recently viewed, footer. Product cards are only repeated-item containers. No gradients, glassmorphism, neon, or section boxes.

Desktop header centers search. Mobile uses menu, logo, cart, separate search, and delivery row. Products opens left drawer with drill-in levels. Hero supports controls, keyboard arrows, pause on hover, 7 second autoplay, and reduced motion.

Keyboard focus remains visible. Drawer keeps keyboard focus until closed.

All homepage imagery is temporary placeholder artwork for Phase 1. Replace files in `public/images/placeholders/` without changing card or hero containers. Normal campaign copy stays HTML.

GitHub Pages deploy serves current homepage as static prototype at project base path. It is review surface, not production ecommerce launch.

Hero controls sit in bottom-right rail. CTA keeps own content space and never shares control area.
