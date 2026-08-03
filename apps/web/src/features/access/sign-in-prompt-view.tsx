export type SignInPromptStatus = "idle" | "submitting" | "error";

type SignInPromptViewProps = Readonly<{
  onSignIn: () => void;
  status: SignInPromptStatus;
}>;

/** Renders the platform-admin sign-in prompt shown to unauthenticated visitors. */
export function SignInPromptView({ onSignIn, status }: SignInPromptViewProps) {
  return (
    <div>
      <p>Sign in is required to review platform-admin requests.</p>
      <button
        disabled={status === "submitting"}
        onClick={onSignIn}
        type="button"
      >
        {status === "submitting" ? "Opening Google…" : "Sign in with Google"}
      </button>
      {status === "error" ? (
        <p role="alert">Google sign-in could not start. Try again.</p>
      ) : null}
    </div>
  );
}
