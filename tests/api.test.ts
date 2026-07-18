import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/messages/analyze/route";
import { MAX_MESSAGE_LENGTH } from "@/lib/limits";

describe("POST /api/messages/analyze", () => {
  it("returns 400 for malformed JSON", async () => {
    const response = await POST(
      new Request("http://local.test/api/messages/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad"
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON."
    });
  });

  it("returns a focused validation error for oversized messages", async () => {
    const response = await POST(
      new Request("http://local.test/api/messages/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "missing-project",
          source: "Slack",
          messageText: "x".repeat(MAX_MESSAGE_LENGTH + 1)
        })
      })
    );

    const payload = (await response.json()) as { error: string };
    expect(response.status).toBe(400);
    expect(payload.error).toContain("Client message must be");
  });

  it("returns 404 when the project id does not exist", async () => {
    const response = await POST(
      new Request("http://local.test/api/messages/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: "missing-project",
          source: "Email",
          messageText: "Can you add a login portal?"
        })
      })
    );

    await expect(response.json()).resolves.toEqual({ error: "Project not found." });
    expect(response.status).toBe(404);
  });
});
