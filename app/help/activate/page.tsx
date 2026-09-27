import Link from "next/link";
import { GUIDES } from "@/lib/keys";
import { PageShell } from "../../components/auth-ui";

export const metadata = { title: "Activation guides | CoreCart" };

// Index of static activation guides (Handoff v8 C8).
export default function GuidesPage() {
  return <PageShell><article className="guide">
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <span aria-current="page">Activation guides</span></nav>
    <h1>Activation guides</h1>
    <p className="guide-lead">Choose the platform shown on your key.</p>
    <ul className="guide-list">{GUIDES.map((g) => <li key={g.slug}><Link href={`/help/activate/${g.slug}`}><strong>{g.name}</strong><span>{g.worksOn}</span><span aria-hidden="true">›</span></Link></li>)}</ul>
  </article></PageShell>;
}
