import type { GroupDetailRole } from "@ordah-please/domain";
import { parseGroupDetailsResponse } from "@ordah-please/contracts";
import { designTokens } from "@ordah-please/ui";
import { Crown, ShieldCheck, User } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Surface, Text } from "react-native-paper";

type GroupDetails = ReturnType<typeof parseGroupDetailsResponse>;

type GroupDetailsScreenProps = Readonly<{
  details: GroupDetails;
}>;

const ROLE_LABELS: Record<GroupDetailRole, string> = {
  "group-owner": "Group Owner",
  manager: "Manager",
  member: "Member",
};

/** Renders a read-only Group details summary: name, viewer role, owner, and member roster. */
export function GroupDetailsScreen({ details }: GroupDetailsScreenProps) {
  return (
    <View style={styles.container}>
      <Surface elevation={0} style={styles.headerCard}>
        <Text style={styles.eyebrow}>
          {ROLE_LABELS[details.viewerRole]} view
        </Text>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={2}
          style={styles.groupName}
        >
          {details.name}
        </Text>
      </Surface>

      <Surface elevation={0} style={styles.sectionCard}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={2}
          style={styles.sectionTitle}
        >
          Owner
        </Text>
        <View style={styles.ownerRow}>
          <Crown
            accessibilityLabel="Group owner"
            color={designTokens.colors.primaryStrong}
            size={18}
          />
          <Text style={styles.ownerName}>{details.owner.displayName}</Text>
        </View>
      </Surface>

      <Surface elevation={0} style={styles.sectionCard}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={2}
          style={styles.sectionTitle}
        >
          Members
        </Text>
        <View style={styles.roster}>
          {details.members.map((member) => (
            <View key={member.userId} style={styles.memberRow}>
              <RoleIcon role={member.role} />
              <Text style={styles.memberName}>{member.displayName}</Text>
              <Text style={styles.rolePill}>
                {ROLE_LABELS[member.role]}
              </Text>
            </View>
          ))}
        </View>
      </Surface>
    </View>
  );
}

function RoleIcon({ role }: Readonly<{ role: GroupDetailRole }>) {
  if (role === "group-owner") {
    return (
      <Crown
        accessibilityLabel="Group owner"
        color={designTokens.colors.primaryStrong}
        size={14}
      />
    );
  }
  if (role === "manager") {
    return (
      <ShieldCheck
        accessibilityLabel="Manager"
        color={designTokens.colors.textSecondary}
        size={14}
      />
    );
  }
  return (
    <User
      accessibilityLabel="Member"
      color={designTokens.colors.textSecondary}
      size={14}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    gap: designTokens.spacing.lg,
  },
  eyebrow: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    fontSize: designTokens.typography.size.label,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  groupName: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
  },
  headerCard: {
    backgroundColor: designTokens.colors.supportSurface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.majorCard,
    borderWidth: 1,
    gap: designTokens.spacing.xs,
    paddingHorizontal: designTokens.spacing.lg,
    paddingVertical: designTokens.spacing.lg,
  },
  memberName: {
    color: designTokens.colors.textPrimary,
    flex: 1,
    fontFamily: "NunitoSans_600SemiBold",
    fontSize: designTokens.typography.size.body,
  },
  memberRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: designTokens.spacing.xs,
    paddingVertical: designTokens.spacing.xs,
  },
  ownerName: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_600SemiBold",
    fontSize: designTokens.typography.size.body,
  },
  ownerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: designTokens.spacing.xs,
  },
  roster: {
    gap: designTokens.spacing.xxs,
  },
  rolePill: {
    backgroundColor: designTokens.colors.supportSurface,
    borderRadius: designTokens.radii.pill,
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.caption,
    paddingHorizontal: designTokens.spacing.xs,
    paddingVertical: designTokens.spacing.xxs,
  },
  sectionCard: {
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    gap: designTokens.spacing.sm,
    paddingHorizontal: designTokens.spacing.lg,
    paddingVertical: designTokens.spacing.lg,
  },
  sectionTitle: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.label,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
