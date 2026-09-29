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
} as const;
