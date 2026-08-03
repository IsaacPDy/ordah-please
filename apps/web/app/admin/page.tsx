import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Store,
  Users,
} from "lucide-react";

import { AdminPage } from "../components/admin-page";

/** Summarizes the decisions, coverage, and failures requiring platform-admin attention. */
export default function AdminHomePage() {
  return (
    <AdminPage
      description="Review platform health and open the work that needs a decision."
      eyebrow="Today"
      title="Admin overview"
    >
      <section aria-label="Platform metrics" className="metric-grid">
        <article className="metric-card">
          <span>
            <Clock3 aria-hidden="true" />
          </span>
          <div>
            <p>Pending decisions</p>
            <strong>3</strong>
            <small>2 access · 1 import</small>
          </div>
        </article>
        <article className="metric-card">
          <span>
            <Store aria-hidden="true" />
          </span>
          <div>
            <p>Catalog coverage</p>
            <strong>18</strong>
            <small>restaurants · 26 branches</small>
          </div>
        </article>
        <article className="metric-card metric-card--warning">
          <span>
            <AlertTriangle aria-hidden="true" />
          </span>
          <div>
            <p>Refresh failures</p>
            <strong>2</strong>
            <small>need supervised review</small>
          </div>
        </article>
        <article className="metric-card">
          <span>
            <Users aria-hidden="true" />
          </span>
          <div>
            <p>Active groups</p>
            <strong>12</strong>
            <small>86 total members</small>
          </div>
        </article>
      </section>
      <section className="admin-panel">
        <div className="admin-panel__heading">
          <div>
            <h2>Priority work</h2>
            <p>Oldest and highest-impact items appear first.</p>
          </div>
          <button className="secondary-action" type="button">
            Open all <ArrowUpRight aria-hidden="true" size={17} />
          </button>
        </div>
        <div className="admin-work-list">
          <article>
            <span className="admin-work-icon admin-work-icon--warning">
              <AlertTriangle aria-hidden="true" />
            </span>
            <div>
              <strong>Green Table · BGC refresh failed</strong>
              <p>Published menu remains available · failed 2 hours ago</p>
            </div>
            <span className="status-pill">Review</span>
          </article>
          <article>
            <span className="admin-work-icon">
              <Clock3 aria-hidden="true" />
            </span>
            <div>
              <strong>2 platform-admin requests</strong>
              <p>Oldest request has waited 1 day</p>
            </div>
            <span className="status-pill">Decide</span>
          </article>
          <article>
            <span className="admin-work-icon">
              <CheckCircle2 aria-hidden="true" />
            </span>
            <div>
              <strong>Fresh Bowls import ready</strong>
              <p>142 valid rows · 3 warnings</p>
            </div>
            <span className="status-pill">Publish</span>
          </article>
        </div>
      </section>
    </AdminPage>
  );
}
