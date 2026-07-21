export const API_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "INVALID_INPUT",
  "CONFLICT",
  "UNAVAILABLE",
  "INTERNAL_FAILURE",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type SerializedApiError = Readonly<{
  code: ApiErrorCode;
  message: string;
}>;

/** Carries an error code and message that are explicitly safe to return to clients. */
export class PublicApiError extends Error {
  public readonly code: ApiErrorCode;

  public constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "PublicApiError";
  }
}

/** Converts a trusted public error into a stable transport-safe object. */
export function serializeApiError(error: unknown): SerializedApiError {
  if (error instanceof PublicApiError) {
    return { code: error.code, message: error.message };
  }

  return {
    code: "INTERNAL_FAILURE",
    message: "Something went wrong.",
  };
}
