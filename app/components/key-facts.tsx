"use client";

import Link from "next/link";
import { allGames } from "@/lib/catalog";
import { guideFor, type GameKey } from "@/lib/keys";

// Region / Platform / Product type / Works on row. Shared by Get your product (task 8) and the key page so both look like one flow.
export const keyInfo = (key: Pick<GameKey, "name" | "platform" | "region">) => {
  const guide = guideFor(key.platform);
  return { guide, region: key.region ?? "Global", platformName: guide?.name ?? key.platform ?? "the platform",
    worksOn: guide?.worksOn ?? allGames().find((g) => g.name === key.name)?.os ?? "See activation guide" };
};

export function KeyFacts({ keyItem }: { keyItem: GameKey }) {
  const { guide, region, worksOn } = keyInfo(keyItem);
  return <dl className="key-facts">
    <div><dt>Region</dt><dd>{region}</dd>{guide && <Link className="text-link" href={`/help/activate/${guide.slug}#region`}>Check region restrictions</Link>}</div>
    <div><dt>Platform</dt><dd>{keyItem.platform ?? "—"}</dd>{guide && <Link className="text-link" href={`/help/activate/${guide.slug}`}>Activation guide</Link>}</div>
    <div><dt>Product type</dt><dd>Digital key <span className="tip" tabIndex={0} role="note" aria-label="A code you enter on the platform to add the game to your account. Nothing is shipped.">?<span className="tip-box" aria-hidden="true">A code you enter on the platform to add the game to your account. Nothing is shipped.</span></span></dd></div>
    <div><dt>Works on</dt><dd>{worksOn}</dd></div>
  </dl>;
}

// Unrevealed keys open Get your product (task 8, user 2026-09-30); revealed keys open the key page.
export const keyHref = (k: Pick<GameKey, "id" | "revealedAt">) => `/account/keys/${k.revealedAt ? "view" : "get"}?id=${encodeURIComponent(k.id)}`;
