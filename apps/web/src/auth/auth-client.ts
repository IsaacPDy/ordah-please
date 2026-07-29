"use client";

import { createAuthClient } from "better-auth/react";

/** Creates the deliberately small browser auth surface used by ordah please UI. */
export function createWebAuthClient(baseURL?: string) {
  const client = createAuthClient({ baseURL });

  return {
    signIn: {
      social: client.signIn.social,
    },
    signOut: client.signOut,
    useSession: client.useSession,
  };
}

export const authClient = createWebAuthClient(process.env.NEXT_PUBLIC_APP_URL);
