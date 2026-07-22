import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "@/lib/security/network";

describe("integration network targets", () => {
  it("identifies loopback, link-local, and RFC1918 addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.4",
      "169.254.169.254",
      "100.64.0.1",
      "198.18.0.1",
      "224.0.0.1",
      "::1",
      "fd00::1",
      "fe90::1",
      "::ffff:127.0.0.1",
    ])
      expect(isPrivateAddress(address)).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });
});
