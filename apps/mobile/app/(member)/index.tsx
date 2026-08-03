import { CircleCheck } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import {
  getMobileAuthClient,
  readMobileApiUrl,
  readMobileSessionCookie,
} from "../../src/auth/auth-client";
import { buildAuthenticatedRequestInit } from "../../src/auth/authenticated-request";
import { ShellScreen } from "../../src/components/shell-screen";
import { HomeAdminCard } from "../../src/features/access/home-admin-card";

type HomeAdminState = Readonly<{
  isPlatformAdmin: boolean;
  pendingCount: number;
}>;

const NON_ADMIN_STATE: HomeAdminState = {
  isPlatformAdmin: false,
  pendingCount: 0,
};

/** Reads the trusted identity summary that drives the platform-admin shortcut on Home. */
async function loadHomeAdminState(
  cookie: string,
  request: (input: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<HomeAdminState> {
  const response = await request(
    `${readMobileApiUrl()}/api/identity/me`,
    buildAuthenticatedRequestInit(cookie, { method: "GET" }),
  );
  if (!response.ok) {
    return NON_ADMIN_STATE;
  }
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("data" in value)
  ) {
    return NON_ADMIN_STATE;
  }
  const data = (value as { data: unknown }).data;
  if (typeof data !== "object" || data === null) {
    return NON_ADMIN_STATE;
  }
  const record = data as Record<string, unknown>;
  return {
    isPlatformAdmin: record.isPlatformAdmin === true,
    pendingCount:
      typeof record.pendingAdminRequestCount === "number"
        ? record.pendingAdminRequestCount
        : 0,
  };
}

/** Shows the member home shell without inventing an order before real order data exists. */
export default function HomeScreen() {
  const router = useRouter();
  const [adminState, setAdminState] = useState<HomeAdminState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(() => readMobileSessionCookie(getMobileAuthClient()))
      .then((cookie) => loadHomeAdminState(cookie))
      .then((state) => {
        if (!cancelled) {
          setAdminState(state);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAdminState(NON_ADMIN_STATE);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ShellScreen
      description="Active orders and restaurant updates will appear here."
      emptyTitle="Nothing needs your attention yet"
      header={
        adminState === null ? null : (
          <HomeAdminCard
            isPlatformAdmin={adminState.isPlatformAdmin}
            onOpen={() => {
              router.push("/admin/access-requests");
            }}
            pendingCount={adminState.pendingCount}
          />
        )
      }
      icon={CircleCheck}
      title="Your home"
    />
  );
}
