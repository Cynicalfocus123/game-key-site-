import Link from "next/link";
import SiteFooter from "./components/site-footer";
import SiteHeader from "./components/site-header";
import { SpacePage } from "./components/space-theme";

// 404 page (user 2026-10-17): lost astronaut cat holding a blank sign on the galaxy background. "404" is page text placed on the sign
// (the picture has no words), so it stays sharp at every size and can be translated later. One picture for every screen: it only
// scales; the galaxy behind it already has one picture per screen shape. Static demo: Next writes out/404.html (GitHub Pages serves it).
// Sign position measured on public/images/mascot/cat-lost (480 x 707): text box left 25%, top 65.5%, 38% x 15.5% (between the paws).
const catSrc = (ext: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/images/mascot/cat-lost.${ext}`;

export default function NotFound() {
  return <SpacePage className="space-404" picture="galaxy"><SiteHeader /><main className="nf-main">
    <div className="nf-cat">
      <picture><source srcSet={catSrc("avif")} type="image/avif" /><img src={catSrc("webp")} alt="CoreCart astronaut cat holding a sign" width={480} height={707} /></picture>
      <span className="nf-sign" aria-hidden="true">404</span>
    </div>
    <h1>Page not found</h1>
    <p>This page drifted off into space. The link may be wrong, or the page has moved.</p>
    <div className="nf-btns"><Link className="btn btn-primary" href="/">Back to the store</Link><Link className="btn btn-outline" href="/games">Browse games</Link></div>
  </main><SiteFooter /></SpacePage>;
}
