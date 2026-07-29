export type GroupMemberView = Readonly<{
  displayName: string;
  role: "owner" | "organizer" | "member";
  userId: string;
}>;

type TeamAccessViewProps = Readonly<{
  members: readonly GroupMemberView[];
  onAction: (action: "promote" | "demote" | "remove", userId: string) => void;
  onIssueInvitation?: () => void;
  onRequestAdmin: () => void;
}>;

const ROLE_LABELS = {
  member: "Member",
  organizer: "Organizer",
  owner: "Owner",
} as const;

/** Renders exact group roles and only the owner actions valid for each active member. */
export function TeamAccessView({
  members,
  onAction,
  onIssueInvitation,
  onRequestAdmin,
}: TeamAccessViewProps) {
  return (
    <section aria-labelledby="team-access-title" className="team-access">
      <header>
        <div>
          <h1 id="team-access-title">Team</h1>
          <p>Group membership is separate from each order participant list.</p>
        </div>
        <button onClick={onIssueInvitation} type="button">
          Create invitation link
        </button>
      </header>
      <ul>
        {members.map((member) => (
          <li key={member.userId}>
            <div>
              <strong>{member.displayName}</strong>
              <span>{ROLE_LABELS[member.role]}</span>
            </div>
            {member.role === "member" ? (
              <button
                onClick={() => {
                  onAction("promote", member.userId);
                }}
                type="button"
              >
                Promote organizer
              </button>
            ) : null}
            {member.role === "organizer" ? (
              <button
                onClick={() => {
                  onAction("demote", member.userId);
                }}
                type="button"
              >
                Demote to member
              </button>
            ) : null}
            {member.role !== "owner" ? (
              <button
                onClick={() => {
                  onAction("remove", member.userId);
                }}
                type="button"
              >
                Remove member
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <button onClick={onRequestAdmin} type="button">
        Request platform-admin access
      </button>
    </section>
  );
}
