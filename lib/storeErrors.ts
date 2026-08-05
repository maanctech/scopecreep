import type { ScopeFinding } from "@/lib/types";

export class NotFoundError extends Error {}

export class VersionConflictError extends Error {
  constructor(
    message = "This finding changed since you loaded it. Review the latest values and try again.",
    public readonly currentFinding?: ScopeFinding,
  ) {
    super(message);
  }
}

export class LocalStoreCorruptError extends Error {}
