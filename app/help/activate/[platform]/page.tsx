import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES } from "@/lib/keys";
import { PageShell } from "../../../components/auth-ui";

// Static activation guides (Handoff v8 C8): /help/activate/{steam,xbox,playstation,nintendo,ea,ubisoft}.
export const dynamicParams = false;
export const generateStaticParams = () => GUIDES.map((g) => ({ platform: g.slug }));
export async function generateMetadata({ params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params; const g = GUIDES.find((x) => x.slug === platform);
  return { title: g ? `Activate on ${g.name} | CoreCart` : "Activation guide | CoreCart" };
}

export default async function GuidePage({ params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params; const g = GUIDES.find((x) => x.slug === platform);
  if (!g) notFound();
  return <PageShell><article className="guide">
    <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> <span aria-hidden="true">›</span> <Link href="/help/activate">Activation guides</Link> <span aria-hidden="true">›</span> <span aria-current="page">{g.name}</span></nav>
    <h1>How to activate a key on {g.name}</h1>
    <p className="guide-lead">Works on: {g.worksOn}. Find your key in <Link className="text-link" href="/account/keys">Keys library</Link>, select Reveal key, then follow these steps.</p>
    <ol className="guide-steps">{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
    <p><a className="btn btn-primary" href={g.url} target="_blank" rel="noopener noreferrer">Open {g.site} <span aria-hidden="true">↗</span></a></p>
    <section id="region" className="guide-box"><h2>Region restrictions</h2>
      <p>Every key shows its region on the product page, in your cart and in your library. <strong>Global</strong> keys work in every country. <strong>ROW</strong> (rest of world) and regional keys only work in the countries listed for them, based on your {g.name} account country.</p>
      <p>A key that does not work in your country cannot be activated there. Check the region line before you buy; it turns green when the key works where you are.</p></section>
    <section className="guide-box"><h2>Key not working?</h2><p>Copy the key from your library instead of typing it. If it still fails, open the key in your library and select <strong>Report a problem with this key</strong>.</p></section>
    <p className="guide-others">Other platforms: {GUIDES.filter((x) => x.slug !== g.slug).map((x, i) => <span key={x.slug}>{i > 0 && " · "}<Link className="text-link" href={`/help/activate/${x.slug}`}>{x.name}</Link></span>)}</p>
  </article></PageShell>;
}
