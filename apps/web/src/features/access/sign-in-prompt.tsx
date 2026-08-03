"use client";

import { useState } from "react";

import { authClient } from "../../auth/auth-client";
import {
  SignInPromptView,
  type SignInPromptStatus,
} from "./sign-in-prompt-view";

type SocialSignIn = (input: {
  callbackURL: string;
  provider: "google";
}) => Promise<unknown>;

type SignInPromptProps = Readonly<{
  callbackURL: string;
  purpose?: "admin" | "member";
  signIn?: SocialSignIn;
}>;

/** Connects a protected-surface sign-in prompt to Better Auth Google sign-in. */
export function SignInPrompt({
  callbackURL,
  purpose = "admin",
  signIn = authClient.signIn.social,
}: SignInPromptProps) {
  const [status, setStatus] = useState<SignInPromptStatus>("idle");

  const start = async () => {
    setStatus("submitting");
    try {
      await signIn({ callbackURL, provider: "google" });
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  };

  return (
    <SignInPromptView
      onSignIn={() => {
        void start();
      }}
      purpose={purpose}
      status={status}
    />
  );
}
