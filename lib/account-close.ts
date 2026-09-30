// T3 close account: shared texts + checks (settings page, admin user page, demo store, API). Data is never deleted.
export const CLOSE_WORD = "CLOSE";
export const CLOSE_ERRORS = {
  word: `Type ${CLOSE_WORD} to confirm.`,
  password: "Wrong password.",
  reason: "Enter a reason (3–500 characters).",
  already: "This account is already closed.",
  notClosed: "This account is not closed.",
  notFound: "User not found.",
  admin: "Admin accounts cannot be closed. The master admin removes admin access first.",
  emailTaken: "A newer account uses this email now, so this one cannot be reopened with it.",
  signIn: "This account is closed. Contact support to reopen it.",
  claimLost: "This email is in use again, so this sign-up cannot be finished. Sign in, or contact support.", // R1
} as const;

// R1: a sign-up that reuses a closed account's email keeps this placeholder until it verifies (claim_email = the real address).
export const claimPlaceholder = (id: string) => `claim+${id}@claim.invalid`;
export const isClaimPlaceholder = (email: string | null | undefined) => typeof email === "string" && /^claim\+[\w-]+@claim\.invalid$/i.test(email);
export const closedPlaceholder = (id: string) => `closed+${id}@closed.invalid`;
export const isPlaceholderEmail = (email: string | null | undefined) => typeof email === "string" && email.toLowerCase().endsWith(".invalid");
