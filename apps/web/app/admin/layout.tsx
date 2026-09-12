import { Suspense, type ReactNode } from "react";

import { getCurrentServerPageIdentity } from "../../src/auth/load-server-page-identity";
import { AdminPageAccessView } from "../../src/features/access/page-access-view";
import { AdminNavigation } from "../components/admin-navigation";
import { ProfileMenu } from "../components/profile-menu";

/** Provides a dense admin shell that remains structurally separate from the member experience. */
export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <Suspense fallback={<AdminShellAccessLoading />}>
      <AuthenticatedAdminShell>{children}</AuthenticatedAdminShell>
    </Suspense>
  );
}

/** Loads private identity before it is allowed to receive protected admin content. */
async function AuthenticatedAdminShell({ children }: { children: ReactNode }) {
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
            <div className="admin-header__profile">
              {identityResult.status === "authenticated" ? (
                <ProfileMenu
                  displayName={identityResult.identity.displayName}
                  email={identityResult.identity.email}
                  imageUrl={identityResult.identity.imageUrl}
                />
              ) : null}
            </div>
          </header>
          <main className="admin-content" id="admin-content">
            {children}
          </main>
        </div>
      </div>
    </AdminPageAccessView>
  );
}

/** Shows the stable public admin frame without rendering protected children. */
export function AdminShellAccessLoading() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <span className="brand">ordah please</span>
        <AdminNavigation />
      </aside>
      <div className="admin-workspace">
        <header className="admin-header">
          <p className="admin-workspace-title">Admin workspace</p>
        </header>
        <main className="admin-content" role="status">
          Checking your access…
        </main>
      </div>
    </div>
  );
}
