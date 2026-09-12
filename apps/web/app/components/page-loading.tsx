/** Shows stable card shapes while a member route finishes protected reads. */
export function MemberPageLoading() {
  return (
    <div className="member-page page-loading" role="status">
      <span className="sr-only">Loading page…</span>
      <div className="loading-line loading-line--title" />
      <div className="loading-line" />
      {[0, 1, 2].map((index) => (
        <div className="loading-card" data-testid="loading-card" key={index} />
      ))}
    </div>
  );
}

/** Shows a stable workspace shape while an admin route finishes protected reads. */
export function AdminPageLoading() {
  return (
    <div className="admin-page page-loading" role="status">
      <span className="sr-only">Loading page…</span>
      <div className="loading-line loading-line--title" />
      <div className="loading-line" />
      <div className="loading-table" data-testid="loading-table">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}

/** Shows a neutral route fallback before a specific member or admin shell exists. */
export function AppPageLoading() {
  return (
    <main className="page-loading route-loading" role="status">
      <span className="sr-only">Loading page…</span>
      <span className="brand">ordah please</span>
      <div className="loading-line loading-line--title" />
      <div className="loading-card" />
    </main>
  );
}
