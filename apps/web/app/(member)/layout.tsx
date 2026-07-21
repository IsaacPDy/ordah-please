import type { ReactNode } from "react";

import { MemberNavigation } from "../components/member-navigation";

/** Provides the focused member/PWA shell without exposing admin-only information architecture. */
export default function MemberLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="member-shell">
      <a className="skip-link" href="#member-content">
        Skip to content
      </a>
      <header className="member-header">
        <span className="brand">ordah please</span>
      </header>
      <main className="member-content" id="member-content">
        {children}
      </main>
      <MemberNavigation />
    </div>
  );
}
