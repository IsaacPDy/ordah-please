import { expoClient } from "@better-auth/expo/client";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

interface MobileCookieStorage {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => unknown;
}

type CompatibleExpoClientPlugin = Omit<
  ReturnType<typeof expoClient>,
  "fetchPlugins" | "getActions"
> & {
  fetchPlugins: NonNullable<BetterAuthClientPlugin["fetchPlugins"]>;
  getActions: (
    ...args: Parameters<NonNullable<BetterAuthClientPlugin["getActions"]>>
  ) => {
    getCookie: () => string;
  };
};

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
  const plugin = expoClient({
    cookiePrefix: "ordah-please",
    scheme: "ordahplease",
    storage,
    storagePrefix: "ordah-please",
  }) as unknown as CompatibleExpoClientPlugin;

  return {
    baseURL: readMobileApiUrl(baseURL),
    // Better Auth infers Expo actions from a plugin tuple, so keep this as
    // one typed tuple instead of widening it to an ordinary plugin array.
    plugins: [plugin] as [typeof plugin],
  };
}

/** Creates the native Better Auth client after the public API origin is available. */
export function createMobileAuthClient(
  baseURL: string = readMobileApiUrl(),
  storage: MobileCookieStorage = SecureStore,
) {
  return createAuthClient(buildMobileAuthOptions(baseURL, storage));
}

let runtimeAuthClient: ReturnType<typeof createMobileAuthClient> | undefined;

/** Returns one native auth client so its session store remains stable across renders. */
export function getMobileAuthClient() {
  runtimeAuthClient ??= createMobileAuthClient();
  return runtimeAuthClient;
}

/** Reads the Expo plugin's stored session cookie before a protected native API request. */
export function readMobileSessionCookie(
  client: { readonly getCookie: () => string } = getMobileAuthClient(),
): string {
  const cookie = client.getCookie();
  if (cookie.trim() === "") {
    throw new Error("A Better Auth session is required.");
  }
  return cookie;
}
