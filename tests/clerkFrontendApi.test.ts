import { describe, expect, it } from "vitest";
import { frontendApiOrigin } from "@/lib/auth/clerkFrontendApi";

/**
 * The publishable key carries the instance's frontend API host inside it, so
 * the browser policy can be built without a second environment variable that
 * could drift out of step with the key.
 */
const developmentKey = `pk_test_${Buffer.from("chief-mole-42.clerk.accounts.dev$").toString("base64")}`;
const productionKey = `pk_live_${Buffer.from("clerk.scopeledger.com$").toString("base64")}`;

describe("finding the Clerk frontend API a page must be allowed to reach", () => {
  it("reads the development host out of a test publishable key", () => {
    expect(frontendApiOrigin(developmentKey)).toBe("https://chief-mole-42.clerk.accounts.dev");
  });

  it("reads the custom host out of a live publishable key", () => {
    expect(frontendApiOrigin(productionKey)).toBe("https://clerk.scopeledger.com");
  });

  it("reports no host rather than a broken one when the key is missing or malformed", () => {
    expect(frontendApiOrigin(undefined)).toBeNull();
    expect(frontendApiOrigin("")).toBeNull();
    expect(frontendApiOrigin("not-a-publishable-key")).toBeNull();
    expect(frontendApiOrigin("pk_test_!!!not-base64!!!")).toBeNull();
  });
});
