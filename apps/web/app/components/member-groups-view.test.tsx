// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MemberGroupsView } from "./member-groups-view";
it("offers setup only to group leaders and keeps exact recent restaurant names", () => {
  const base = { memberCount: 2, memberPreviews: [{ displayName: "Mia" }] };
  render(
    <MemberGroupsView
      groups={[
        { ...base, groupId: "g1", name: "Team", role: "manager" },
        { ...base, groupId: "g2", name: "Friends", role: "member" },
      ]}
      history={[
        {
          orderId: "o1",
          groupId: "g1",
          groupName: "Team",
          restaurantName: "KFC – Naga Plaza",
          state: "ordered",
          completedAt: new Date("2026-10-05T00:00:00Z"),
          deadline: null,
          participants: [],
          participantsTotal: 2,
          participantsVoted: 0,
        },
      ]}
    />,
  );
  expect(
    screen.getAllByRole("link", { name: "Start group order" }),
  ).toHaveLength(1);
  expect(
    screen
      .getByRole("link", { name: "Start group order" })
      .getAttribute("href"),
  ).toBe("/orders/new?groupId=g1");
  expect(
    screen.getByRole("link", { name: "View group" }).getAttribute("href"),
  ).toBe("/groups/g2");
  expect(
    screen
      .getByRole("link", { name: /Last ordered KFC – Naga Plaza/ })
      .getAttribute("href"),
  ).toBe("/orders/o1");
});
