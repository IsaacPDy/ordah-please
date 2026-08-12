import {
  getMobileAuthClient,
  readMobileApiUrl,
  readMobileSessionCookie,
} from "../../auth/auth-client";
import { buildAuthenticatedRequestInit } from "../../auth/authenticated-request";

type RequestFunction = (input: string, init: RequestInit) => Promise<Response>;

export interface CatalogRequestDependencies {
  readonly readApiUrl: () => string;
  readonly readSessionCookie: () => string;
  readonly request: RequestFunction;
}

export const runtimeCatalogDependencies: CatalogRequestDependencies = {
  readApiUrl: readMobileApiUrl,
  readSessionCookie: () => readMobileSessionCookie(getMobileAuthClient()),
  request: fetch,
};

/** Extracts the data field from the application's trusted success envelope. */
function readCatalogEnvelope(value: unknown): unknown {
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("data" in value)
  ) {
    throw new Error("Catalog response is invalid.");
  }

  return (value as { data: unknown }).data;
}

/** Calls one authenticated catalog endpoint and validates its success payload. */
export async function requestCatalogData<Value>(
  path: string,
  parse: (value: unknown) => Value,
  dependencies: CatalogRequestDependencies,
): Promise<Value> {
  const cookie = dependencies.readSessionCookie();
  const response = await dependencies.request(
    `${dependencies.readApiUrl()}${path}`,
    buildAuthenticatedRequestInit(cookie, { method: "GET" }),
  );

  if (!response.ok) {
    throw new Error(`Catalog request failed with status ${response.status}.`);
  }

  return parse(readCatalogEnvelope(await response.json()));
}
