import type { ReactNode } from "react";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import AdminHomePage from "./admin/page";
import AdminLayout, { AdminShellAccessLoading } from "./admin/layout";
import AuditPage from "./admin/audit/page";
import CatalogPage from "./admin/catalog/page";
import ImportsPage from "./admin/imports/page";
import RefreshPage from "./admin/refresh/page";
import MemberLayout, { MemberShellAccessLoading } from "./(member)/layout";
import FavoritesPage from "./(member)/favorites/page";
import GroupsPage from "./(member)/groups/page";
import MemberHomePage from "./(member)/page";
import OrdersPage from "./(member)/orders/page";
import TeamPage from "./(member)/team/page";
import { adminNavigation, memberNavigation } from "./shell-navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("../src/features/catalog/catalog-runtime", () => ({
  catalogRuntime: {
    catalog: {
      listRecentImports: () => Promise.resolve([]),
      listRestaurantPreviews: () => Promise.resolve([]),
      listRestaurants: () => Promise.resolve([]),
    },
  },
}));

vi.mock("../src/features/catalog/catalog-cache", () => ({
  listCachedRestaurantPreviews: () => Promise.resolve([]),
}));

vi.mock("../src/features/favorites/favorites-runtime", () => ({
  favoritesRuntime: {
    listFavoritesForUser: () => Promise.resolve([]),
  },
}));

vi.mock("../src/features/orders/orders-runtime", () => ({
  ordersRuntime: {
    listActiveOrderSummaries: () =>
      Promise.resolve([
        {
          completedAt: null,
          deadline: new Date("2026-08-20T03:30:00.000Z"),
          groupId: "group-alpha",
          groupName: "Alpha group",
          orderId: "order-1",
          participants: [],
          participantsTotal: 3,
          participantsVoted: 2,
          restaurantName: null,
          state: "restaurant_voting",
        },
      ]),
    listOrderSummaries: () =>
      Promise.resolve({
        active: [
          {
            completedAt: null,
            deadline: new Date("2026-08-20T03:30:00.000Z"),
            groupId: "group-alpha",
            groupName: "Alpha group",
            orderId: "order-1",
            participants: [],
            participantsTotal: 3,
            participantsVoted: 2,
            restaurantName: null,
            state: "restaurant_voting",
          },
        ],
        history: [],
      }),
    listOrderSummaryPage: () =>
      Promise.resolve({
        active: [
          {
            completedAt: null,
            deadline: new Date("2026-08-20T03:30:00.000Z"),
            groupId: "group-alpha",
            groupName: "Alpha group",
            orderId: "order-1",
            participants: [],
            participantsTotal: 3,
            participantsVoted: 2,
            restaurantName: null,
            state: "restaurant_voting",
          },
        ],
        history: [],
        nextCursor: null,
      }),
  },
}));

vi.mock("../src/features/groups/group-runtime", () => ({
  groupRuntime: {
    listViewerGroupSummaries: () =>
      Promise.resolve([
        {
          groupId: "group-alpha",
          name: "Alpha group",
          role: "group-owner",
          memberCount: 3,
          memberPreviews: [],
        },
        {
          groupId: "group-beta",
          name: "Beta group",
          role: "manager",
          memberCount: 5,
          memberPreviews: [],
        },
      ]),
  },
}));

vi.mock("../src/auth/load-server-page-identity", () => ({
  getCurrentServerPageIdentity: () =>
    Promise.resolve({
      identity: {
        authUserId: "auth-test-user",
        displayName: "Mia Tan",
        email: "mia@example.com",
        imageUrl: null,
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

/** Waits for async Server Components before converting their stream to test HTML. */
async function renderAsync(element: ReactNode): Promise<string> {
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}

describe("web navigation shells", () => {
  it("keeps member and admin navigation separate", () => {
    expect(memberNavigation.map((item) => item.label)).toEqual([
      "Home",
      "Sessions",
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

  it("renders the active-order and restaurant sections from real data", async () => {
    const home = await MemberHomePage();
    const layout = MemberLayout({ children: home });
    const html = await renderAsync(layout);
    const textHtml = html.replaceAll("<!-- -->", "");

    expect(html).toContain("Active sessions");
    expect(html).toContain("Alpha group");
    expect(html).toContain("Restaurant voting");
    expect(textHtml).toContain("2 of 3 responded");
    expect(textHtml).toContain("Good morning, Mia");
    expect(html).toContain("Browse restaurants");
    expect(html).not.toContain("Friday lunch");
  });

  it("threads the signed-in profile fields into the member header", async () => {
    const home = await MemberHomePage();
    const layout = MemberLayout({ children: home });
    const html = await renderAsync(layout);

    expect(html).toContain(
      'aria-label="Open profile menu for Mia Tan (mia@example.com)"',
    );
    expect(html).toContain('class="member-shell member-shell--compact"');
  });

  it("threads the signed-in profile fields into the admin header", async () => {
    const home = AdminHomePage();
    const layout = AdminLayout({ children: home });
    const html = await renderAsync(layout);

    expect(html).toContain(
      'aria-label="Open profile menu for Mia Tan (mia@example.com)"',
    );
  });

  it("renders the real orders list from the runtime", async () => {
    const page = await OrdersPage();
    const layout = MemberLayout({ children: page });
    const html = await renderAsync(layout);
    const textHtml = html.replaceAll("<!-- -->", "");

    expect(html).toContain("Alpha group");
    expect(html).toContain("Restaurant voting");
    expect(textHtml).toContain("2 of 3 responded");
    expect(html).toContain("Active");
    expect(html).toContain("Past");
    expect(html).toContain("check past sessions");
    expect(html).not.toContain('href="#orders-top"');
    expect(html).not.toContain(">Filter<");
    expect(html).not.toContain("Friday lunch");
  });

  it("shows the Favorites empty state when the member has none", async () => {
    const html = renderToStaticMarkup(await FavoritesPage());

    expect(html).toContain("Build your quick picks");
    expect(html).toContain("Browse restaurants");
    expect(html).not.toContain("#1");
  });

  it("shows every real membership with its exact role", async () => {
    const html = renderToStaticMarkup(await GroupsPage());

    expect(html).toContain("Your groups");
    expect(html).toContain("Pick a group to continue.");
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
    const layout = AdminLayout({ children: <AdminHomePage /> });
    const html = await renderAsync(layout);

    expect(html).toContain("Admin overview");
    expect(html).toContain("Pending decisions");
    expect(html).toContain("Catalog coverage");
    expect(html).toContain("Refresh failures");
    expect(html).not.toContain("Nothing needs your attention yet");
    expect(html).toContain('aria-label="Admin navigation"');
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("keeps protected children out of identity-loading shells", () => {
    const member = renderToStaticMarkup(<MemberShellAccessLoading />);
    const admin = renderToStaticMarkup(<AdminShellAccessLoading />);

    expect(member).toContain("Checking your access");
    expect(admin).toContain("Checking your access");
    expect(`${member}${admin}`).not.toContain("protected child");
  });

  it("renders the catalog, imports, refresh queue, and audit workspaces", async () => {
    const html = [
      await CatalogPage(),
      await ImportsPage(),
      <RefreshPage key="refresh" />,
      <AuditPage key="audit" />,
    ]
      .map((page) => renderToStaticMarkup(page))
      .join("\n");

    expect(html).toContain("Published restaurants");
    expect(html).toContain("Import catalog");
    expect(html).toContain("Weekly refresh queue");
    expect(html).toContain("Permission override changed");
  });
});
