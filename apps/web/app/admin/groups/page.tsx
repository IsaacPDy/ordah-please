import { Search, Users } from "lucide-react";

import { AdminPage } from "../../components/admin-page";

/** Lets the platform admin inspect, create, suspend, and open every group without deleting history. */
export default function AdminGroupsPage() {
  return (
    <AdminPage
      actions={
        <button className="admin-primary-button" type="button">
          Create group
        </button>
      }
      description="Inspect membership and orders, or suspend a group without destroying its history."
      eyebrow="Membership"
      title="Groups"
    >
      <section className="admin-panel">
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search aria-hidden="true" size={18} />
            <input
              aria-label="Search groups"
              placeholder="Search group or owner"
            />
          </label>
          <select aria-label="Group status" defaultValue="Active">
            <option>Active</option>
            <option>Suspended</option>
            <option>Archived</option>
          </select>
        </div>
        <div className="admin-table">
          <div className="admin-table__row admin-table__header">
            <span>Group</span>
            <span>Owner</span>
            <span>Members</span>
            <span>Active orders</span>
            <span>Status</span>
          </div>
          <button className="admin-table__row" type="button">
            <strong>
              <Users aria-hidden="true" size={18} /> Friends
            </strong>
            <span>Mia Perez</span>
            <span>7</span>
            <span>1</span>
            <span className="status-pill">Active</span>
          </button>
          <button className="admin-table__row" type="button">
            <strong>
              <Users aria-hidden="true" size={18} /> Design team
            </strong>
            <span>Paolo Reyes</span>
            <span>12</span>
            <span>1</span>
            <span className="status-pill">Active</span>
          </button>
          <button className="admin-table__row" type="button">
            <strong>
              <Users aria-hidden="true" size={18} /> Operations
            </strong>
            <span>Lea Santos</span>
            <span>9</span>
            <span>0</span>
            <span className="status-pill status-pill--muted">Suspended</span>
          </button>
        </div>
      </section>
    </AdminPage>
  );
}
