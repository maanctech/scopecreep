import { describe, expect, it } from "vitest";
import { AuthenticationError, authErrorResponse } from "@/lib/auth/api";
import { AuthorizationError } from "@/lib/auth/authorization";
import { EmailAlreadyClaimedError } from "@/lib/auth/clerkProvisioning";
import { InvalidOriginError, RateLimitError } from "@/lib/auth/security";

async function answerFor(error: unknown) {
  const response = authErrorResponse(error);

  return response ? { status: response.status, body: await response.json() } : null;
}

describe("answering a caller whose request could not be served", () => {
  it("asks an unauthenticated caller to sign in", async () => {
    expect((await answerFor(new AuthenticationError("Sign in to continue.")))?.status).toBe(401);
  });

  it("refuses a caller whose role does not carry the permission", async () => {
    expect((await answerFor(new AuthorizationError("nope")))?.status).toBe(403);
  });

  it("refuses a cross-origin mutation", async () => {
    expect((await answerFor(new InvalidOriginError("bad origin")))?.status).toBe(403);
  });

  it("tells a caller who is going too fast to slow down", async () => {
    expect((await answerFor(new RateLimitError("Too many attempts. Try again later.")))?.status).toBe(429);
  });

  /**
   * This one used to reach the caller as an unhandled failure, which reads as
   * "the site is broken" for a situation only a person can resolve.
   */
  it("reports a contested email address as a conflict, not a failure", async () => {
    const answer = await answerFor(new EmailAlreadyClaimedError("mara@example.com"));

    expect(answer?.status).toBe(409);
    expect(answer?.body.error).toMatch(/already exists/i);
  });

  it("does not claim to have handled an error it does not recognise", () => {
    expect(authErrorResponse(new Error("something else entirely"))).toBeNull();
  });

  /**
   * The address is the other person's, and this response is shown to whoever
   * failed to sign in.
   */
  it("does not repeat the contested address back to the caller", async () => {
    const answer = await answerFor(new EmailAlreadyClaimedError("mara@example.com"));

    expect(JSON.stringify(answer?.body)).not.toContain("mara@example.com");
  });
});
