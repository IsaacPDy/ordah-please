import type { ReactNode } from "react";

import { getCurrentServerPageIdentity } from "../../src/auth/load-server-page-identity";
import { AdminPageAccessView } from "../../src/features/access/page-access-view";
import { AdminNavigation } from "../components/admin-navigation";

/** Provides a dense admin shell that remains structurally separate from the member experience. */
export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const identityResult = await getCurrentServerPageIdentity();

  return (
    <AdminPageAccessView result={identityResult}>
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
            <p className="admin-workspace-title">Admin workspace</p>
          </header>
          <main className="admin-content" id="admin-content">
            {children}
          </main>
        </div>
      </div>
    </AdminPageAccessView>
  );
}
