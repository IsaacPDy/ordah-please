import { FileCheck2, Upload } from "lucide-react";

import { AdminPage } from "../../components/admin-page";

/** Shows import drafts, row validation, and publication readiness without auto-publishing external data. */
export default function ImportsPage() {
  return (
    <AdminPage
      actions={
        <button className="admin-primary-button" type="button">
          <Upload aria-hidden="true" size={17} /> Upload JSON or CSV
        </button>
      }
      description="Every uploaded file stays a draft until validation and supervised publication are complete."
      eyebrow="Supervised data"
      title="Import drafts"
    >
      <section className="admin-panel">
        <div className="admin-table">
          <div className="admin-table__row admin-table__header">
            <span>Draft</span>
            <span>Restaurant</span>
            <span>Rows</span>
            <span>Validation</span>
            <span>Created</span>
          </div>
          <button className="admin-table__row" type="button">
            <strong>
              <FileCheck2 aria-hidden="true" size={18} /> fresh-bowls-aug03.csv
            </strong>
            <span>Fresh Bowls · Makati</span>
            <span>142</span>
            <span className="status-pill">3 warnings</span>
            <span>Today, 2:14 PM</span>
          </button>
          <button className="admin-table__row" type="button">
            <strong>
              <FileCheck2 aria-hidden="true" size={18} /> green-table-aug02.json
            </strong>
            <span>Green Table · BGC</span>
            <span>184</span>
            <span className="status-pill status-pill--complete">Valid</span>
            <span>Yesterday</span>
          </button>
        </div>
      </section>
    </AdminPage>
  );
}
