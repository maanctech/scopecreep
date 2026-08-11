import { timingSafeEqual } from "node:crypto";

export class ScheduledCallerError extends Error {}

function offeredSecret(request: Request) {
  const header = request.headers.get("authorization") ?? "";

  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
}

/**
 * Scheduled work carries no session and belongs to no organization, so a shared
 * secret is the whole credential. An unset secret refuses every caller: the
 * alternative is a deployment where forgetting one environment variable leaves
 * a queue-draining endpoint open to the internet.
 */
export function assertScheduledCaller(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret)
    throw new ScheduledCallerError("Scheduled work is not configured on this deployment.");

  const expected = Buffer.from(secret);
  const actual = Buffer.from(offeredSecret(request));

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new ScheduledCallerError("Scheduled work requires its own credential.");
}
