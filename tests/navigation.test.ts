import { describe, expect, it } from "vitest";
import { internalNavigationFor } from "@/components/Shell";

describe("role-aware navigation", () => {
  it("shows manual import to Reviewers without exposing lead administration", () => {
    const paths = internalNavigationFor("Reviewer").map((item) => item.href);

    expect(paths).toContain("/app/import");
    expect(paths).toContain("/app/integrations");
    expect(paths).toContain("/app/notifications");
    expect(paths).not.toContain("/admin");
  });

  it("hides write-only workflows from Read Only users", () => {
    const paths = internalNavigationFor("Read Only").map((item) => item.href);

    expect(paths).not.toContain("/app/import");
    expect(paths).not.toContain("/admin");
    expect(paths).toContain("/app/findings");
    expect(paths).not.toContain("/app/notifications");
  });
});
