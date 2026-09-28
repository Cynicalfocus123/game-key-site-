// Account types + admin user management (future task S7). Shared by register, admin pages, the demo store and the server.
// Sign-up picks customer or seller (sellers can only register + sign in for now). Admin role only by an admin (or scripts/create-admin.mjs).
export type Role = "customer" | "seller" | "admin";
export const ROLES: { id: Role; label: string }[] = [{ id: "customer", label: "Customer" }, { id: "seller", label: "Seller" }, { id: "admin", label: "Admin" }];
export const isRole = (r: unknown): r is Role => r === "customer" || r === "seller" || r === "admin";
export const roleLabel = (r: string) => ROLES.find((x) => x.id === r)?.label ?? r;
// Register page choice. Anything else → customer.
export const signupRole = (r: unknown): "customer" | "seller" => (r === "seller" ? "seller" : "customer");

export type NewUser = { name: string; email: string; role: Role };
export type AuditRow = { action: string; detail: string; by: string | null; createdAt: string }; // by = admin email
export const USER_ADMIN_LIMIT = { max: 60, windowMs: 10 * 60_000 }; // admin user writes (add user + role change) per admin
export const USER_ERRORS = {
  name: "Enter a name (up to 80 characters).",
  email: "Enter a valid email address.",
  role: "Choose a role.",
  taken: "An account with this email already exists.",
  self: "You cannot change your own role.",
  lastAdmin: "This is the last admin. Make another admin first.",
  notFound: "User not found.",
  limit: "Too many changes. Wait a few minutes and try again.",
} as const;
export const cleanEmail = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : "");
export function checkNewUser(u: Partial<NewUser>): string | null {
  const name = (u.name ?? "").trim();
  if (!name || name.length > 80) return USER_ERRORS.name;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail(u.email)) || cleanEmail(u.email).length > 254) return USER_ERRORS.email;
  if (!isRole(u.role)) return USER_ERRORS.role;
  return null;
}
export const auditText = (a: Pick<AuditRow, "action" | "detail">) => (a.action === "role" ? `Role changed: ${a.detail}` : a.action === "created" ? `Account created by admin (${a.detail})`
  : a.action === "topup_failed" ? `Top-up marked failed: ${a.detail}` : a.action === "topup_cancelled" ? `Top-up cancelled: ${a.detail}` : `${a.action}: ${a.detail}`);
