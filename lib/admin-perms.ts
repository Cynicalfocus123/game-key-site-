// Admin sections + per-admin permissions (T2). Shared by the server guard, the demo store and the admin UI.
// master_admin: every section always, and the only role that can add, promote, demote or remove admins and set permissions.
// admin: only the sections in its list (checked on the server on every admin API call).
export type AdminPerm = "users" | "wallet" | "topups" | "products" | "menu" | "filters" | "currencies" | "giftcards" | "promo" | "returns" | "tickets" | "sellers" | "fees";
// href = the admin page(s) this permission opens (sidebar + "No access" page). wallet has no page of its own (Adjust balance on a user).
export const ADMIN_PERMS: { id: AdminPerm; label: string; href?: string; paths: string[] }[] = [
  { id: "users", label: "Users", href: "/admin/users", paths: ["/admin/users", "/admin/user"] },
  { id: "wallet", label: "Wallet / Adjust balance", paths: [] },
  { id: "topups", label: "Top-ups", href: "/admin/topups", paths: ["/admin/topups", "/admin/topup"] },
  { id: "products", label: "Products + key inventory", href: "/admin/products", paths: ["/admin/products", "/admin/purchase-popup", "/admin/product-requests"] }, // purchase popup settings (2026-09-30) + seller product requests (2026-10-08) ride on this section
  { id: "menu", label: "Menu & categories", href: "/admin/categories", paths: ["/admin/categories"] },
  { id: "filters", label: "Filters", href: "/admin/filters", paths: ["/admin/filters"] },
  { id: "currencies", label: "Currencies", href: "/admin/currencies", paths: ["/admin/currencies"] },
  { id: "giftcards", label: "Gift cards", href: "/admin/gift-cards", paths: ["/admin/gift-cards"] },
  { id: "promo", label: "Promo codes", href: "/admin/promo-codes", paths: ["/admin/promo-codes"] },
  { id: "returns", label: "Returns", href: "/admin/returns", paths: ["/admin/returns"] },
  { id: "tickets", label: "Tickets", href: "/admin/tickets", paths: ["/admin/tickets", "/admin/ticket"] },
  // T3: KYC data. Not given to admins made before T3 (migration 0020 saved their 11 sections); the master ticks it.
  { id: "sellers", label: "Seller applications", href: "/admin/sellers", paths: ["/admin/sellers", "/admin/seller"] },
  // Task 7 (2026-09-30): service fee + sales tax settings. Admins with a saved section list do not get it until the master ticks it.
  { id: "fees", label: "Fees & tax", href: "/admin/fees", paths: ["/admin/fees"] },
];
export const ALL_PERMS: AdminPerm[] = ADMIN_PERMS.map((p) => p.id);
// Master-only page (admins list + permission checkboxes).
export const MASTER_PATHS = ["/admin/admins"];

export const isAdminRole = (r: string) => r === "admin" || r === "master_admin";
export const isMasterRole = (r: string) => r === "master_admin";
// perms: the stored list (null / missing = all sections: the default for admins made before T2, user choice 2026-09-29).
export type AdminUserLike = { role: string; emailVerified: boolean; adminPerms?: string[] | null };
// Admin access: role = admin or master_admin (T2) AND verified email. The first admin is made on the server (npm run admin:create);
// after that only a master admin can add or promote admins. No sign-up or Google sign-in can create or promote an admin.
export const hasAdminAccess = (u: AdminUserLike) => u.emailVerified && isAdminRole(u.role);
export function permsOf(u: AdminUserLike): AdminPerm[] {
  if (!hasAdminAccess(u)) return [];
  if (isMasterRole(u.role) || u.adminPerms == null) return [...ALL_PERMS];
  return cleanPerms(u.adminPerms);
}
export const hasPerm = (u: AdminUserLike, p: AdminPerm) => permsOf(u).includes(p);
// Known ids only, no repeats, in section order. Anything else → null (bad request).
export function cleanPerms(x: unknown): AdminPerm[] {
  if (!Array.isArray(x)) return [];
  const set = new Set(x.filter((v): v is string => typeof v === "string"));
  return ALL_PERMS.filter((p) => set.has(p));
}
export const parsePerms = (x: unknown): AdminPerm[] | null => (Array.isArray(x) && x.length <= 50 && x.every((v) => typeof v === "string" && (ALL_PERMS as string[]).includes(v)) ? cleanPerms(x) : null);
export const permLabel = (p: string) => ADMIN_PERMS.find((x) => x.id === p)?.label ?? p;
// Audit text for a permission change: "Users, Tickets → Users" ("none" when empty, "all sections" when every box is ticked).
export const permsText = (list: string[]) => (list.length === 0 ? "none" : list.length === ALL_PERMS.length && ALL_PERMS.every((p) => list.includes(p)) ? "all sections" : cleanPerms(list).map(permLabel).join(", "));
// Which permission an admin page needs: a section id, "master", or null (Overview: every admin).
export function pagePerm(path: string): AdminPerm | "master" | null {
  const clean = path.replace(/\/$/, "");
  if (MASTER_PATHS.some((m) => clean === m || clean.startsWith(`${m}/`))) return "master";
  return ADMIN_PERMS.find((p) => p.paths.some((m) => clean === m || clean.startsWith(`${m}/`)))?.id ?? null;
}

export const PERM_ERRORS = {
  noAccess: "No access to this section. Ask the master admin.",
  masterOnly: "Only the master admin can do this.",
  adminsMasterOnly: "Only the master admin can add, promote, demote or remove admins.",
  notAdmin: "This user is not an admin.",
  master: "The master admin always has every section.",
  bad: "Unknown section.",
} as const;

// Role change rules (server + demo). actor = the admin making the change.
export function roleChangeError(actorRole: string, fromRole: string, toRole: string): string | null {
  if ((isAdminRole(fromRole) || isAdminRole(toRole)) && !isMasterRole(actorRole)) return PERM_ERRORS.adminsMasterOnly;
  return null;
}
// Permissions a user gets when the role changes: new admins start with none (the master ticks boxes), others have none stored.
export const permsAfterRole = (toRole: string): AdminPerm[] | null => (toRole === "admin" ? [] : null);
