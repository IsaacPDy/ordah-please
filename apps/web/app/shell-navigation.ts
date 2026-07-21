import {
  ClipboardList,
  Heart,
  History,
  House,
  ListChecks,
  RefreshCw,
  ShoppingBag,
  Store,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ShellNavigationItem = Readonly<{
  href: string;
  icon: LucideIcon;
  label: string;
}>;

/** Defines the member destinations used by the iPhone PWA shell. */
export const memberNavigation: readonly ShellNavigationItem[] = [
  { href: "/", icon: House, label: "Home" },
  { href: "/orders", icon: ShoppingBag, label: "Orders" },
  { href: "/favorites", icon: Heart, label: "Favorites" },
  { href: "/team", icon: Users, label: "Team" },
];

/** Defines admin-only destinations separately so dense operations never leak into the member PWA. */
export const adminNavigation: readonly ShellNavigationItem[] = [
  { href: "/admin", icon: ListChecks, label: "Overview" },
  { href: "/admin/catalog", icon: Store, label: "Catalog" },
  { href: "/admin/imports", icon: ClipboardList, label: "Imports" },
  { href: "/admin/refresh", icon: RefreshCw, label: "Refresh queue" },
  {
    href: "/admin/access-requests",
    icon: UserRoundCheck,
    label: "Access requests",
  },
  { href: "/admin/audit", icon: History, label: "Audit log" },
];
