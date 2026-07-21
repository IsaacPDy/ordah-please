import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import AdminHomePage from "./admin/page";
import MemberLayout from "./(member)/layout";
import MemberHomePage from "./(member)/page";
import { adminNavigation, memberNavigation } from "./shell-navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("web navigation shells", () => {
  it("keeps member and admin navigation separate", () => {
    expect(memberNavigation.map((item) => item.label)).toEqual([
      "Home",
      "Orders",
      "Favorites",
      "Team",
    ]);
    expect(adminNavigation.map((item) => item.label)).toEqual([
      "Overview",
      "Catalog",
      "Imports",
      "Refresh queue",
      "Access requests",
      "Audit log",
    ]);
    expect(memberNavigation).not.toBe(adminNavigation);
  });

  it("renders an honest member empty state", () => {
    const html = renderToStaticMarkup(
      <MemberLayout>
        <MemberHomePage />
      </MemberLayout>,
    );

    expect(html).toContain("ordah please");
    expect(html).toContain("Nothing needs your attention yet");
    expect(html).not.toContain("Friday lunch");
  });

  it("renders a distinct admin shell entry state", () => {
    const html = renderToStaticMarkup(<AdminHomePage />);

    expect(html).toContain("Admin overview");
    expect(html).toContain("No admin work is waiting");
    expect(html).not.toContain("Nothing needs your attention yet");
  });
});
