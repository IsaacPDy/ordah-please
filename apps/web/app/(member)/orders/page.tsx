import { ChevronRight, Clock3, Store, Users } from "lucide-react";

/** Shows actionable current orders and immutable past participation with practical filters. */
export default function OrdersPage() {
  return (
    <div className="member-page">
      <header className="page-intro">
        <p className="eyebrow">Your activity</p>
        <h1>Orders</h1>
        <p>Respond to active orders and revisit the meals you joined.</p>
      </header>

      <form aria-label="Order filters" className="filter-grid">
        {["Group", "Restaurant", "Status", "Date"].map((label) => (
          <label key={label}>
            {label}
            <select defaultValue="All">
              <option>All</option>
            </select>
          </label>
        ))}
      </form>

      <section
        aria-labelledby="active-orders-heading"
        className="content-section"
      >
        <div className="section-heading-row">
          <h2 id="active-orders-heading">Active orders</h2>
          <span className="count-badge">2</span>
        </div>
        <article className="order-card order-card--urgent">
          <div className="order-card__icon">
            <Users aria-hidden="true" size={22} />
          </div>
          <div className="order-card__content">
            <span className="status-pill">Voting</span>
            <h3>Friday lunch</h3>
            <p>Friends · Choose a restaurant</p>
            <p className="deadline">
              <Clock3 aria-hidden="true" size={16} /> Due today at 11:30 AM
            </p>
          </div>
          <ChevronRight aria-hidden="true" size={22} />
        </article>
        <article className="order-card">
          <div className="order-card__icon">
            <Store aria-hidden="true" size={22} />
          </div>
          <div className="order-card__content">
            <span className="status-pill status-pill--soft">
              Food confirmation
            </span>
            <h3>Campaign dinner</h3>
            <p>Design team · Green Table</p>
            <p className="deadline">
              <Clock3 aria-hidden="true" size={16} /> Due tomorrow at 5:00 PM
            </p>
          </div>
          <ChevronRight aria-hidden="true" size={22} />
        </article>
      </section>

      <section aria-labelledby="history-heading" className="content-section">
        <div className="section-heading-row">
          <h2 id="history-heading">Order history</h2>
          <button className="text-button" type="button">
            View all
          </button>
        </div>
        <article className="history-card">
          <div>
            <span className="status-pill status-pill--complete">Ordered</span>
            <h3>Tuesday lunch</h3>
            <p>Green Table · Friends</p>
          </div>
          <strong>₱420.00</strong>
        </article>
        <article className="history-card">
          <div>
            <span className="status-pill status-pill--muted">Cancelled</span>
            <h3>Planning snacks</h3>
            <p>Fresh Bowls · Design team</p>
          </div>
          <strong>₱0.00</strong>
        </article>
      </section>
    </div>
  );
}
