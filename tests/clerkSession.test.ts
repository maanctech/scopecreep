import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requestToken,
  resetClaimsVerifierForTesting,
  sessionFromToken,
  setClaimsVerifierForTesting
} from "@/lib/auth/clerkSession";

const CLAIMS = {
  v: 2,
  sub: "user_abc",
  sid: "sess_abc",
  exp: 1_800_000_000,
  email: "mara@example.com",
  o: { id: "org_abc", rol: "admin", slg: "meridian" }
};

afterEach(() => {
  vi.unstubAllEnvs();
  resetClaimsVerifierForTesting();
});

const accepts = async () => CLAIMS;

const rejects = async () => {
  throw new Error("token-expired");
};

describe("turning a request into a Clerk session", () => {
  it("reads the signed-in user from a token that verifies", async () => {
    const session = await sessionFromToken("a.b.c", accepts);

    expect(session?.clerkUserId).toBe("user_abc");
    expect(session?.clerkOrganizationId).toBe("org_abc");
  });

  it("treats an expired or forged token as nobody rather than raising", async () => {
    await expect(sessionFromToken("a.b.c", rejects)).resolves.toBeNull();
  });

  it("treats a missing token as nobody", async () => {
    await expect(sessionFromToken(null, accepts)).resolves.toBeNull();
    await expect(sessionFromToken("", accepts)).resolves.toBeNull();
  });
});

describe("finding the token on an incoming request", () => {
  it("reads the session cookie a browser sends", () => {
    const request = new Request("https://app.example/api/findings", {
      headers: { cookie: "other=1; __session=header.payload.signature; more=2" }
    });

    expect(requestToken(request)).toBe("header.payload.signature");
  });

  it("reads the bearer token a non-browser client sends", () => {
    const request = new Request("https://app.example/api/findings", {
      headers: { authorization: "Bearer header.payload.signature" }
    });

    expect(requestToken(request)).toBe("header.payload.signature");
  });

  it("reports no token when the request carries neither", () => {
    expect(requestToken(new Request("https://app.example/api/findings"))).toBeNull();
  });

  /**
   * A cookie set for a parent domain arrives alongside this application's own
   * and nothing in the header distinguishes them, so whoever set the extra one
   * would otherwise choose which account the request runs as.
   */
  it("carries no session when a second session cookie is also present", () => {
    const request = new Request("https://app.example/api/findings", {
      headers: { cookie: "__session=attacker.token.here; __session=header.payload.signature" }
    });

    expect(requestToken(request)).toBeNull();
  });

  it("still prefers an explicit bearer token over any cookie at all", () => {
    const request = new Request("https://app.example/api/findings", {
      headers: {
        authorization: "Bearer header.payload.signature",
        cookie: "__session=one; __session=two"
      }
    });

    expect(requestToken(request)).toBe("header.payload.signature");
  });
});

describe("replacing the claims verifier", () => {
  /**
   * The override is the one thing here that could accept a token Clerk never
   * signed, so it is fenced to the test runner exactly as the authentication
   * bypass is, rather than relying on nothing in production calling it.
   */
  it("refuses to install a replacement on a production server", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => setClaimsVerifierForTesting(accepts)).toThrow(/production server/);
  });

  /**
   * A replacement installed before a deployment turned production must not
   * survive into it either, so the override is ignored as well as refused.
   */
  it("ignores a replacement that was already installed once production is in effect", async () => {
    setClaimsVerifierForTesting(accepts);
    vi.stubEnv("NODE_ENV", "production");

    await expect(sessionFromToken("a.b.c")).resolves.toBeNull();
  });

  it("installs a replacement anywhere else", () => {
    expect(() => setClaimsVerifierForTesting(accepts)).not.toThrow();
  });
});
