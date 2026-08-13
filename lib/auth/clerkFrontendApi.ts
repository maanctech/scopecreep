const HOST = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

/**
 * A publishable key is the instance's frontend API host, base64 encoded with a
 * trailing marker. Decoding it keeps the browser policy and the key that the
 * browser actually talks to from drifting apart.
 */
export function frontendApiOrigin(publishableKey: string | undefined) {
  const encoded = publishableKey?.trim().replace(/^pk_(test|live)_/, "");

  if (!encoded || encoded === publishableKey?.trim()) return null;

  const host = Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");

  return HOST.test(host) ? `https://${host}` : null;
}
