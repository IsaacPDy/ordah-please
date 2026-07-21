import { serializeApiError, type SerializedApiError } from "./errors.js";

export type ApiSuccess<Data> = Readonly<{
  data: Data;
  ok: true;
}>;

export type ApiFailure = Readonly<{
  error: SerializedApiError;
  ok: false;
}>;

export type ApiResult<Data> = ApiSuccess<Data> | ApiFailure;

/** Wraps response data in the common success envelope used by every client. */
export function apiSuccess<Data>(data: Data): ApiSuccess<Data> {
  return { data, ok: true };
}

/** Wraps any failure in a safe common error envelope used by every client. */
export function apiFailure(error: unknown): ApiFailure {
  return { error: serializeApiError(error), ok: false };
}
