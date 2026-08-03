import { designTokens } from "@ordah-please/ui";
import { Edit3, Heart, Trash2 } from "lucide-react-native";
import { Image, StyleSheet, View } from "react-native";
import { Button, IconButton, Text } from "react-native-paper";

import { MemberPage } from "../../src/components/member-page";
import { MobileMemberAccessState } from "../../src/features/access/member-access-state";
import { useMobileAppIdentity } from "../../src/features/access/mobile-member-gate";
import greenTableImage from "../../assets/images/green-table.jpg";

const combinations = [
  [
    "Rank 1",
    "Grilled chicken plate",
    "Garlic rice · Macaroni soup · No onions",
    "₱245",
  ],
  ["Rank 2", "Beef tapa breakfast", "Extra egg · Iced tea", "₱225"],
  ["Rank 3", "Chicken pesto pasta", "Regular · No drink", "₱210"],
] as const;

/** Shows the native ranked-combination editor grouped by exact restaurant branch. */
export default function FavoritesScreen() {
  const identity = useMobileAppIdentity();

  return (
    <MobileMemberAccessState identity={identity} surface="favorites">
      <MemberPage title="Favorites">
        <Text style={styles.description}>
          Your top three combinations are ready when a group order starts.
        </Text>
        <View style={styles.restaurant}>
          <View style={styles.restaurantHeader}>
            <Image
              accessibilityLabel="Green Table food"
              source={greenTableImage}
              style={styles.image}
            />
            <View style={styles.headerBody}>
              <Text style={styles.restaurantName}>Green Table · BGC</Text>
              <Text style={styles.description}>3 saved combinations</Text>
            </View>
          </View>
          {combinations.map(([rank, name, details, price]) => (
            <View key={rank} style={styles.combination}>
              <Text style={styles.rank}>{rank}</Text>
              <View style={styles.body}>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.details}>{details}</Text>
              </View>
              <Text style={styles.price}>{price}</Text>
              <IconButton
                accessibilityLabel={`Edit ${name}`}
                icon={() => (
                  <Edit3 color={designTokens.colors.textPrimary} size={18} />
                )}
              />
            </View>
          ))}
          <View style={styles.actions}>
            <Button
              icon={() => (
                <Heart color={designTokens.colors.textPrimary} size={18} />
              )}
              mode="outlined"
            >
              Add another
            </Button>
            <Button
              icon={() => (
                <Trash2 color={designTokens.colors.error} size={18} />
              )}
              mode="outlined"
              textColor={designTokens.colors.error}
            >
              Remove restaurant favorites
            </Button>
          </View>
        </View>
      </MemberPage>
    </MobileMemberAccessState>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: "flex-start",
    borderTopColor: designTokens.colors.border,
    borderTopWidth: 1,
    gap: designTokens.spacing.xs,
    padding: designTokens.spacing.md,
  },
  body: { flex: 1, gap: designTokens.spacing.xxs },
  combination: {
    alignItems: "center",
    borderTopColor: designTokens.colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: designTokens.spacing.xs,
    padding: designTokens.spacing.sm,
  },
  description: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    lineHeight: 24,
  },
  details: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    fontSize: designTokens.typography.size.caption,
  },
  headerBody: { flex: 1 },
  image: { borderRadius: designTokens.radii.field, height: 64, width: 64 },
  name: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
  },
  price: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
  },
  rank: {
    backgroundColor: designTokens.colors.supportSurface,
    borderRadius: designTokens.radii.pill,
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: 10,
    paddingHorizontal: designTokens.spacing.xs,
    paddingVertical: designTokens.spacing.xxs,
  },
  restaurant: {
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    overflow: "hidden",
  },
  restaurantHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: designTokens.spacing.sm,
    padding: designTokens.spacing.md,
  },
  restaurantName: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: 20,
  },
});
