import { Search, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { AdminPage } from "../../components/admin-page";

/** Shows account roles, group memberships, and effective permissions before an override is saved. */
export default function UsersPermissionsPage() {
  return (
    <AdminPage
      actions={
        <button className="admin-primary-button" type="button">
          Add user to group
        </button>
      }
      description="Role permissions apply by default. Account-wide overrides change only the individual actions selected here."
      eyebrow="Access control"
      title="Users & permissions"
    >
      <div className="admin-split">
        <section className="admin-panel admin-list-panel">
          <label className="admin-search">
            <Search aria-hidden="true" size={18} />
            <input
              aria-label="Search users"
              placeholder="Search name or email"
            />
          </label>
          <div className="admin-user-list">
            <button
              className="admin-user-row admin-user-row--active"
              type="button"
            >
              <span className="member-avatar">MP</span>
              <div>
                <strong>Mia Perez</strong>
                <p>mia@example.com · 2 groups</p>
              </div>
              <ShieldCheck aria-hidden="true" size={18} />
            </button>
            <button className="admin-user-row" type="button">
              <span className="member-avatar member-avatar--alt">JD</span>
              <div>
                <strong>Jordan Diaz</strong>
                <p>jordan@example.com · 1 group</p>
              </div>
            </button>
            <button className="admin-user-row" type="button">
              <span className="member-avatar member-avatar--soft">AK</span>
              <div>
                <strong>Alex Kim</strong>
                <p>alex@example.com · 2 groups</p>
              </div>
            </button>
          </div>
        </section>
        <section className="admin-panel permission-panel">
          <div className="permission-panel__identity">
            <span className="member-avatar">MP</span>
            <div>
              <h2>Mia Perez</h2>
              <p>App active · Google account</p>
            </div>
            <button className="secondary-action" type="button">
              Suspend account
            </button>
          </div>
          <div className="permission-groups">
            <h3>Group roles</h3>
            <div>
              <span>Friends</span>
              <strong>Group Owner</strong>
            </div>
            <div>
              <span>Design team</span>
              <strong>Member</strong>
            </div>
          </div>
          <div className="permission-heading">
            <div>
              <h3>Effective permissions</h3>
              <p>
                Role permissions and account-wide overrides are shown
                separately.
              </p>
            </div>
            <SlidersHorizontal aria-hidden="true" />
          </div>
          <div className="permission-table">
            <div className="permission-table__header">
              <span>Action</span>
              <span>Role default</span>
              <span>Override</span>
              <span>Effective</span>
            </div>
            {[
              ["Invite users", "Allowed", "Default", "Allowed"],
              ["Remove members", "Allowed", "Blocked", "Blocked"],
              ["Create orders", "Allowed", "Default", "Allowed"],
              ["Upload own receipt", "Order setting", "Allowed", "Allowed"],
            ].map(([action, role, override, effective]) => (
              <div className="permission-table__row" key={action}>
                <strong>{action}</strong>
                <span>{role}</span>
                <button
                  className={
                    override === "Blocked"
                      ? "override-chip override-chip--blocked"
                      : "override-chip"
                  }
                  type="button"
                >
                  {override}
                </button>
                <span
                  className={
                    effective === "Blocked"
                      ? "effective effective--blocked"
                      : "effective"
                  }
                >
                  {effective}
                </span>
              </div>
            ))}
          </div>
          <div className="permission-save">
            <p>Saving creates a permanent audit event. A reason is optional.</p>
            <button className="admin-primary-button" type="button">
              Save override
            </button>
          </div>
        </section>
      </div>
    </AdminPage>
  );
}
