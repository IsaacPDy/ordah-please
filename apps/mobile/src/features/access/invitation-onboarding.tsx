import { Button, Card, Text } from "react-native-paper";

type InvitationStatus = "idle" | "submitting" | "success" | "error";

type InvitationOnboardingProps = Readonly<{
  isSignedIn: boolean;
  onAccept: () => void;
  onSignIn: () => void;
  status: InvitationStatus;
}>;

/** Renders the native invitation gate so Google sign-in always precedes group acceptance. */
export function InvitationOnboarding({
  isSignedIn,
  onAccept,
  onSignIn,
  status,
}: InvitationOnboardingProps) {
  return (
    <Card accessibilityRole="summary" mode="outlined">
      <Card.Content>
        <Text variant="headlineSmall">Private group invitation</Text>
        {!isSignedIn ? (
          <>
            <Text variant="bodyMedium">Sign in with Google to continue</Text>
            <Button mode="contained" onPress={onSignIn}>
              Sign in with Google
            </Button>
          </>
        ) : (
          <>
            <Text variant="bodyMedium">
              Joining the group does not add you to any food order. An organizer
              chooses order participants separately.
            </Text>
            <Button
              disabled={status === "success"}
              loading={status === "submitting"}
              mode="contained"
              onPress={onAccept}
            >
              {status === "success" ? "Group joined" : "Join group"}
            </Button>
          </>
        )}
        {status === "error" ? (
          <Text accessibilityRole="alert">
            Sign-in or invitation acceptance failed.
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}
