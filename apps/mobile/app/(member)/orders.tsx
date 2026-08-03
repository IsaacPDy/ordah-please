import { designTokens } from "@ordah-please/ui";
import { Clock3, Store, Users } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Surface, Text } from "react-native-paper";

import { MemberPage } from "../../src/components/member-page";
import { MobileMemberAccessState } from "../../src/features/access/member-access-state";
import { useMobileAppIdentity } from "../../src/features/access/mobile-member-gate";

/** Shows native active work and order history without duplicating order-domain rules. */
export default function OrdersScreen() {
  const identity = useMobileAppIdentity();

  return (
    <MobileMemberAccessState identity={identity} surface="orders">
      <MemberPage title="Orders">
        <Text style={styles.description}>
          Respond to active orders and revisit the meals you joined.
        </Text>
        <Text
          accessibilityLabel="Active orders"
          accessibilityRole="header"
          style={styles.heading}
        >
          Active orders
        </Text>
        <Surface elevation={0} style={[styles.card, styles.urgent]}>
          <View style={styles.icon}>
            <Users color={designTokens.colors.primaryStrong} size={22} />
          </View>
          <View style={styles.body}>
            <Text style={styles.pill}>Voting</Text>
            <Text style={styles.title}>Friday lunch</Text>
            <Text>Friends · Choose a restaurant</Text>
            <View style={styles.inline}>
              <Clock3 color={designTokens.colors.primaryStrong} size={16} />
              <Text style={styles.deadline}>Due today at 11:30 AM</Text>
            </View>
          </View>
        </Surface>
        <Surface elevation={0} style={styles.card}>
          <View style={styles.icon}>
            <Store color={designTokens.colors.primaryStrong} size={22} />
          </View>
          <View style={styles.body}>
            <Text style={styles.pill}>Food confirmation</Text>
            <Text style={styles.title}>Campaign dinner</Text>
            <Text>Design team · Green Table</Text>
            <View style={styles.inline}>
              <Clock3 color={designTokens.colors.primaryStrong} size={16} />
              <Text style={styles.deadline}>Due tomorrow at 5:00 PM</Text>
            </View>
          </View>
        </Surface>
        <Text
          accessibilityLabel="Order history"
          accessibilityRole="header"
          style={styles.heading}
        >
          Order history
        </Text>
        <Surface elevation={0} style={styles.history}>
          <View style={styles.body}>
            <Text style={styles.pill}>Ordered</Text>
            <Text style={styles.title}>Tuesday lunch</Text>
            <Text style={styles.description}>Green Table · Friends</Text>
          </View>
          <Text style={styles.amount}>₱420.00</Text>
        </Surface>
        <Surface elevation={0} style={styles.history}>
          <View style={styles.body}>
            <Text style={styles.mutedPill}>Cancelled</Text>
            <Text style={styles.title}>Planning snacks</Text>
            <Text style={styles.description}>Fresh Bowls · Design team</Text>
          </View>
          <Text style={styles.amount}>₱0.00</Text>
        </Surface>
      </MemberPage>
    </MobileMemberAccessState>
  );
}

const styles = StyleSheet.create({
  amount: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
  },
  body: { flex: 1, gap: designTokens.spacing.xxs },
  card: {
    alignItems: "center",
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: designTokens.spacing.sm,
    padding: designTokens.spacing.md,
  },
  deadline: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_400Regular",
    fontSize: designTokens.typography.size.label,
  },
  description: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    lineHeight: 24,
  },
  heading: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
  },
  history: {
    alignItems: "flex-start",
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: designTokens.spacing.md,
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
    gap: designTokens.spacing.xxs,
  },
  mutedPill: {
    alignSelf: "flex-start",
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.caption,
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: designTokens.colors.supportSurface,
    borderRadius: designTokens.radii.pill,
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.caption,
    paddingHorizontal: designTokens.spacing.xs,
    paddingVertical: designTokens.spacing.xxs,
  },
  title: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: 18,
  },
  urgent: { backgroundColor: designTokens.colors.supportSurface },
});
