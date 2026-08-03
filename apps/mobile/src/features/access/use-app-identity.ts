import { useCallback, useEffect, useRef, useState } from "react";

import {
  parseAppIdentitySummary,
  type AppIdentitySummary,
} from "@ordah-please/contracts";

import {
  getMobileAuthClient,
  readMobileApiUrl,
  readMobileSessionCookie,
} from "../../auth/auth-client";
import { buildAuthenticatedRequestInit } from "../../auth/authenticated-request";

type RequestFunction = (input: string, init: RequestInit) => Promise<Response>;

export interface AppIdentityDependencies {
  readonly readApiUrl: () => string;
  readonly readSessionCookie: () => string;
  readonly request: RequestFunction;
}

export type AppIdentityState =
  | Readonly<{ kind: "loading"; retry: () => void }>
  | Readonly<{
      identity: AppIdentitySummary;
      kind: "authenticated";
      retry: () => void;
    }>
  | Readonly<{ kind: "unauthenticated"; retry: () => void }>
  | Readonly<{ kind: "unavailable"; retry: () => void }>
  | Readonly<{ kind: "error"; retry: () => void }>;

type AppIdentityLoadState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ identity: AppIdentitySummary; kind: "authenticated" }>
  | Readonly<{ kind: "unauthenticated" }>
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{ kind: "error" }>;

const runtimeDependencies: AppIdentityDependencies = {
  readApiUrl: readMobileApiUrl,
  readSessionCookie: () => readMobileSessionCookie(getMobileAuthClient()),
  request: fetch,
};

/** Extracts and validates the identity data from the trusted API success envelope. */
function parseIdentityEnvelope(value: unknown): AppIdentitySummary {
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("data" in value)
  ) {
    throw new TypeError("Identity response is invalid.");
  }
  return parseAppIdentitySummary((value as { data: unknown }).data);
}

/** Loads the authenticated multi-group identity with explicit loading and retry states. */
export function useAppIdentity(
  dependencies: AppIdentityDependencies = runtimeDependencies,
): AppIdentityState {
  const dependenciesRef = useRef(dependencies);
  const [attempt, setAttempt] = useState(0);
  const [loadState, setLoadState] = useState<AppIdentityLoadState>({
    kind: "loading",
  });
  const retry = useCallback(() => {
    setLoadState({ kind: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const current = dependenciesRef.current;

    void (async () => {
      let cookie: string;
      try {
        cookie = current.readSessionCookie();
      } catch {
        if (!cancelled) {
          setLoadState({ kind: "unauthenticated" });
        }
        return;
      }

      try {
        const response = await current.request(
          `${current.readApiUrl()}/api/identity/me`,
          buildAuthenticatedRequestInit(cookie, { method: "GET" }),
        );
        if (cancelled) {
          return;
        }
        if (response.status === 401) {
          setLoadState({ kind: "unauthenticated" });
          return;
        }
        if (response.status === 503) {
          setLoadState({ kind: "unavailable" });
          return;
        }
        if (!response.ok) {
          setLoadState({ kind: "error" });
          return;
        }
        const identity = parseIdentityEnvelope(await response.json());
        if (!cancelled) {
          setLoadState({ identity, kind: "authenticated" });
        }
      } catch {
        if (!cancelled) {
          setLoadState({ kind: "error" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt, retry]);

  return { ...loadState, retry };
}
