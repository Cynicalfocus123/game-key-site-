// Step 5 site redesign (space theme, app/space.css): the page wrapper + the fixed space picture behind it.
// One picture per screen shape, AVIF first + WebP fallback. URLs are passed as CSS variables so the GitHub Pages base path is
// included (a plain url() in the CSS file would miss it). Used by: home (5A), Games / Hardware / Search (5B) with the cats picture;
// product page (5C) and later cart / checkout with the galaxy-only picture (user 2026-10-17: calmer behind long text and the buy box).
const assetPath = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`;
const spaceUrl = (name: string, ext: string) => `url("${assetPath(`/images/space/${name}.${ext}`)}")`;
const varsFor = (set: "space" | "galaxy") => Object.fromEntries(["desktop", "tablet-landscape", "tablet-portrait", "phone"].flatMap((n) => [[`--sp-avif-${n}`, spaceUrl(`${set}-${n}`, "avif")], [`--sp-webp-${n}`, spaceUrl(`${set}-${n}`, "webp")]])) as React.CSSProperties;
const VARS = { space: varsFor("space"), galaxy: varsFor("galaxy") };

export function SpacePage({ children, className = "", picture = "space" }: { children: React.ReactNode; className?: string; picture?: "space" | "galaxy" }) {
  return <div className={`space-home${className ? ` ${className}` : ""}`} style={VARS[picture]} data-picture={picture}><div className="space-background" aria-hidden="true" />{children}</div>;
}
