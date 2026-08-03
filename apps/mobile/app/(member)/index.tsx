import { designTokens } from "@ordah-please/ui";
import {
  Clock3,
  Heart,
  Sparkles,
  Star,
  Users,
  Utensils,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Button, ProgressBar, Surface, Text } from "react-native-paper";

import {
  getMobileAuthClient,
  readMobileApiUrl,
  readMobileSessionCookie,
} from "../../src/auth/auth-client";
import { buildAuthenticatedRequestInit } from "../../src/auth/authenticated-request";
import { MemberPage } from "../../src/components/member-page";
import { HomeAdminCard } from "../../src/features/access/home-admin-card";
import crispyChickenImage from "../../assets/images/crispy-chicken.jpg";
import freshBowlsImage from "../../assets/images/fresh-bowls.jpg";
import greenTableImage from "../../assets/images/green-table.jpg";

type HomeAdminState = Readonly<{
  isPlatformAdmin: boolean;
  pendingCount: number;
}>;

const NON_ADMIN_STATE: HomeAdminState = {
  isPlatformAdmin: false,
  pendingCount: 0,
};

const restaurants = [
  {
    image: greenTableImage,
    name: "Green Table",
    category: "Comfort Food",
    meta: "4.6 · 25–35 min · 1.2 km",
  },
  {
    image: freshBowlsImage,
    name: "Fresh Bowls",
    category: "Rice Bowls · Healthy",
    meta: "4.7 · 20–30 min · 1.6 km",
  },
  {
    image: crispyChickenImage,
    name: "Crispy Chicken",
    category: "Fried Chicken · Comfort Food",
    meta: "4.5 · 25–40 min · 1.1 km",
  },
] as const;

/** Reads the trusted identity summary that drives the platform-admin shortcut on Home. */
async function loadHomeAdminState(
  cookie: string,
  request: (input: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<HomeAdminState> {
  const response = await request(
    `${readMobileApiUrl()}/api/identity/me`,
    buildAuthenticatedRequestInit(cookie, { method: "GET" }),
  );
  if (!response.ok) {
    return NON_ADMIN_STATE;
  }
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("ok" in value) ||
    value.ok !== true ||
    !("data" in value)
  ) {
    return NON_ADMIN_STATE;
  }
  const data = (value as { data: unknown }).data;
  if (typeof data !== "object" || data === null) {
    return NON_ADMIN_STATE;
  }
  const record = data as Record<string, unknown>;
  return {
    isPlatformAdmin: record.isPlatformAdmin === true,
    pendingCount:
      typeof record.pendingAdminRequestCount === "number"
        ? record.pendingAdminRequestCount
        : 0,
  };
}

/** Shows the approved native Home hierarchy while retaining the platform-admin shortcut. */
export default function HomeScreen() {
  const router = useRouter();
  const [adminState, setAdminState] = useState<HomeAdminState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(() => readMobileSessionCookie(getMobileAuthClient()))
      .then((cookie) => loadHomeAdminState(cookie))
      .then((state) => {
        if (!cancelled) {
          setAdminState(state);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAdminState(NON_ADMIN_STATE);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MemberPage>
      {adminState === null ? null : (
        <HomeAdminCard
          isPlatformAdmin={adminState.isPlatformAdmin}
          onOpen={() => {
            router.push("/admin/access-requests");
          }}
          pendingCount={adminState.pendingCount}
        />
      )}
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
      <View style={styles.sectionHeading}>
        <Text
          accessibilityLabel="Restaurants"
          accessibilityRole="header"
          style={styles.sectionTitle}
        >
          Restaurants
        </Text>
        <Button compact mode="text">
          See all
        </Button>
      </View>
      <View style={styles.restaurantList}>
        {restaurants.map((restaurant) => (
          <View key={restaurant.name} style={styles.restaurantCard}>
            <Image
              accessibilityLabel={`${restaurant.name} food`}
              source={restaurant.image}
              style={styles.restaurantImage}
            />
            <View style={styles.restaurantBody}>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              <Text style={styles.secondary}>{restaurant.category}</Text>
              <Text style={styles.price}>₱ Affordable</Text>
              <View style={styles.inline}>
                <Star
                  color={designTokens.colors.warning}
                  fill={designTokens.colors.warning}
                  size={15}
                />
                <Text style={styles.meta}>{restaurant.meta}</Text>
              </View>
            </View>
            <Heart color={designTokens.colors.textSecondary} size={22} />
          </View>
        ))}
      </View>
    </MemberPage>
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
  meta: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    fontSize: designTokens.typography.size.caption,
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
  price: {
    alignSelf: "flex-start",
    backgroundColor: designTokens.colors.supportSurface,
    borderRadius: designTokens.radii.pill,
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_600SemiBold",
    fontSize: designTokens.typography.size.caption,
    paddingHorizontal: designTokens.spacing.xs,
    paddingVertical: designTokens.spacing.xxs,
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
