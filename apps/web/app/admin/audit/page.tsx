import { Search } from "lucide-react";

import { AdminPage } from "../../components/admin-page";

/** Shows permanent access and catalog events with enough context for support review. */
export default function AuditPage() {
  return (
    <AdminPage
      description="Audit events are permanent and identify who changed what and when."
      eyebrow="Permanent history"
      title="Audit log"
    >
      <section className="admin-panel">
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search aria-hidden="true" size={18} />
            <input
              aria-label="Search audit log"
              placeholder="Search actor, action, or target"
            />
          </label>
          <select aria-label="Audit event type" defaultValue="All events">
            <option>All events</option>
            <option>Access</option>
            <option>Catalog</option>
            <option>Groups</option>
          </select>
        </div>
        <div className="audit-list">
          <article>
            <time>Today · 3:42 PM</time>
            <div>
              <strong>Permission override changed</strong>
              <p>
                Platform Admin blocked Remove members for Mia Perez across all
                memberships.
              </p>
            </div>
            <span className="status-pill">Access</span>
          </article>
          <article>
            <time>Today · 2:18 PM</time>
            <div>
              <strong>Import draft validated</strong>
              <p>Fresh Bowls · Makati · 142 rows · 3 warnings.</p>
            </div>
            <span className="status-pill">Catalog</span>
          </article>
          <article>
            <time>Yesterday · 4:05 PM</time>
            <div>
              <strong>User added to group</strong>
              <p>Jordan Diaz joined Friends as Manager.</p>
            </div>
            <span className="status-pill">Groups</span>
          </article>
        </div>
      </section>
    </AdminPage>
  );
}
