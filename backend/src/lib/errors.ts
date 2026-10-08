export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const badRequest = (message = "Bad request") => new AppError(400, "BAD_REQUEST", message);
export const unauthorized = (message = "Unauthorized") => new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Forbidden") => new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found") => new AppError(404, "NOT_FOUND", message);
export const conflict = (message = "Conflict") => new AppError(409, "CONFLICT", message);
