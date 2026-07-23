import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { calculateRoiEstimate } from "@/lib/marketing/roi";

const root = process.cwd();

describe("public ROI estimate", () => {
  it("matches the documented default illustration", () => {
    expect(calculateRoiEstimate({
      hourlyRate: 150,
      unbilledHours: 12,
      activeProjects: 4,
      projectValue: 25_000
    })).toEqual({
      monthlyLeakage: 7_200,
      annualLeakage: 86_400,
      serviceLow: 750,
      serviceHigh: 1_500,
      projectRisk: 29
    });
  });

  it("does not recommend a service price when leakage is zero", () => {
    expect(calculateRoiEstimate({
      hourlyRate: 0,
      unbilledHours: 12,
      activeProjects: 4,
      projectValue: 25_000
    })).toMatchObject({
      monthlyLeakage: 0,
      annualLeakage: 0,
      serviceLow: null,
      serviceHigh: null,
      projectRisk: 0
    });
  });

  it("bounds invalid values and treats project count as an integer", () => {
    expect(calculateRoiEstimate({
      hourlyRate: Number.POSITIVE_INFINITY,
      unbilledHours: -4,
      activeProjects: 2.9,
      projectValue: Number.NaN
    })).toMatchObject({
      monthlyLeakage: 0,
      annualLeakage: 0,
      projectRisk: 0
    });
    expect(calculateRoiEstimate({
      hourlyRate: 100,
      unbilledHours: 10,
      activeProjects: 2.9,
      projectValue: 10_000
    }).monthlyLeakage).toBe(2_000);
  });
});

describe("marketing evidence assets", () => {
  it("uses an extension matching the real fictional dashboard image format", async () => {
    const image = await fs.readFile(path.join(root, "public/images/scopeledger-demo-dashboard.jpg"));
    expect(Array.from(image.subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);
    const page = await fs.readFile(path.join(root, "app/page.tsx"), "utf8");
    expect(page).toContain("/images/scopeledger-demo-dashboard.jpg");
    expect(page).not.toContain("Paid private beta");
  });

  it("keeps every local Markdown document link resolvable", async () => {
    const files = [
      path.join(root, "README.md"),
      ...(await fs.readdir(path.join(root, "docs")))
        .filter((name) => name.endsWith(".md"))
        .map((name) => path.join(root, "docs", name))
    ];

    for (const file of files) {
      const markdown = await fs.readFile(file, "utf8");
      const links = [...markdown.matchAll(/\[[^\]]+\]\(([^)]+\.md)(?:#[^)]+)?\)/g)];
      for (const [, relative] of links) {
        await expect(fs.access(path.resolve(path.dirname(file), relative))).resolves.toBeUndefined();
      }
    }
  });
});
