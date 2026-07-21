import type { ReactNode } from "react";

import { AdminNavigation } from "../components/admin-navigation";

/** Provides a dense admin shell that remains structurally separate from the member experience. */
export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-content">
        Skip to content
      </a>
      <aside className="admin-sidebar">
        <span className="brand">ordah please</span>
        <AdminNavigation />
      </aside>
      <div className="admin-workspace">
        <header className="admin-header">
          <h1>Admin workspace</h1>
        </header>
        <main className="admin-content" id="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
