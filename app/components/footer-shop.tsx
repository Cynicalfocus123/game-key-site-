"use client";

import Link from "next/link";
import { menuTree } from "@/lib/menu";
import { useMenu } from "./menu-config";

// Footer "Shop" column: top-level menu items the admin marked "In footer" (task D).
export function FooterShop() {
  const items = menuTree(useMenu()).filter((t) => t.inFooter && t.kind === "link");
  return <div><strong>Shop</strong>{items.map((t) => <Link key={t.id} href={t.href}>{t.label}{t.isNew && <span className="menu-new">New</span>}</Link>)}</div>;
}
