import { Bell } from "lucide-react";
import type { ReactNode } from "react";

import { getCurrentServerPageIdentity } from "../../src/auth/load-server-page-identity";
import { MemberPageAccessView } from "../../src/features/access/page-access-view";
import { MemberNavigation } from "../components/member-navigation";
import { ProfileMenu } from "../components/profile-menu";

/** Provides the focused member/PWA shell without exposing admin-only information architecture. */
export default async function MemberLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const identityResult = await getCurrentServerPageIdentity();

  return (
    <MemberPageAccessView result={identityResult}>
      <div className="member-shell">
        <a className="skip-link" href="#member-content">
          Skip to content
        </a>
        <header className="member-header">
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
        <MemberNavigation />
      </div>
    </MemberPageAccessView>
  );
}
