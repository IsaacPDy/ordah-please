import type { ReactNode } from "react";

import type { ServerPageIdentityResult } from "../../auth/load-server-page-identity";
import { SignInPrompt } from "./sign-in-prompt";

type PageAccessViewProps = Readonly<{
  children: ReactNode;
  result: ServerPageIdentityResult;
}>;

/** Renders the complete member shell only after a live account identity is available. */
export function MemberPageAccessView({
  children,
  result,
}: PageAccessViewProps) {
  if (result.status === "unauthenticated") {
    return <SignInPrompt callbackURL="/" purpose="member" />;
  }
  if (result.status === "unavailable") {
    return <p>Your account is not available.</p>;
  }
  return children;
}

/** Renders the complete admin shell only for an authenticated Platform Admin. */
export function AdminPageAccessView({ children, result }: PageAccessViewProps) {
  if (result.status === "unauthenticated") {
    return <SignInPrompt callbackURL="/admin" purpose="admin" />;
  }
  if (result.status === "unavailable") {
    return <p>Your account is not available.</p>;
  }
  if (!result.identity.isPlatformAdmin) {
    return <p>Only platform admins can open the admin workspace.</p>;
  }
  return children;
}
