import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import AdminHomePage from "./admin/page";
import AdminLayout from "./admin/layout";
import AuditPage from "./admin/audit/page";
import CatalogPage from "./admin/catalog/page";
import ImportsPage from "./admin/imports/page";
import RefreshPage from "./admin/refresh/page";
import MemberLayout from "./(member)/layout";
import FavoritesPage from "./(member)/favorites/page";
import GroupsPage from "./(member)/groups/page";
import MemberHomePage from "./(member)/page";
import OrdersPage from "./(member)/orders/page";
import TeamPage from "./(member)/team/page";
import { adminNavigation, memberNavigation } from "./shell-navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("../src/auth/load-server-page-identity", () => ({
  getCurrentServerPageIdentity: () =>
    Promise.resolve({
      identity: {
        authUserId: "auth-test-user",
        isPlatformAdmin: true,
        memberships: [
          { groupId: "group-alpha", role: "group-owner" },
          { groupId: "group-beta", role: "manager" },
        ],
        userId: "test-user",
      },
      status: "authenticated",
    }),
}));

describe("web navigation shells", () => {
  it("keeps member and admin navigation separate", () => {
    expect(memberNavigation.map((item) => item.label)).toEqual([
      "Home",
      "Orders",
      "Favorites",
      "Groups",
    ]);
    expect(memberNavigation.at(-1)?.href).toBe("/groups");
    expect(adminNavigation.map((item) => item.label)).toEqual([
      "Overview",
      "Users & permissions",
      "Groups",
      "Catalog",
      "Imports",
      "Refresh queue",
      "Access requests",
      "Audit log",
    ]);
    expect(memberNavigation).not.toBe(adminNavigation);
    expect(
      adminNavigation
        .filter((item) => item.mobileVisible)
        .map((item) => item.label),
    ).toEqual(["Groups", "Catalog", "Access requests", "Audit log"]);
  });

  it("renders the active-order and restaurant sections from the approved Home design", async () => {
    const home = await MemberHomePage();
    const layout = await MemberLayout({ children: home });
    const html = renderToStaticMarkup(layout);

    expect(html).toContain("ordah please");
    expect(html).toContain("Active group order");
    expect(html).toContain("Friday lunch");
    expect(html).toContain("Choose restaurant");
    expect(html).toContain("Restaurants");
    expect(html).toContain("Green Table");
  });

  it("renders active and historical orders with the approved filters", async () => {
    const html = renderToStaticMarkup(await OrdersPage());

    expect(html).toContain("Active orders");
    expect(html).toContain("Order history");
    expect(html).toContain("Group");
    expect(html).toContain("Restaurant");
    expect(html).toContain("Status");
    expect(html).toContain("Date");
  });

  it("groups ranked Favorites under their exact restaurant branch", async () => {
    const html = renderToStaticMarkup(await FavoritesPage());

    expect(html).toContain("Green Table · BGC");
    expect(html).toContain("Rank 1");
    expect(html).toContain("Edit combination");
    expect(html).toContain("Remove restaurant favorites");
  });

  it("shows every real membership with its exact role", async () => {
    const html = renderToStaticMarkup(await GroupsPage());

    expect(html).toContain("Your groups");
    expect(html).toContain("group-alpha");
    expect(html).toContain("group-beta");
    expect(html).toContain("Group Owner");
    expect(html).toContain("Manager");
    expect(html).not.toContain("Friends");
    expect(html).not.toContain("Design team");
  });

  it("keeps the former Team URL on the same truthful membership view", async () => {
    const html = renderToStaticMarkup(await TeamPage());

    expect(html).toContain("group-alpha");
    expect(html).toContain("group-beta");
    expect(html).not.toContain("Friends");
  });

  it("renders a distinct admin operations overview", async () => {
    const layout = await AdminLayout({ children: <AdminHomePage /> });
    const html = renderToStaticMarkup(layout);

    expect(html).toContain("Admin overview");
    expect(html).toContain("Pending decisions");
    expect(html).toContain("Catalog coverage");
    expect(html).toContain("Refresh failures");
    expect(html).not.toContain("Nothing needs your attention yet");
    expect(html).toContain('aria-label="Admin navigation"');
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("renders the catalog, imports, refresh queue, and audit workspaces", () => {
    const html = [
      <CatalogPage key="catalog" />,
      <ImportsPage key="imports" />,
      <RefreshPage key="refresh" />,
      <AuditPage key="audit" />,
    ]
      .map((page) => renderToStaticMarkup(page))
      .join("\n");

    expect(html).toContain("Published restaurants");
    expect(html).toContain("Import drafts");
    expect(html).toContain("Weekly refresh queue");
    expect(html).toContain("Permission override changed");
  });
});
