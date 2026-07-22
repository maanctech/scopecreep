export const SESSION_COOKIE_NAME = "scopeledger_session";

export function useSecureSessionCookie() {
  if (process.env.NODE_ENV !== "production") return false;
  try {
    return new URL(process.env.APP_URL || "").protocol === "https:";
  } catch {
    return true;
  }
}
