import { Suspense } from "react";

import { AdminPage } from "../../components/admin-page";

import { UsersAdminData } from "./users-admin-data";

/** Shows real users, their group roles, and Platform Admin status. Effective-permission overrides arrive in a future bundle. */
export default function UsersPermissionsPage() {
  return (
    <AdminPage
      actions={
        <button
          className="admin-primary-button"
          disabled
          title="Coming soon"
          type="button"
        >
          Add user to group
        </button>
      }
      description="Role permissions apply by default. Account-wide overrides arrive in a future bundle."
      eyebrow="Access control"
      title="Users & permissions"
    >
      <div className="admin-split">
        <Suspense fallback={<UsersAdminSkeleton />}>
          <UsersAdminData />
        </Suspense>
      </div>
    </AdminPage>
  );
}

function UsersAdminSkeleton() {
  return (
    <>
      <section className="admin-panel admin-list-panel">
        <p className="admin-empty">Loading users…</p>
        <div className="admin-user-list" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div className="admin-user-row" key={index}>
              <span className="member-avatar" />
              <div>
                <strong>·</strong>
                <p>·</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="admin-panel permission-panel">
        <p className="admin-empty">Loading details…</p>
      </section>
    </>
  );
}
