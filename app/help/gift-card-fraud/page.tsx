import Link from "next/link";
import { PageShell } from "../../components/auth-ui";

export const metadata = { title: "Gift card fraud | CoreCart" };

// Linked from the payment page notice (Handoff v12 2d).
export default function GiftCardFraudPage() {
  return <PageShell><article className="guide">
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <span aria-current="page">Gift card fraud</span></nav>
    <h1>Stay safe from gift card fraud</h1>
    <p className="guide-lead">Scammers often ask people to pay with gift cards or game keys because the money is hard to get back.</p>
    <ol className="guide-steps">
      <li>No real company, bank, tax office or police will ask you to pay a bill with gift cards or game keys.</li>
      <li>Never share a code with someone you have not met in person, even if they say it is urgent.</li>
      <li>Be careful with online sellers, game &quot;recovery&quot; offers or prizes that ask for a code first.</li>
      <li>Keep your receipt. Codes are delivered to your CoreCart Keys library only.</li>
    </ol>
    <section className="guide-box"><h2>Think it happened to you?</h2><p>Stop contact with the person, do not send more codes, and open a support ticket from your account with the order number. Report the scam to your local police.</p></section>
  </article></PageShell>;
}
