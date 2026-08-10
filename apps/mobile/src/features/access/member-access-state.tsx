import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Surface, Text } from "react-native-paper";

import type { AppIdentitySummary } from "@ordah-please/contracts";
import { designTokens } from "@ordah-please/ui";

import { MemberPage } from "../../components/member-page";

type MobileMemberSurface = "home" | "orders" | "favorites" | "groups";

type MobileMemberAccessStateProps = Readonly<{
  children: ReactNode;
  identity: AppIdentitySummary;
  surface: MobileMemberSurface;
  onSelectGroup?: (groupId: string) => void;
}>;

const ROLE_LABELS = {
  "group-owner": "Group Owner",
  manager: "Manager",
  member: "Member",
} as const;

/** Renders real membership roles or an honest group-dependent empty state on native screens. */
export function MobileMemberAccessState({
  children,
  identity,
  surface,
  onSelectGroup,
}: MobileMemberAccessStateProps) {
  if (surface === "home" || surface === "favorites") {
    return children;
  }
  if (surface === "groups" && identity.memberships.length > 0) {
    return (
      <MemberPage title="Your groups">
        <Text style={styles.description}>
          You can belong to multiple groups and hold a different role in each.
        </Text>
        {identity.memberships.map((membership) => {
          const card = (
            <Surface
              elevation={0}
              key={membership.groupId}
              style={[
                styles.membershipCard,
                onSelectGroup !== undefined
                  ? styles.membershipCardTappable
                  : null,
              ]}
            >
              <View style={styles.membershipBody}>
                <Text style={styles.groupId}>{membership.groupId}</Text>
                <Text style={styles.description}>
                  Private group membership
                </Text>
              </View>
              <Text style={styles.role}>{ROLE_LABELS[membership.role]}</Text>
            </Surface>
          );
          if (onSelectGroup === undefined) {
            return card;
          }
          return (
            <Text
              accessibilityRole="button"
              key={membership.groupId}
              onPress={() => onSelectGroup(membership.groupId)}
              style={styles.membershipCardWrapper}
            >
              {card}
            </Text>
          );
        })}
      </MemberPage>
    );
  }
  if (identity.memberships.length > 0) {
    return children;
  }

  const isOrders = surface === "orders";
  return (
    <MemberPage title={isOrders ? "Orders" : "Groups"}>
      <Surface elevation={0} style={styles.emptyCard}>
        <Text accessibilityRole="header" style={styles.emptyTitle}>
          {isOrders ? "No group orders yet" : "You have not joined a group yet"}
        </Text>
        <Text style={styles.description}>
          {isOrders
            ? "Join a group before participating in a shared food order."
            : "Open a valid private invitation link to join your first group."}
        </Text>
      </Surface>
    </MemberPage>
  );
}

const styles = StyleSheet.create({
  description: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    lineHeight: 24,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: designTokens.colors.supportSurface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.majorCard,
    borderWidth: 1,
    gap: designTokens.spacing.sm,
    padding: designTokens.spacing.xl,
  },
  emptyTitle: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
    textAlign: "center",
  },
  groupId: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: 18,
  },
  membershipBody: { flex: 1, gap: designTokens.spacing.xxs },
  membershipCard: {
    alignItems: "center",
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: designTokens.spacing.sm,
    padding: designTokens.spacing.md,
  },
  membershipCardTappable: {
    borderColor: designTokens.colors.primaryStrong,
  },
  membershipCardWrapper: {
    color: "transparent",
    textDecorationLine: "none",
  },
  role: {
    backgroundColor: designTokens.colors.supportSurface,
    borderRadius: designTokens.radii.pill,
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.caption,
    paddingHorizontal: designTokens.spacing.xs,
    paddingVertical: designTokens.spacing.xxs,
  },
});
