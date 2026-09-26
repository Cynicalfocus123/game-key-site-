import { COUNTRY_CODES } from "@/lib/currency/currencies";

// Customer profile helpers shared by the dashboard, the demo API and the server (auth hooks + login history API).
// Avatar = one of these preset colours behind the user's initials (no image upload yet).
export const AVATARS = ["blue", "green", "amber", "red", "teal", "slate"] as const;
export const isAvatar = (v: unknown): v is (typeof AVATARS)[number] => typeof v === "string" && (AVATARS as readonly string[]).includes(v);
export const isCountry = (v: unknown): v is string => typeof v === "string" && COUNTRY_CODES.includes(v);
export const countryName = (code: string) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code; } catch { return code; } };
export const initials = (name: string, email = "") => (name.trim() || email).split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export type ProfileUser = { name: string; email: string; emailVerified: boolean; avatar?: string | null; country?: string | null; currency?: string | null; marketingChoiceAt?: string | Date | null };
export type ProfileTask = { id: string; label: string; done: boolean; href: string };
// Profile completion: 6 tasks (Handoff v8 C1). Name counts once it differs from the email local part (checkout sign-up default).
export function profileTasks(u: ProfileUser): ProfileTask[] {
  const local = u.email.split("@")[0] ?? "";
  return [
    { id: "email", label: "Verify your email", done: u.emailVerified, href: "/account/settings#email" },
    { id: "name", label: "Add your name", done: Boolean(u.name.trim()) && u.name.trim() !== local, href: "/account/settings#profile" },
    { id: "avatar", label: "Choose an avatar", done: isAvatar(u.avatar), href: "/account/settings#profile" },
    { id: "country", label: "Set your country", done: isCountry(u.country), href: "/account/settings#profile" },
    { id: "currency", label: "Pick your currency", done: Boolean(u.currency), href: "/account/settings#currency" },
    { id: "deals", label: "Choose about deal emails", done: Boolean(u.marketingChoiceAt), href: "/account/settings#deals" },
  ];
}

// Login history shows only part of the IP address.
export function maskIp(ip: string | null | undefined) {
  if (!ip) return "—";
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.split(".").slice(0, 2).join(".") + ".•.•";
  if (ip.includes(":")) return ip.split(":").filter(Boolean).slice(0, 2).join(":") + ":•••";
  return ip;
}
export const LOGIN_HISTORY_DAYS = 90;
