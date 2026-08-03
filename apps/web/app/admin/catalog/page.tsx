import { Search } from "lucide-react";

import { AdminPage } from "../../components/admin-page";

/** Shows published restaurant branches, freshness, and pause state in one operational table. */
export default function CatalogPage() {
  return (
    <AdminPage
      actions={
        <button className="admin-primary-button" type="button">
          Add restaurant
        </button>
      }
      description="Published restaurants remain browseable while stale or failed refreshes are reviewed."
      eyebrow="Restaurant data"
      title="Published restaurants"
    >
      <section className="admin-panel">
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search aria-hidden="true" size={18} />
            <input
              aria-label="Search catalog"
              placeholder="Search restaurant or branch"
            />
          </label>
          <select aria-label="Catalog status" defaultValue="All statuses">
            <option>All statuses</option>
            <option>Published</option>
            <option>Paused</option>
            <option>Stale</option>
          </select>
        </div>
        <div className="admin-table admin-table--catalog">
          <div className="admin-table__row admin-table__header">
            <span>Restaurant branch</span>
            <span>Menu items</span>
            <span>Last reviewed</span>
            <span>Refresh</span>
            <span>Status</span>
          </div>
          {[
            ["Green Table · BGC", "48", "Today", "Failed", "Published"],
            [
              "Fresh Bowls · Makati",
              "36",
              "Yesterday",
              "Due in 5 days",
              "Published",
            ],
            [
              "Crispy Chicken · BGC",
              "29",
              "6 days ago",
              "Due tomorrow",
              "Paused",
            ],
          ].map(([name, items, reviewed, refresh, status]) => (
            <button className="admin-table__row" key={name} type="button">
              <strong>{name}</strong>
              <span>{items}</span>
              <span>{reviewed}</span>
              <span>{refresh}</span>
              <span
                className={
                  status === "Paused"
                    ? "status-pill status-pill--muted"
                    : "status-pill"
                }
              >
                {status}
              </span>
            </button>
          ))}
        </div>
      </section>
    </AdminPage>
  );
}
