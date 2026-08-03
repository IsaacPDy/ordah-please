export type PendingAdminRequestView = Readonly<{
  id: string;
  requesterDisplayName: string;
  groupName: string;
  submittedAt: string;
}>;

type AdminDecision = "approved" | "rejected";

type AdminDecisionViewProps = Readonly<{
  actionsDisabled: boolean;
  busyRequestId: string | null;
  message: string | null;
  onDecide: (requestId: string, decision: AdminDecision) => void;
  onReasonChange: (requestId: string, reason: string) => void;
  reasons: Readonly<Record<string, string>>;
  requests: readonly PendingAdminRequestView[];
}>;

const DECISIONS = [
  "approved",
  "rejected",
] as const satisfies readonly AdminDecision[];

const DECISION_LABELS: Readonly<Record<AdminDecision, string>> = {
  approved: "Approve",
  rejected: "Reject",
};

/** Renders the platform-admin decision list and the optional reason field per request. */
export function AdminDecisionView({
  actionsDisabled,
  busyRequestId,
  message,
  onDecide,
  onReasonChange,
  reasons,
  requests,
}: AdminDecisionViewProps) {
  if (requests.length === 0) {
    return <p>There are no pending platform-admin requests.</p>;
  }

  return (
    <section aria-labelledby="admin-decision-title" className="team-access">
      <header>
        <div>
          <h1 id="admin-decision-title">Pending platform-admin requests</h1>
          <p>Each decision is recorded with an immutable audit event.</p>
        </div>
      </header>
      <ul>
        {requests.map((request) => {
          const cardBusy = busyRequestId === request.id;
          const disabled = actionsDisabled || cardBusy;
          return (
            <li key={request.id}>
              <div>
                <strong>{request.requesterDisplayName}</strong>
                <span>{request.groupName}</span>
                <span>Submitted {request.submittedAt}</span>
              </div>
              <label>
                Reason (optional)
                <input
                  type="text"
                  maxLength={500}
                  onChange={(event) => {
                    onReasonChange(request.id, event.target.value);
                  }}
                  value={reasons[request.id] ?? ""}
                />
              </label>
              {DECISIONS.map((decision) => (
                <button
                  disabled={disabled}
                  key={decision}
                  onClick={() => {
                    onDecide(request.id, decision);
                  }}
                  type="button"
                >
                  {DECISION_LABELS[decision]}
                </button>
              ))}
            </li>
          );
        })}
      </ul>
      {message === null ? null : <p role="status">{message}</p>}
    </section>
  );
}
