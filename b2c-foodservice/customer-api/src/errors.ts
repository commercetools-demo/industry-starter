/** An error with an HTTP status and a stable machine-readable code. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Thrown by the API layer when a write used a stale customer version. */
export class ConcurrentModificationError extends Error {
  constructor() {
    super('ConcurrentModification');
  }
}
