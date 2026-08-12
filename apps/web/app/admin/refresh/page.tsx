import { AlertTriangle, RefreshCw } from "lucide-react";

import { AdminPage } from "../../components/admin-page";

/** Prioritizes weekly supervised refresh work while preserving the last approved menu on failure. */
export default function RefreshPage() {
  return (
    <AdminPage
      description="Refreshes are supervised. A failure never erases the last published menu."
      eyebrow="Catalog freshness"
      title="Weekly refresh queue"
    >
      <section className="admin-panel">
        <div className="admin-work-list">
          <article>
            <span className="admin-work-icon admin-work-icon--warning">
              <AlertTriangle aria-hidden="true" />
            </span>
            <div>
              <strong>Restaurant awaiting review</strong>
              <p>Failed today · last approved menu is still live</p>
            </div>
            <button className="secondary-action" type="button">
              Review failure
            </button>
          </article>
          <article>
            <span className="admin-work-icon">
              <RefreshCw aria-hidden="true" />
            </span>
            <div>
              <strong>Restaurant due tomorrow</strong>
              <p>Due tomorrow · 29 published items</p>
            </div>
            <button className="secondary-action" type="button">
              Start review
            </button>
          </article>
          <article>
            <span className="admin-work-icon">
              <RefreshCw aria-hidden="true" />
            </span>
            <div>
              <strong>Restaurant due in 5 days</strong>
              <p>Due in 5 days · last reviewed yesterday</p>
            </div>
            <button className="secondary-action" type="button">
              Open
            </button>
          </article>
        </div>
      </section>
    </AdminPage>
  );
}
