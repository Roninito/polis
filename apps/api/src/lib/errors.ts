/**
 * Shared error types — consistent API error responses.
 */

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }

  toResponse(): Response {
    return Response.json(this.toJSON(), { status: this.statusCode });
  }
}

// Common errors
export const Errors = {
  notFound: (resource = "Resource") =>
    new AppError("NOT_FOUND", `${resource} not found`, 404),

  unauthorized: (message = "Authentication required") =>
    new AppError("UNAUTHORIZED", message, 401),

  forbidden: (message = "Insufficient permissions") =>
    new AppError("FORBIDDEN", message, 403),

  badRequest: (message: string) =>
    new AppError("BAD_REQUEST", message, 400),

  validation: (message: string) =>
    new AppError("VALIDATION_ERROR", message, 422),

  conflict: (message: string) =>
    new AppError("CONFLICT", message, 409),

  rateLimited: () =>
    new AppError("RATE_LIMITED", "Too many requests", 429),

  internal: (message = "Internal server error") =>
    new AppError("INTERNAL_ERROR", message, 500),

  setupRequired: () =>
    new AppError("SETUP_REQUIRED", "Run the setup wizard first", 503),
} as const;
