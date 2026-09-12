import { Bell } from "lucide-react";
import { Suspense, type ReactNode } from "react";

import { getCurrentServerPageIdentity } from "../../src/auth/load-server-page-identity";
import { MemberPageAccessView } from "../../src/features/access/page-access-view";
import { MemberNavigation } from "../components/member-navigation";
import {
  FloatingNewOrderButton,
  MemberBackButton,
} from "../components/member-shell-controls";
import { ProfileMenu } from "../components/profile-menu";

/** Provides the focused member/PWA shell without exposing admin-only information architecture. */
export default function MemberLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <Suspense fallback={<MemberShellAccessLoading />}>
      <AuthenticatedMemberShell>{children}</AuthenticatedMemberShell>
    </Suspense>
  );
}

/** Loads private identity before it is allowed to receive protected member content. */
async function AuthenticatedMemberShell({ children }: { children: ReactNode }) {
  const identityResult = await getCurrentServerPageIdentity();
  const canStartOrder =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.some(
      (membership) =>
        membership.role === "group-owner" || membership.role === "manager",
    );

  return (
    <MemberPageAccessView result={identityResult}>
      <div className="member-shell member-shell--compact">
        <a className="skip-link" href="#member-content">
          Skip to content
        </a>
        <header className="member-header">
          <MemberBackButton />
          <span className="brand">ordah please</span>
          <div className="member-header__actions">
            <button
              aria-label="Open notifications"
              className="icon-button"
              type="button"
            >
              <Bell aria-hidden="true" size={24} strokeWidth={2.2} />
              <span aria-hidden="true" className="notification-dot" />
            </button>
            {identityResult.status === "authenticated" ? (
              <ProfileMenu
                displayName={identityResult.identity.displayName}
                email={identityResult.identity.email}
                imageUrl={identityResult.identity.imageUrl}
              />
            ) : null}
          </div>
        </header>
        <main className="member-content" id="member-content">
          {children}
        </main>
        <FloatingNewOrderButton visible={canStartOrder} />
        <MemberNavigation />
      </div>
    </MemberPageAccessView>
  );
}

/** Shows the stable public member frame without rendering protected children. */
export function MemberShellAccessLoading() {
  return (
    <div className="member-shell member-shell--compact">
      <header className="member-header">
        <span className="brand">ordah please</span>
        <span role="status">Checking your access…</span>
      </header>
      <main className="member-content" />
      <MemberNavigation />
    </div>
  );
}
