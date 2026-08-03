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
  UserRoundCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ShellNavigationItem = Readonly<{
  href: string;
  icon: LucideIcon;
  label: string;
  mobileVisible?: boolean;
}>;

/** Defines the member destinations used by the iPhone PWA shell. */
export const memberNavigation: readonly ShellNavigationItem[] = [
  { href: "/", icon: House, label: "Home" },
  { href: "/orders", icon: ShoppingBag, label: "Orders" },
  { href: "/favorites", icon: Heart, label: "Favorites" },
  { href: "/groups", icon: Users, label: "Groups" },
];

/** Defines admin-only destinations separately so dense operations never leak into the member PWA. */
export const adminNavigation: readonly ShellNavigationItem[] = [
  { href: "/admin", icon: ListChecks, label: "Overview", mobileVisible: false },
  {
    href: "/admin/users",
    icon: UserRoundCog,
    label: "Users & permissions",
    mobileVisible: false,
  },
  { href: "/admin/groups", icon: Users, label: "Groups", mobileVisible: true },
  {
    href: "/admin/catalog",
    icon: Store,
    label: "Catalog",
    mobileVisible: true,
  },
  {
    href: "/admin/imports",
    icon: ClipboardList,
    label: "Imports",
    mobileVisible: false,
  },
  {
    href: "/admin/refresh",
    icon: RefreshCw,
    label: "Refresh queue",
    mobileVisible: false,
  },
  {
    href: "/admin/access-requests",
    icon: UserRoundCheck,
    label: "Access requests",
    mobileVisible: true,
  },
  {
    href: "/admin/audit",
    icon: History,
    label: "Audit log",
    mobileVisible: true,
  },
];
