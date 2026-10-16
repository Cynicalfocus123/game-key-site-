// Step 5 site redesign (space theme, app/space.css): the page wrapper + the fixed space picture behind it.
// One picture per screen shape, AVIF first + WebP fallback. URLs are passed as CSS variables so the GitHub Pages base path is
// included (a plain url() in the CSS file would miss it). Used by: home (5A), Games / Hardware / Search (5B).
const assetPath = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`;
const spaceUrl = (name: string, ext: string) => `url("${assetPath(`/images/space/${name}.${ext}`)}")`;
const SPACE_VARS = Object.fromEntries(["desktop", "tablet-landscape", "tablet-portrait", "phone"].flatMap((n) => [[`--sp-avif-${n}`, spaceUrl(`space-${n}`, "avif")], [`--sp-webp-${n}`, spaceUrl(`space-${n}`, "webp")]])) as React.CSSProperties;

export function SpacePage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-home${className ? ` ${className}` : ""}`} style={SPACE_VARS}><div className="space-background" aria-hidden="true" />{children}</div>;
}
