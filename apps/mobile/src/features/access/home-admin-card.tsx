import { designTokens } from "@ordah-please/ui";
import { ChevronRight } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

interface HomeAdminCardProps {
  isPlatformAdmin: boolean;
  onOpen: () => void;
  pendingCount: number;
}

/** Conditionally renders the platform-admin shortcut on the member Home screen. */
export function HomeAdminCard({
  isPlatformAdmin,
  onOpen,
  pendingCount,
}: HomeAdminCardProps) {
  if (!isPlatformAdmin) {
    return null;
  }

  const body =
    pendingCount === 0 ? "No pending requests" : `${pendingCount} pending`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => (pressed ? styles.cardPressed : styles.card)}
    >
      <View style={styles.row}>
        <View style={styles.textColumn}>
          <Text style={styles.title}>Platform-admin requests</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        <ChevronRight
          accessibilityElementsHidden
          color={designTokens.colors.primaryStrong}
          size={24}
          strokeWidth={2}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    fontSize: designTokens.typography.size.body,
  },
  card: {
    backgroundColor: designTokens.colors.supportSurface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    gap: designTokens.spacing.sm,
    marginBottom: designTokens.spacing.md,
    minHeight: designTokens.touchTarget.minimum,
    padding: designTokens.spacing.lg,
  },
  cardPressed: {
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    gap: designTokens.spacing.sm,
    marginBottom: designTokens.spacing.md,
    minHeight: designTokens.touchTarget.minimum,
    padding: designTokens.spacing.lg,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: designTokens.spacing.md,
  },
  textColumn: {
    flex: 1,
    gap: designTokens.spacing.xs,
  },
  title: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
  },
});
