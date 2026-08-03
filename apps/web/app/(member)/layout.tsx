import Image from "next/image";
import { Bell } from "lucide-react";
import type { ReactNode } from "react";

import { getCurrentServerPageIdentity } from "../../src/auth/load-server-page-identity";
import { MemberPageAccessView } from "../../src/features/access/page-access-view";
import { MemberNavigation } from "../components/member-navigation";

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
            <Image
              alt="Mia's profile"
              className="profile-avatar"
              height={44}
              priority
              src="/images/profile-mia.jpg"
              width={44}
            />
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
