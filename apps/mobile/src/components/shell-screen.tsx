import { designTokens } from "@ordah-please/ui";
import type { LucideIcon } from "lucide-react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { Surface, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type ShellScreenProps = Readonly<{
  description: string;
  emptyTitle: string;
  icon: LucideIcon;
  title: string;
}>;

/** Renders a dynamic-text-safe member shell that states truthfully when a feature has no data yet. */
export function ShellScreen({
  description,
  emptyTitle,
  icon: Icon,
  title,
}: ShellScreenProps) {
  return (
    <SafeAreaView
      edges={["top"]}
      style={styles.safeArea}
      testID="member-safe-area"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.screen}
        testID="member-shell"
      >
        <View style={styles.brandHeader}>
          <Text maxFontSizeMultiplier={2} style={styles.brand}>
            ordah please
          </Text>
        </View>

        <View style={styles.pageHeading}>
          <Text
            accessibilityLabel={title}
            accessibilityRole="header"
            maxFontSizeMultiplier={2}
            style={styles.title}
          >
            {title}
          </Text>
        </View>

        <Surface elevation={1} style={styles.emptyState}>
          <View accessibilityElementsHidden style={styles.iconSurface}>
            <Icon
              color={designTokens.colors.primaryStrong}
              size={32}
              strokeWidth={2}
            />
          </View>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={2}
            style={styles.emptyTitle}
          >
            {emptyTitle}
          </Text>
          <Text maxFontSizeMultiplier={2} style={styles.description}>
            {description}
          </Text>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.display,
  },
  brandHeader: {
    paddingBottom: designTokens.spacing.lg,
    paddingTop: designTokens.spacing.md,
  },
  content: {
    flexGrow: 1,
    paddingBottom: designTokens.spacing.xxl,
    paddingHorizontal: designTokens.spacing.lg,
  },
  description: {
    color: designTokens.colors.textSecondary,
    fontFamily: "NunitoSans_400Regular",
    fontSize: designTokens.typography.size.body,
    lineHeight: 24,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: designTokens.colors.supportSurface,
    borderColor: designTokens.colors.border,
    borderRadius: designTokens.radii.majorCard,
    borderWidth: 1,
    gap: designTokens.spacing.sm,
    paddingHorizontal: designTokens.spacing.lg,
    paddingVertical: designTokens.spacing.xl,
  },
  emptyTitle: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
    lineHeight: 32,
    textAlign: "center",
  },
  iconSurface: {
    alignItems: "center",
    backgroundColor: designTokens.colors.surface,
    borderRadius: designTokens.radii.pill,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  pageHeading: {
    paddingBottom: designTokens.spacing.md,
  },
  safeArea: {
    backgroundColor: designTokens.colors.canvas,
    flex: 1,
  },
  screen: {
    backgroundColor: designTokens.colors.canvas,
    flex: 1,
  },
  title: {
    color: designTokens.colors.textPrimary,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.title,
    lineHeight: 32,
  },
});
