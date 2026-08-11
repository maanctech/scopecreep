export { SESSION_COOKIE_NAME } from "@/constants/typescript/auth";

export function shouldUseSecureSessionCookie() {
  if (process.env.NODE_ENV !== "production") return false;

  try {
    return new URL(process.env.APP_URL || "").protocol === "https:";
  } catch {
    return true;
  }
}
