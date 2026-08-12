import { designTokens } from "@ordah-please/ui";
import { Heart } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { MemberPage } from "../../src/components/member-page";
import { MobileMemberAccessState } from "../../src/features/access/member-access-state";
import { useMobileAppIdentity } from "../../src/features/access/mobile-member-gate";

/** Shows an honest empty state until members can save favorite combinations. */
export default function FavoritesScreen() {
  const identity = useMobileAppIdentity();

  return (
    <MobileMemberAccessState identity={identity} surface="favorites">
      <MemberPage title="Favorites">
        <View style={styles.emptyCard}>
          <View style={styles.iconWrap}>
            <Heart color={designTokens.colors.primaryStrong} size={28} />
          </View>
          <Text style={styles.title}>No favorites yet</Text>
          <Text style={styles.description}>
            No favorites yet — browse restaurants to add your first one.
          </Text>
        </View>
      </MemberPage>
    </MobileMemberAccessState>
  );
}

const styles = StyleSheet.create({
  description: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    lineHeight: 24,
    textAlign: "center",
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
  iconWrap: {
    alignItems: "center",
    backgroundColor: designTokens.colors.surface,
    borderRadius: designTokens.radii.pill,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  title: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
  },
});
