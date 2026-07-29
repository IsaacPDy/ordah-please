"use client";

import { useState } from "react";

import { authClient } from "../../auth/auth-client";
import { InvitationCard } from "./invitation-card";

type InvitationStatus = "idle" | "submitting" | "success" | "error";

type SocialSignIn = (input: {
  callbackURL: string;
  provider: "google";
}) => Promise<unknown>;

/** Starts Google sign-in while preserving the deployment-bound invitation path. */
export async function signInForInvitation(
  publicToken: string,
  signIn: SocialSignIn = authClient.signIn.social,
): Promise<void> {
  await signIn({
    callbackURL: `/invite/${encodeURIComponent(publicToken)}`,
    provider: "google",
  });
}

/** Connects the PWA invitation card to Better Auth's same-origin session cookie. */
export function InvitationOnboarding({
  publicToken,
}: Readonly<{ publicToken: string }>) {
  const { data: session } = authClient.useSession();
  const [status, setStatus] = useState<InvitationStatus>("idle");

  /** Accepts the invitation through the browser's same-origin Better Auth cookie. */
  const accept = async () => {
    setStatus("submitting");
    try {
      const response = await fetch("/api/access/invitations/accept", {
        body: JSON.stringify({ token: publicToken }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Invitation acceptance failed.");
      }
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  /** Opens Google sign-in and returns to this invitation after authentication. */
  const signIn = async () => {
    setStatus("submitting");
    try {
      await signInForInvitation(publicToken);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return (
    <InvitationCard
      isSignedIn={session?.user !== undefined}
      onAccept={() => {
        void accept();
      }}
      signInControl={
        <button
          disabled={status === "submitting"}
          onClick={() => {
            void signIn();
          }}
          type="button"
        >
          {status === "submitting" ? "Opening Google…" : "Sign in with Google"}
        </button>
      }
      status={status}
    />
  );
}
