import { designTokens } from "@ordah-please/ui";
import { Clock3, Sparkles, Users, Utensils } from "lucide-react-native";
import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  ProgressBar,
  Surface,
  Text,
} from "react-native-paper";

import { MemberPage } from "../../src/components/member-page";
import { HomeAdminCard } from "../../src/features/access/home-admin-card";
import { MobileMemberAccessState } from "../../src/features/access/member-access-state";
import { useMobileAppIdentity } from "../../src/features/access/mobile-member-gate";
import { useRestaurants } from "../../src/features/catalog/use-restaurants";

/** Shows the approved native Home hierarchy while retaining the platform-admin shortcut. */
export default function HomeScreen() {
  const router = useRouter();
  const identity = useMobileAppIdentity();
  const restaurantsState = useRestaurants();

  return (
    <MobileMemberAccessState identity={identity} surface="home">
      <MemberPage>
        <HomeAdminCard
          isPlatformAdmin={identity.isPlatformAdmin}
          onOpen={() => {
            router.push("/admin/access-requests");
          }}
          pendingCount={identity.pendingAdminRequestCount}
        />
        {identity.memberships.length > 0 ? (
          <Surface elevation={1} style={styles.activeCard}>
            <Text style={styles.eyebrow}>Active group order</Text>
            <View style={styles.groupRow}>
              <View style={styles.groupIcon}>
                <Users color={designTokens.colors.onPrimary} size={22} />
              </View>
              <Text style={styles.groupName}>Friends</Text>
              <Text style={styles.memberCount}>7 members</Text>
            </View>
            <View style={styles.orderInner}>
              <Text
                accessibilityLabel="Friday lunch"
                accessibilityRole="header"
                style={styles.orderTitle}
              >
                Friday lunch
              </Text>
              <View style={styles.inline}>
                <Clock3 color={designTokens.colors.primaryStrong} size={18} />
                <Text style={styles.deadline}>Vote by 11:30 AM</Text>
              </View>
              <Text style={styles.voteCount}>
                <Text style={styles.voteNumber}>4</Text> of 7 voted
              </Text>
              <ProgressBar
                color={designTokens.colors.primary}
                progress={4 / 7}
                style={styles.progress}
              />
              <Button
                buttonColor={designTokens.colors.primary}
                icon={() => (
                  <Utensils color={designTokens.colors.onPrimary} size={20} />
                )}
                mode="contained"
                onPress={() => router.push("/orders")}
                style={styles.primaryButton}
                textColor={designTokens.colors.onPrimary}
              >
                Choose restaurant
              </Button>
              <View style={styles.fallback}>
                <Sparkles color={designTokens.colors.textPrimary} size={18} />
                <Text>No response? Mia&apos;s pick wins.</Text>
              </View>
            </View>
          </Surface>
        ) : null}
        <View style={styles.sectionHeading}>
          <Text
            accessibilityLabel="Restaurants"
            accessibilityRole="header"
            style={styles.sectionTitle}
          >
            Restaurants
          </Text>
        </View>
        {restaurantsState.kind === "loading" ? (
          <ActivityIndicator
            accessibilityLabel="Loading restaurants"
            color={designTokens.colors.primary}
            size="large"
          />
        ) : null}
        {restaurantsState.kind === "error" ? (
          <View style={styles.catalogState}>
            <Text accessibilityRole="alert" style={styles.secondary}>
              Restaurants could not be loaded.
            </Text>
            <Button mode="contained" onPress={restaurantsState.retry}>
              Try again
            </Button>
          </View>
        ) : null}
        {restaurantsState.kind === "ready" &&
        restaurantsState.restaurants.length === 0 ? (
          <View style={styles.catalogState}>
            <Text style={styles.secondary}>No restaurants available yet.</Text>
          </View>
        ) : null}
        {restaurantsState.kind === "ready" ? (
          <View style={styles.restaurantList}>
            {restaurantsState.restaurants.map((restaurant) => (
              <Pressable
                accessibilityLabel={`Open ${restaurant.name}`}
                accessibilityRole="button"
                key={restaurant.id}
                onPress={() => {
                  router.push(`/restaurants/${restaurant.id}`);
                }}
                style={styles.restaurantCard}
              >
                {restaurant.heroImageUrl === null ? (
                  <View
                    accessibilityLabel={`${restaurant.name} image unavailable`}
                    style={styles.restaurantImageFallback}
                  >
                    <Text style={styles.restaurantInitial}>
                      {restaurant.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                ) : (
                  <Image
                    accessibilityLabel={`${restaurant.name} food`}
                    source={{ uri: restaurant.heroImageUrl }}
                    style={styles.restaurantImage}
                  />
                )}
                <View style={styles.restaurantBody}>
                  <Text style={styles.restaurantName}>{restaurant.name}</Text>
                  <Text style={styles.secondary}>
                    {restaurant.cuisines.length > 0
                      ? restaurant.cuisines.join(" · ")
                      : "Cuisine not listed"}
                  </Text>
                  <Text style={styles.branchName}>{restaurant.branchName}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </MemberPage>
    </MobileMemberAccessState>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    backgroundColor: designTokens.colors.supportSurface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.majorCard,
    borderWidth: 1,
    gap: designTokens.spacing.sm,
    padding: designTokens.spacing.md,
  },
  branchName: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_600SemiBold",
    fontSize: designTokens.typography.size.caption,
  },
  catalogState: {
    alignItems: "center",
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    gap: designTokens.spacing.sm,
    padding: designTokens.spacing.lg,
  },
  deadline: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_400Regular",
  },
  eyebrow: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.caption,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  fallback: {
    alignItems: "center",
    flexDirection: "row",
    gap: designTokens.spacing.xs,
    justifyContent: "center",
  },
  groupIcon: {
    alignItems: "center",
    backgroundColor: designTokens.colors.primary,
    borderRadius: designTokens.radii.pill,
    height: designTokens.touchTarget.minimum,
    justifyContent: "center",
    width: designTokens.touchTarget.minimum,
  },
  groupName: {
    color: designTokens.colors.textPrimary,
    flex: 1,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
  },
  groupRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: designTokens.spacing.sm,
  },
  inline: {
    alignItems: "center",
    flexDirection: "row",
    gap: designTokens.spacing.xs,
  },
  memberCount: {
    backgroundColor: designTokens.colors.surface,
    borderRadius: designTokens.radii.pill,
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.caption,
    paddingHorizontal: designTokens.spacing.sm,
    paddingVertical: designTokens.spacing.xs,
  },
  orderInner: {
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    gap: designTokens.spacing.sm,
    padding: designTokens.spacing.md,
  },
  orderTitle: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
  },
  primaryButton: { borderRadius: designTokens.radii.field },
  progress: {
    backgroundColor: designTokens.colors.border,
    borderRadius: designTokens.radii.pill,
    height: designTokens.spacing.xs,
  },
  restaurantBody: { flex: 1, gap: designTokens.spacing.xxs },
  restaurantCard: {
    alignItems: "center",
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: designTokens.spacing.sm,
    overflow: "hidden",
    paddingRight: designTokens.spacing.sm,
  },
  restaurantImage: { height: 116, width: 124 },
  restaurantImageFallback: {
    alignItems: "center",
    backgroundColor: designTokens.colors.supportSurface,
    height: 116,
    justifyContent: "center",
    width: 124,
  },
  restaurantInitial: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.display,
  },
  restaurantList: { gap: designTokens.spacing.sm },
  restaurantName: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: 18,
  },
  secondary: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
  },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
  },
  voteCount: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_400Regular",
  },
  voteNumber: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
  },
});
