import { lookup as callbackLookup } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";

export function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:"))
    return isPrivateAddress(normalized.slice("::ffff:".length));
  if (isIP(address) === 6) {
    const first = Number.parseInt(normalized.split(":", 1)[0] || "0", 16);
    return (
      normalized === "::" ||
      normalized === "::1" ||
      (first & 0xfe00) === 0xfc00 ||
      (first & 0xffc0) === 0xfe80 ||
      (first & 0xff00) === 0xff00
    );
  }
  if (isIP(address) !== 4) return false;
  const parts = normalized.split(".").map(Number);
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) ||
    parts[0] === 0 ||
    parts[0] >= 224
  );
}

function blockedAddressError() {
  return Object.assign(
    new Error("Private or local integration hosts are blocked."),
    { code: "EACCES" },
  );
}

// Re-check the address at socket connection time to prevent DNS rebinding after setup.
export const safeIntegrationLookup: LookupFunction = (
  hostname,
  options,
  callback,
) => {
  callbackLookup(hostname, options, (error, address, family) => {
    if (error) return callback(error, address, family);
    if (process.env.ALLOW_PRIVATE_INTEGRATION_HOSTS === "true")
      return callback(null, address, family);
    const values = Array.isArray(address) ? address : [{ address, family }];
    if (values.some((entry) => isPrivateAddress(entry.address)))
      return callback(blockedAddressError(), address, family);
    return callback(null, address, family);
  });
};

export async function assertSafeIntegrationHost(host: string) {
  const clean = host.trim().toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(clean) || clean.includes(".."))
    throw new Error(
      "Enter a valid mail server hostname without a URL or path.",
    );
  if (process.env.ALLOW_PRIVATE_INTEGRATION_HOSTS === "true") return clean;
  const addresses = isIP(clean)
    ? [{ address: clean }]
    : await lookup(clean, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some((entry) => isPrivateAddress(entry.address))
  )
    throw new Error(
      "Private or local integration hosts are blocked. Set ALLOW_PRIVATE_INTEGRATION_HOSTS=true only for a trusted internal mail server.",
    );
  return clean;
}
