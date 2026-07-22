export class NotFoundError extends Error {}

export class VersionConflictError extends Error {
  constructor(message = "This finding changed since you loaded it. Reload and try again.") {
    super(message);
  }
}

export class LocalStoreCorruptError extends Error {}
