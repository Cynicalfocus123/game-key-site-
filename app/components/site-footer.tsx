import Link from "next/link";
import { RATE_CREDIT } from "@/lib/currency/currencies";
import { PaymentStrip } from "./payment-logos";

export default function SiteFooter() {
  return <><PaymentStrip /><footer><div className="footer-inner"><Link className="logo" href="/">core<span>cart</span></Link><div><strong>Shop</strong><Link href="/hardware">PC parts</Link><Link href="/hardware">Gaming</Link><Link href="/games">Digital games</Link></div><div><strong>Customer service</strong><Link href="/account/orders">Order tracking</Link><Link href="/account/orders">Returns</Link><Link href="/account/tickets?new=1">Contact us</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div><div><strong>Stay in loop</strong><p>Deals, product launches, and build advice.</p><label className="email"><input placeholder="Email address"/><button>Join</button></label></div></div><p className="copyright">© 2026 CoreCart. Mock storefront, Phase 2 accounts preview. · <a href={RATE_CREDIT.href} rel="noopener" target="_blank">{RATE_CREDIT.label}</a></p></footer></>;
}
