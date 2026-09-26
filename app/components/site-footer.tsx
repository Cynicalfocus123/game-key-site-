import Link from "next/link";
import { RATE_CREDIT } from "@/lib/currency/currencies";

export default function SiteFooter() {
  return <footer><div className="footer-inner"><Link className="logo" href="/">core<span>cart</span></Link><div><strong>Shop</strong><a href="#">PC parts</a><a href="#">Gaming</a><a href="#">Digital games</a></div><div><strong>Customer service</strong><Link href="/account/orders">Order tracking</Link><a href="#">Returns</a><a href="#">Contact us</a><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div><div><strong>Stay in loop</strong><p>Deals, product launches, and build advice.</p><label className="email"><input placeholder="Email address"/><button>Join</button></label></div></div><p className="copyright">© 2026 CoreCart. Mock storefront, Phase 2 accounts preview. · <a href={RATE_CREDIT.href} rel="noopener" target="_blank">{RATE_CREDIT.label}</a></p></footer>;
}
