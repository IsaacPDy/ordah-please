import { designTokens } from "@ordah-please/ui";
import { Bell } from "lucide-react-native";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { IconButton, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useMobileAppIdentity } from "../features/access/mobile-member-gate";
import { ProfileMenu } from "./profile-menu";

type MemberPageProps = Readonly<{
  children: ReactNode;
  title?: string;
}>;

/** Provides the shared native member canvas, product header, profile action, and scroll behavior. */
export function MemberPage({ children, title }: MemberPageProps) {
  const identity = useMobileAppIdentity();

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
          <View style={styles.headerActions}>
            <IconButton
              accessibilityLabel="Open notifications"
              icon={() => (
                <Bell color={designTokens.colors.textPrimary} size={23} />
              )}
              size={24}
            />
            <ProfileMenu
              displayName={identity.displayName}
              email={identity.email}
              imageUrl={identity.imageUrl}
            />
          </View>
        </View>
        {title === undefined ? null : (
          <Text
            accessibilityLabel={title}
            accessibilityRole="header"
            maxFontSizeMultiplier={2}
            style={styles.title}
          >
            {title}
          </Text>
        )}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: designTokens.colors.primaryStrong,
    fontFamily: "NunitoSans_700Bold",
    fontSize: designTokens.typography.size.display,
    letterSpacing: -1.1,
  },
  brandHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: designTokens.spacing.md,
  },
  content: {
    flexGrow: 1,
    gap: designTokens.spacing.lg,
    paddingBottom: designTokens.spacing.xxl,
    paddingHorizontal: designTokens.spacing.md,
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
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
