/**
 * Extracts a human-readable message from a caught value of unknown type.
 * `catch` variables are `unknown` under strict mode -- this replaces the
 * common but unsafe `catch (err: any) { ... err.message ... }` pattern,
 * which assumes every thrown value is an Error without checking.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return fallback;
}
