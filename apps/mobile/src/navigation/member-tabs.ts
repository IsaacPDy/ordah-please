import { designTokens } from "@ordah-please/ui";
import {
  Heart,
  House,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react-native";

export type MemberTab = Readonly<{
  accessibilityLabel: string;
  href: "/" | "/orders" | "/favorites" | "/groups";
  icon: LucideIcon;
  label: string;
  minimumTouchTarget: number;
  routeName: "index" | "orders" | "favorites" | "groups";
}>;

/** Uses the approved high-emphasis green where active tab text must remain readable on white. */
export const memberTabActiveColor = designTokens.colors.primaryStrong;

/** Connects the runtime tab item directly to the shared minimum touch-target token. */
export const memberTabItemStyle = {
  minHeight: designTokens.touchTarget.minimum,
  minWidth: designTokens.touchTarget.minimum,
} as const;

/** Styles the tab surface without replacing the navigator's device bottom inset. */
export const memberTabBarStyle = {
  backgroundColor: designTokens.colors.surface,
  borderTopColor: designTokens.colors.border,
  minHeight: 72,
  paddingTop: designTokens.spacing.xs,
} as const;

/** Defines the member destinations once so labels, routes, icons, and accessibility stay aligned. */
export const memberTabs: readonly MemberTab[] = [
  {
    accessibilityLabel: "Home tab",
    href: "/",
    icon: House,
    label: "Home",
    minimumTouchTarget: designTokens.touchTarget.minimum,
    routeName: "index",
  },
  {
    accessibilityLabel: "Orders tab",
    href: "/orders",
    icon: ShoppingBag,
    label: "Orders",
    minimumTouchTarget: designTokens.touchTarget.minimum,
    routeName: "orders",
  },
  {
    accessibilityLabel: "Favorites tab",
    href: "/favorites",
    icon: Heart,
    label: "Favorites",
    minimumTouchTarget: designTokens.touchTarget.minimum,
    routeName: "favorites",
  },
  {
    accessibilityLabel: "Groups tab",
    href: "/groups",
    icon: Users,
    label: "Groups",
    minimumTouchTarget: designTokens.touchTarget.minimum,
    routeName: "groups",
  },
];
