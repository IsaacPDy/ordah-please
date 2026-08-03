import { render } from "@testing-library/react-native";
import React from "react";

import { HomeAdminCard } from "../src/features/access/home-admin-card";

describe("HomeAdminCard", () => {
  it("renders nothing when the user is not a platform admin", async () => {
    const screen = await render(
      <HomeAdminCard
        isPlatformAdmin={false}
        pendingCount={0}
        onOpen={() => undefined}
      />,
    );

    expect(screen.toJSON()).toBeNull();
  });

  it("announces the pending count for a platform admin", async () => {
    const onOpen = jest.fn();
    const screen = await render(
      <HomeAdminCard isPlatformAdmin pendingCount={3} onOpen={onOpen} />,
    );

    expect(screen.getByText(/platform-admin requests/i)).toBeTruthy();
    expect(screen.getByText(/3 pending/i)).toBeTruthy();
  });

  it("reports no pending requests when the count is zero", async () => {
    const screen = await render(
      <HomeAdminCard
        isPlatformAdmin
        pendingCount={0}
        onOpen={() => undefined}
      />,
    );

    expect(screen.getByText(/no pending requests/i)).toBeTruthy();
  });
});
