import { Bell } from "lucide-react";
import type { ReactNode } from "react";

import { getCurrentServerPageIdentity } from "../../src/auth/load-server-page-identity";
import { MemberPageAccessView } from "../../src/features/access/page-access-view";
import { MemberNavigation } from "../components/member-navigation";
import {
  FloatingNewOrderButton,
  MemberBackButton,
} from "../components/member-shell-controls";
import { ProfileMenu } from "../components/profile-menu";

/** Provides the focused member/PWA shell without exposing admin-only information architecture. */
export default async function MemberLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
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
