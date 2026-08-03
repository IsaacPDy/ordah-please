import { designTokens } from "@ordah-please/ui";
import { Clock3, Crown, ShieldCheck, Users } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Surface, Text } from "react-native-paper";

import { MemberPage } from "../../src/components/member-page";

const groups = [
  [
    "Friends",
    "Member",
    "7 members · 1 active order",
    "Next deadline Today, 11:30 AM",
  ],
  [
    "Design team",
    "Manager",
    "12 members · 1 active order",
    "Next deadline Tomorrow, 5:00 PM",
  ],
] as const;

/** Shows multiple native group memberships and a role-aware member preview. */
export default function GroupsScreen() {
  return (
    <MemberPage title="Your groups">
      <Text style={styles.description}>
        You can belong to multiple groups and hold a different role in each.
      </Text>
      {groups.map(([name, role, members, deadline]) => (
        <Surface elevation={0} key={name} style={styles.groupCard}>
          <View style={styles.icon}>
            <Users color={designTokens.colors.primaryStrong} size={22} />
          </View>
          <View style={styles.body}>
            <View style={styles.inline}>
              <Text style={styles.groupName}>{name}</Text>
              <Text style={styles.role}>{role}</Text>
            </View>
            <Text style={styles.meta}>{members}</Text>
            <View style={styles.inline}>
              <Clock3 color={designTokens.colors.textSecondary} size={15} />
              <Text style={styles.meta}>{deadline}</Text>
            </View>
          </View>
        </Surface>
      ))}
      <Surface elevation={0} style={styles.membersCard}>
        <Text style={styles.eyebrow}>Selected group · Friends</Text>
        <Text
          accessibilityLabel="Members"
          accessibilityRole="header"
          style={styles.heading}
        >
          Members
        </Text>
        <View style={styles.memberRow}>
          <Text style={styles.avatar}>MP</Text>
          <View style={styles.body}>
            <Text style={styles.memberName}>Mia Perez</Text>
            <Text style={styles.meta}>mia@example.com · 8 orders</Text>
          </View>
          <View style={styles.roleRow}>
            <Crown color={designTokens.colors.onPrimary} size={14} />
            <Text style={styles.ownerRole}>Group Owner</Text>
          </View>
        </View>
        <View style={styles.memberRow}>
          <Text style={styles.avatar}>JD</Text>
          <View style={styles.body}>
            <Text style={styles.memberName}>Jordan Diaz</Text>
            <Text style={styles.meta}>jordan@example.com · 6 orders</Text>
          </View>
          <View style={[styles.roleRow, styles.managerRoleRow]}>
            <ShieldCheck color={designTokens.colors.primaryStrong} size={14} />
            <Text style={styles.managerRole}>Manager</Text>
          </View>
        </View>
      </Surface>
    </MemberPage>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: designTokens.colors.primary,
    borderRadius: designTokens.radii.pill,
    color: designTokens.colors.onPrimary,
    fontFamily: "NunitoSans_700Bold",
    height: designTokens.touchTarget.minimum,
    lineHeight: designTokens.touchTarget.minimum,
    textAlign: "center",
    width: designTokens.touchTarget.minimum,
  },
  body: { flex: 1, gap: designTokens.spacing.xxs },
  description: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    lineHeight: 24,
  },
  eyebrow: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.caption,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  groupCard: {
    alignItems: "center",
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: designTokens.spacing.sm,
    padding: designTokens.spacing.md,
  },
  groupName: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: 20,
  },
  heading: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
  },
  icon: {
    alignItems: "center",
    backgroundColor: designTokens.colors.supportSurface,
    borderRadius: designTokens.radii.field,
    height: designTokens.touchTarget.minimum,
    justifyContent: "center",
    width: designTokens.touchTarget.minimum,
  },
  inline: {
    alignItems: "center",
    flexDirection: "row",
    gap: designTokens.spacing.xs,
  },
  managerRole: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.caption,
  },
  managerRoleRow: { backgroundColor: designTokens.colors.supportSurface },
  memberName: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
  },
  memberRow: {
    alignItems: "center",
    borderTopColor: designTokens.colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: designTokens.spacing.sm,
    minHeight: 72,
  },
  membersCard: {
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    padding: designTokens.spacing.md,
  },
  meta: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    fontSize: designTokens.typography.size.caption,
  },
  ownerRole: {
    color: designTokens.colors.onPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.caption,
  },
  role: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.caption,
  },
  roleRow: {
    alignItems: "center",
    backgroundColor: designTokens.colors.primaryStrong,
    borderRadius: designTokens.radii.pill,
    flexDirection: "row",
    gap: designTokens.spacing.xxs,
    paddingHorizontal: designTokens.spacing.xs,
    paddingVertical: designTokens.spacing.xxs,
  },
});
