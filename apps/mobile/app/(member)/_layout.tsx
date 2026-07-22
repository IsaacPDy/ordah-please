import { designTokens } from "@ordah-please/ui";
import { Tabs } from "expo-router";

import {
  memberTabActiveColor,
  memberTabBarStyle,
  memberTabItemStyle,
  memberTabs,
} from "../../src/navigation/member-tabs";

/** Renders the approved four-destination member navigation with accessible touch targets. */
export default function MemberTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: designTokens.colors.canvas },
        tabBarActiveTintColor: memberTabActiveColor,
        tabBarInactiveTintColor: designTokens.colors.textPrimary,
        tabBarItemStyle: memberTabItemStyle,
        tabBarLabelStyle: {
          fontFamily: "NunitoSans_600SemiBold",
          fontSize: designTokens.typography.size.label,
        },
        tabBarStyle: memberTabBarStyle,
      }}
    >
      {memberTabs.map((tab) => (
        <Tabs.Screen
          key={tab.routeName}
          name={tab.routeName}
          options={{
            tabBarAccessibilityLabel: tab.accessibilityLabel,
            tabBarIcon: ({ color, size }) => (
              <tab.icon color={color} size={size} strokeWidth={2.2} />
            ),
            title: tab.label,
          }}
        />
      ))}
    </Tabs>
  );
}
