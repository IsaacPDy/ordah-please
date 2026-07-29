import { expoClient } from "@better-auth/expo/client";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

interface MobileCookieStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => unknown;
}

/** Reads and validates the public server origin used by the native auth client. */
export function readMobileApiUrl(
  value: string | undefined = process.env.EXPO_PUBLIC_API_URL,
): string {
  try {
    if (!value) {
      throw new Error("missing");
    }

    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error("invalid");
    }

    return url.origin;
  } catch {
    throw new Error("EXPO_PUBLIC_API_URL must be an absolute HTTP(S) origin.");
  }
}

/** Builds Better Auth's Expo plugin with encrypted, app-specific cookie storage. */
export function buildMobileAuthOptions(
  baseURL: string,
  storage: MobileCookieStorage,
) {
  return {
    baseURL: readMobileApiUrl(baseURL),
    plugins: [
      // Better Auth 1.6.25's Expo declaration conflicts with its own client
      // declaration under exactOptionalPropertyTypes, although both packages
      // resolve to the same runtime version and this is the documented plugin.
      expoClient({
        cookiePrefix: "ordah-please",
        scheme: "ordahplease",
        storage,
        storagePrefix: "ordah-please",
      }) as unknown as BetterAuthClientPlugin,
    ],
  };
}

/** Creates the native Better Auth client after the public API origin is available. */
export function createMobileAuthClient(
  baseURL: string = readMobileApiUrl(),
  storage: MobileCookieStorage = SecureStore,
) {
  return createAuthClient(buildMobileAuthOptions(baseURL, storage));
}

/** Adds the stored Better Auth cookie without introducing a bearer token or ambient credentials. */
export function buildAuthenticatedRequestInit(
  cookie: string,
  init: RequestInit = {},
): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  headers.delete("authorization");

  return {
    ...init,
    credentials: "omit",
    headers,
  };
}

let runtimeAuthClient: ReturnType<typeof createMobileAuthClient> | undefined;

/** Returns one native auth client so its session store remains stable across renders. */
export function getMobileAuthClient() {
  runtimeAuthClient ??= createMobileAuthClient();
  return runtimeAuthClient;
}
