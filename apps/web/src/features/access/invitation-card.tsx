import type { ReactNode } from "react";

type InvitationStatus = "idle" | "submitting" | "success" | "error";

type InvitationCardProps = Readonly<{
  isSignedIn: boolean;
  onAccept?: () => void;
  signInControl?: ReactNode;
  status: InvitationStatus;
}>;

/** Renders the PWA invitation gate so Google sign-in always precedes group acceptance. */
export function InvitationCard({
  isSignedIn,
  onAccept,
  signInControl,
  status,
}: InvitationCardProps) {
  return (
    <section aria-labelledby="invitation-title" className="access-card">
      <h1 id="invitation-title">Private group invitation</h1>
      {!isSignedIn ? (
        <>
          <p>Sign in with Google to continue</p>
          {signInControl ?? <button type="button">Sign in with Google</button>}
        </>
      ) : (
        <>
          <p>
            Joining the group does not add you to any food order. A Manager or
            Group Owner chooses order participants separately.
          </p>
          <button
            disabled={status === "submitting" || status === "success"}
            onClick={onAccept}
            type="button"
          >
            {status === "submitting"
              ? "Joining…"
              : status === "success"
                ? "Group joined"
                : "Join group"}
          </button>
        </>
      )}
      {status === "error" ? (
        <p role="alert">Sign-in or invitation acceptance failed.</p>
      ) : null}
    </section>
  );
}
