import { designTokens } from "@ordah-please/ui";
import { ArrowLeft } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRestaurantDetail } from "../../../src/features/catalog/use-restaurant-detail";

/** Normalizes Expo Router's dynamic value into one usable restaurant id. */
function readRestaurantId(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Formats exact centavos as a peso amount with two decimal places. */
function formatPeso(priceCentavos: number): string {
  return `₱${(priceCentavos / 100).toFixed(2)}`;
}

/** Finds the first menu photo for the restaurant hero area. */
function findHeroImageUrl(
  categories: readonly {
    readonly items: readonly { readonly imageUrl: string | null }[];
  }[],
): string | null {
  for (const category of categories) {
    const image = category.items.find(
      (item) => item.imageUrl !== null,
    )?.imageUrl;
    if (image) return image;
  }
  return null;
}

/** Renders one real restaurant and its current published menu. */
export default function RestaurantDetailRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const restaurantId = readRestaurantId(params.id);
  const router = useRouter();
  const state = useRestaurantDetail(restaurantId);
  const scrollRef = useRef<ScrollView>(null);
  const categoryOffsets = useRef<Record<string, number>>({});

  if (state.kind === "invalid") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.statusWrap}>
          <Text accessibilityRole="alert" style={styles.statusText}>
            Restaurant could not be loaded.
          </Text>
          <Button mode="contained" onPress={() => router.back()}>
            Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (state.kind === "loading") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.statusWrap}>
          <ActivityIndicator
            accessibilityLabel="Loading restaurant"
            color={designTokens.colors.primary}
            size="large"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (state.kind === "error") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.statusWrap}>
          <Text accessibilityRole="alert" style={styles.statusText}>
            Restaurant could not be loaded.
          </Text>
          <Button mode="contained" onPress={state.retry}>
            Try again
          </Button>
          <Button mode="text" onPress={() => router.back()}>
            Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const { detail } = state;
  const heroImageUrl = findHeroImageUrl(detail.categories);

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[1]}
        style={styles.screen}
      >
        <View>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft color={designTokens.colors.textPrimary} size={22} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          {heroImageUrl === null ? (
            <View
              accessibilityLabel={`${detail.restaurantName} image unavailable`}
              style={styles.heroFallback}
            >
              <Text style={styles.heroInitial}>
                {detail.restaurantName.charAt(0).toUpperCase()}
              </Text>
            </View>
          ) : (
            <Image
              accessibilityLabel={`${detail.restaurantName} food`}
              resizeMode="cover"
              source={{ uri: heroImageUrl }}
              style={styles.heroImage}
            />
          )}
          <View style={styles.restaurantHeader}>
            <Text
              accessibilityLabel={detail.restaurantName}
              accessibilityRole="header"
              style={styles.restaurantName}
            >
              {detail.restaurantName}
            </Text>
            <Text style={styles.branchName}>{detail.branchName}</Text>
            {detail.cuisines.length > 0 ? (
              <Text style={styles.cuisines}>{detail.cuisines.join(" · ")}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.categoryBar}>
          <ScrollView
            contentContainerStyle={styles.categoryBarContent}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {detail.categories.map((category) => (
              <Pressable
                accessibilityLabel={`Go to ${category.name}`}
                accessibilityRole="button"
                key={category.name}
                onPress={() => {
                  const y = categoryOffsets.current[category.name];
                  if (y !== undefined) {
                    scrollRef.current?.scrollTo({ animated: true, y });
                  }
                }}
                style={styles.categoryChip}
              >
                <Text style={styles.categoryChipText}>{category.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.menu}>
          {detail.categories.map((category) => (
            <View
              key={category.name}
              onLayout={(event) => {
                categoryOffsets.current[category.name] =
                  event.nativeEvent.layout.y;
              }}
              style={styles.categorySection}
            >
              <Text
                accessibilityLabel={category.name}
                accessibilityRole="header"
                style={styles.categoryTitle}
              >
                {category.name}
              </Text>
              {category.items.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  {item.imageUrl === null ? (
                    <View style={styles.itemImageFallback} />
                  ) : (
                    <Image
                      accessibilityLabel={`${item.name} photo`}
                      resizeMode="cover"
                      source={{ uri: item.imageUrl }}
                      style={styles.itemImage}
                    />
                  )}
                  <View style={styles.itemBody}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.description.trim() === "" ? null : (
                      <Text style={styles.itemDescription}>
                        {item.description}
                      </Text>
                    )}
                    <Text style={styles.price}>
                      {formatPeso(item.priceCentavos)}
                    </Text>
                    {item.availability === "unavailable" ? (
                      <Text style={styles.unavailable}>
                        Currently unavailable
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: designTokens.spacing.xs,
    minHeight: designTokens.touchTarget.minimum,
    paddingHorizontal: designTokens.spacing.md,
  },
  backText: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_600SemiBold",
  },
  branchName: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    fontSize: designTokens.typography.size.body,
  },
  categoryBar: {
    backgroundColor: designTokens.colors.surface,
    borderBottomColor: designTokens.colors.border,
    borderBottomWidth: 1,
    borderTopColor: designTokens.colors.border,
    borderTopWidth: 1,
  },
  categoryBarContent: {
    gap: designTokens.spacing.xs,
    paddingHorizontal: designTokens.spacing.md,
    paddingVertical: designTokens.spacing.sm,
  },
  categoryChip: {
    alignItems: "center",
    backgroundColor: designTokens.colors.supportSurface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: designTokens.touchTarget.minimum,
    paddingHorizontal: designTokens.spacing.md,
  },
  categoryChipText: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
  },
  categorySection: { gap: designTokens.spacing.sm },
  categoryTitle: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
  },
  cuisines: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_600SemiBold",
    lineHeight: 22,
  },
  heroFallback: {
    alignItems: "center",
    backgroundColor: designTokens.colors.supportSurface,
    height: 220,
    justifyContent: "center",
    width: "100%",
  },
  heroImage: { height: 220, width: "100%" },
  heroInitial: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: 64,
  },
  itemBody: { flex: 1, gap: designTokens.spacing.xxs },
  itemCard: {
    alignItems: "flex-start",
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: designTokens.spacing.sm,
    padding: designTokens.spacing.sm,
  },
  itemDescription: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    lineHeight: 20,
  },
  itemImage: {
    borderRadius: designTokens.radii.field,
    height: 88,
    width: 88,
  },
  itemImageFallback: {
    backgroundColor: designTokens.colors.supportSurface,
    borderRadius: designTokens.radii.field,
    height: 88,
    width: 88,
  },
  itemName: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.body,
  },
  menu: {
    gap: designTokens.spacing.xl,
    padding: designTokens.spacing.md,
    paddingBottom: designTokens.spacing.xxl,
  },
  price: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontVariant: ["tabular-nums"],
  },
  restaurantHeader: {
    gap: designTokens.spacing.xxs,
    padding: designTokens.spacing.md,
  },
  restaurantName: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.display,
  },
  safeArea: { backgroundColor: designTokens.colors.canvas, flex: 1 },
  screen: { backgroundColor: designTokens.colors.canvas, flex: 1 },
  statusText: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_400Regular",
    textAlign: "center",
  },
  statusWrap: {
    alignItems: "center",
    flex: 1,
    gap: designTokens.spacing.md,
    justifyContent: "center",
    padding: designTokens.spacing.lg,
  },
  unavailable: {
    color: designTokens.colors.error,
    fontFamily: "NunitoSans_600SemiBold",
    fontSize: designTokens.typography.size.caption,
  },
});
