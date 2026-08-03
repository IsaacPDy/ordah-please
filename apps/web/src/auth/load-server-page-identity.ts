import { cache } from "react";
import { headers as nextHeaders } from "next/headers";

import { PublicApiError } from "@ordah-please/contracts";

import { loadRuntimeIdentity } from "../features/access/access-runtime";
import type { AppIdentity } from "./load-app-identity";
import { verifySession, type VerifiedSession } from "./verify-session";

export type ServerPageIdentityResult =
  | Readonly<{ identity: AppIdentity; status: "authenticated" }>
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{ status: "unavailable" }>;

export interface ServerPageIdentityDependencies {
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => AppIdentity | Promise<AppIdentity>;
  readonly verifySession: (
    request: Request,
  ) => VerifiedSession | Promise<VerifiedSession>;
}

/** Converts server-render request headers into one safe page-level identity state. */
export async function loadServerPageIdentity(
  requestHeaders: Headers,
  dependencies: ServerPageIdentityDependencies,
): Promise<ServerPageIdentityResult> {
  try {
    const request = new Request("http://localhost", {
      headers: requestHeaders,
    });
    const session = await dependencies.verifySession(request);
    const identity = await dependencies.loadIdentity(session);
    return { identity, status: "authenticated" };
  } catch (error) {
    if (error instanceof PublicApiError) {
      if (error.code === "UNAUTHENTICATED") {
        return { status: "unauthenticated" };
      }
      if (error.code === "UNAVAILABLE") {
        return { status: "unavailable" };
      }
    }
    throw error;
  }
}

/** Loads the current server-render identity once per React request tree. */
export const getCurrentServerPageIdentity = cache(
  async (): Promise<ServerPageIdentityResult> => {
    const headerList = await nextHeaders();
    const requestHeaders = new Headers();
    headerList.forEach((value, key) => {
      requestHeaders.set(key, value);
    });
    return loadServerPageIdentity(requestHeaders, {
      loadIdentity: loadRuntimeIdentity,
      verifySession,
    });
  },
);
