import { describe, expect, it } from "vitest";
import { requestToken, sessionFromToken } from "@/lib/auth/clerkSession";

const CLAIMS = {
  v: 2,
  sub: "user_abc",
  sid: "sess_abc",
  exp: 1_800_000_000,
  email: "mara@example.com",
  o: { id: "org_abc", rol: "admin", slg: "meridian" }
};

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
});
