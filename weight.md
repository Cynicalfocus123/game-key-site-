# Weight status — Phase 1

- Images live in `public/images/placeholders/`. Current sample files use 19 KB–1.8 MB source sizes; final hero replacements need AVIF/WebP and target under 350 KB desktop / 180 KB mobile where practical.
- `next/image` provides responsive image sizing, lazy loading below fold, reserved `fill` containers, and optimized output. First hero image uses `priority`.
- No animation library or image UI dependency installed. Drawer and slider use native CSS and React.
- Keep final LCP image dedicated, correctly sized, and preload only first hero. Target LCP <= 2.5s, INP <= 200ms, CLS <= 0.1.

- Latest review: no animation package; user interaction code remains scoped to drawer, carousel, and desktop/laptop tabs.

- GitHub Pages uses static export. Next image optimization is disabled only for hosted static output; placeholder source dimensions and responsive containers remain enforced.

- Slider control layout uses fixed bottom-right rail. It cannot overlap campaign CTA at narrow viewports.

- Quick-category icons are eight local SVG files, loaded as small vector assets. Promo placeholders stay in `public/images/placeholders/promos/`; current files are 212–353 KB. Use AVIF/WebP and target under 250 KB wide / 150 KB small banner when production art arrives.
- Promo images use `next/image` with fixed containers, `fill`, `sizes`, and separate mobile source hooks. Hover uses one CSS transform only; no added JavaScript or animation dependency.

- GitHub Pages asset prefix is injected into all local image paths, preventing broken placeholder icons in hosted build.

- Supplied Steam, Xbox, Sony, Nintendo, Netflix, Apple, and Spotify logo PNGs now replace prior generic SVG samples. Transparent backgrounds are retained where source supports cleanup; Nintendo and Netflix preserve supplied brand-color fields.
