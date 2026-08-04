import type { ConnectorHttp } from "@/lib/connectors/types";

export function assertProviderUrl(value: string, hostname: string) {
  const url = new URL(value);

  if (url.protocol !== "https:" || url.hostname !== hostname)
    throw new Error("Provider returned an unsafe continuation URL.");

  return url.toString();
}

export async function providerJson<T>(
  fetcher: ConnectorHttp,
  url: string,
  init: RequestInit,
  timeoutMs = 30_000,
): Promise<{ data: T; headers: Headers }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(url, { ...init, signal: controller.signal });
    const data = (await response.json().catch(() => null)) as T | null;

    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after");
      const error = new Error(
        response.status === 429
          ? `Provider rate limit reached${retryAfter ? `; retry after ${retryAfter} seconds` : ""}.`
          : `Provider request failed with status ${response.status}.`,
      );

      Object.assign(error, { status: response.status, retryAfter });
      throw error;
    }

    if (data === null)
      throw new Error("Provider returned an unreadable response.");

    return { data, headers: response.headers };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error("Provider request timed out.");

    throw error;
  } finally {
    clearTimeout(timer);
  }
}
