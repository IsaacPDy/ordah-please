import type { ReactNode } from "react";

export interface MemberAccessStateProps {
  readonly children: ReactNode;
  readonly hasMemberships: boolean;
  readonly surface: "home" | "orders" | "favorites" | "groups";
}

/** Keeps account-owned surfaces available while replacing group-only content for groupless users. */
export function MemberAccessState({
  children,
  hasMemberships,
  surface,
}: MemberAccessStateProps) {
  if (hasMemberships || surface === "home" || surface === "favorites") {
    return children;
  }

  if (surface === "orders") {
    return (
      <div className="member-page">
        <header className="page-intro">
          <p className="eyebrow">Your activity</p>
          <h1>Orders</h1>
          <p>No group orders yet.</p>
        </header>
        <section className="empty-page" aria-label="No group orders">
          <h2>No group orders yet</h2>
          <p>Join a group before participating in a shared food order.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="member-page">
      <header className="page-intro">
        <p className="eyebrow">Your memberships</p>
        <h1>Groups</h1>
        <p>You have not joined a group yet.</p>
      </header>
      <section className="empty-page" aria-label="No group memberships">
        <h2>You have not joined a group yet</h2>
        <p>Open a valid private invitation link to join your first group.</p>
      </section>
    </div>
  );
}
