import { LogOut } from "lucide-react-native";
import { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { designTokens } from "@ordah-please/ui";

import { useMobileSignOut } from "../features/access/mobile-member-gate";

type ProfileMenuStatus = "idle" | "signing-out" | "error";

type ProfileMenuProps = Readonly<{
  displayName: string;
  email: string;
  imageUrl: string | null;
  signOut?: () => Promise<void> | void;
}>;

const FALLBACK_NAME = "Your account";

/** Picks the uppercase first letter of a display name, or `?` when none is available. */
function getInitial(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "?";
  }
  return trimmed.charAt(0).toUpperCase();
}

/** Renders the user's avatar with a dropdown profile panel and sign-out action. */
export function ProfileMenu({
  displayName,
  email,
  imageUrl,
  signOut,
}: ProfileMenuProps) {
  const gateSignOut = useMobileSignOut();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ProfileMenuStatus>("idle");

  async function handleSignOut() {
    setStatus("signing-out");
    try {
      const action = signOut ?? gateSignOut;
      await action();
      setOpen(false);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  const resolvedName =
    displayName.trim().length > 0 ? displayName : FALLBACK_NAME;
  const accessibilityLabel =
    email.length > 0
      ? `Open profile menu for ${resolvedName} (${email})`
      : `Open profile menu for ${resolvedName}`;
  const showImage = typeof imageUrl === "string" && imageUrl.length > 0;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={() => setOpen((value) => !value)}
        style={styles.avatarButton}
      >
        {showImage ? (
          <Image
            accessibilityLabel="Profile picture"
            source={{ uri: imageUrl }}
            style={styles.avatar}
          />
        ) : (
          <View
            accessibilityLabel="Profile picture placeholder"
            style={styles.initials}
          >
            <Text style={styles.initialsText}>
              {getInitial(displayName)}
            </Text>
          </View>
        )}
      </Pressable>
      {open ? (
        <>
          <Pressable
            accessibilityLabel="Close profile menu"
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <View style={styles.panel}>
            <View style={styles.identity}>
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                style={styles.name}
              >
                {resolvedName}
              </Text>
              {email.length > 0 ? (
                <Text
                  accessibilityLabel={email}
                  numberOfLines={1}
                  style={styles.email}
                >
                  {email}
                </Text>
              ) : null}
            </View>
            <View style={styles.divider} />
            {status === "error" ? (
              <View style={styles.errorRow}>
                <Text style={styles.errorText} accessibilityRole="alert">
                  Could not sign out.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Try signing out again"
                  onPress={() => {
                    void handleSignOut();
                  }}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                accessibilityState={{ disabled: status === "signing-out" }}
                disabled={status === "signing-out"}
                onPress={() => {
                  void handleSignOut();
                }}
                style={[
                  styles.signOutButton,
                  status === "signing-out" ? styles.signOutButtonDisabled : null,
                ]}
              >
                <LogOut
                  color={designTokens.colors.textPrimary}
                  size={18}
                />
                <Text style={styles.signOutText}>
                  {status === "signing-out" ? "Signing out…" : "Sign out"}
                </Text>
              </Pressable>
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

const AVATAR_SIZE = designTokens.touchTarget.minimum;

const styles = StyleSheet.create({
  avatar: {
    borderRadius: AVATAR_SIZE,
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
  },
  avatarButton: {
    borderRadius: AVATAR_SIZE,
    borderWidth: 2,
    borderColor: designTokens.colors.supportSurface,
    height: AVATAR_SIZE,
    overflow: "hidden",
    width: AVATAR_SIZE,
  },
  backdrop: {
    bottom: 0,
    height: 1,
    left: 0,
    opacity: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: 1,
  },
  container: {
    position: "relative",
  },
  divider: {
    backgroundColor: designTokens.colors.border,
    height: 1,
    marginVertical: designTokens.spacing.xs,
  },
  email: {
    color: designTokens.colors.textSecondary,
    fontFamily: designTokens.typography.family,
    fontSize: designTokens.typography.size.caption,
  },
  errorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: designTokens.spacing.xs,
    justifyContent: "space-between",
    paddingHorizontal: designTokens.spacing.xs,
  },
  errorText: {
    color: designTokens.colors.error,
    fontFamily: designTokens.typography.family,
    fontSize: designTokens.typography.size.caption,
  },
  identity: {
    gap: designTokens.spacing.xxs,
    paddingHorizontal: designTokens.spacing.xs,
  },
  initials: {
    alignItems: "center",
    backgroundColor: designTokens.colors.supportSurface,
    borderRadius: AVATAR_SIZE,
    height: AVATAR_SIZE,
    justifyContent: "center",
    width: AVATAR_SIZE,
  },
  initialsText: {
    color: designTokens.colors.primaryStrong,
    fontFamily: designTokens.typography.family,
    fontSize: designTokens.typography.size.title,
    fontWeight: "700",
  },
  name: {
    color: designTokens.colors.textPrimary,
    fontFamily: designTokens.typography.family,
    fontSize: designTokens.typography.size.body,
    fontWeight: "700",
  },
  panel: {
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    elevation: 3,
    gap: designTokens.spacing.xs,
    minWidth: 240,
    padding: designTokens.spacing.sm,
    position: "absolute",
    right: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    top: AVATAR_SIZE + designTokens.spacing.xs,
    zIndex: 20,
  },
  retryButton: {
    paddingHorizontal: designTokens.spacing.xs,
    paddingVertical: designTokens.spacing.xxs,
  },
  retryText: {
    color: designTokens.colors.primaryStrong,
    fontFamily: designTokens.typography.family,
    fontSize: designTokens.typography.size.caption,
    fontWeight: "700",
  },
  signOutButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: designTokens.spacing.xs,
    paddingHorizontal: designTokens.spacing.xs,
    paddingVertical: designTokens.spacing.sm,
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutText: {
    color: designTokens.colors.textPrimary,
    fontFamily: designTokens.typography.family,
    fontSize: designTokens.typography.size.body,
    fontWeight: "600",
  },
});
