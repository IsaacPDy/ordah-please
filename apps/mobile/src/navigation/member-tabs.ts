import {
  Heart,
  House,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react-native";

export type MemberTab = Readonly<{
  accessibilityLabel: string;
  href: "/" | "/orders" | "/favorites" | "/team";
  icon: LucideIcon;
  label: string;
  minimumTouchTarget: number;
  routeName: "index" | "orders" | "favorites" | "team";
}>;

/** Defines the member destinations once so labels, routes, icons, and accessibility stay aligned. */
export const memberTabs: readonly MemberTab[] = [
  {
    accessibilityLabel: "Home tab",
    href: "/",
    icon: House,
    label: "Home",
    minimumTouchTarget: 44,
    routeName: "index",
  },
  {
    accessibilityLabel: "Orders tab",
    href: "/orders",
    icon: ShoppingBag,
    label: "Orders",
    minimumTouchTarget: 44,
    routeName: "orders",
  },
  {
    accessibilityLabel: "Favorites tab",
    href: "/favorites",
    icon: Heart,
    label: "Favorites",
    minimumTouchTarget: 44,
    routeName: "favorites",
  },
  {
    accessibilityLabel: "Team tab",
    href: "/team",
    icon: Users,
    label: "Team",
    minimumTouchTarget: 44,
    routeName: "team",
  },
];
