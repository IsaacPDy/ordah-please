import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MemberAccessState } from "./member-access-state";

describe("MemberAccessState", () => {
  it("keeps restaurant discovery but hides invented group activity on Home", () => {
    const markup = renderToStaticMarkup(
      <MemberAccessState hasMemberships={false} surface="home">
        <section>Restaurants</section>
      </MemberAccessState>,
    );

    expect(markup).toContain("Restaurants");
    expect(markup).not.toContain("Friday lunch");
  });

  it.each([
    ["orders", "No group orders yet"],
    ["groups", "You have not joined a group yet"],
  ] as const)("renders the honest %s no-membership state", (surface, copy) => {
    const markup = renderToStaticMarkup(
      <MemberAccessState hasMemberships={false} surface={surface}>
        <p>Invented member data</p>
      </MemberAccessState>,
    );

    expect(markup).toContain(copy);
    expect(markup).not.toContain("Invented member data");
  });

  it("keeps account-owned Favorites available without a group", () => {
    const markup = renderToStaticMarkup(
      <MemberAccessState hasMemberships={false} surface="favorites">
        <section>Favorites</section>
      </MemberAccessState>,
    );

    expect(markup).toContain("Favorites");
  });

  it("preserves the connected surface for an account with memberships", () => {
    const markup = renderToStaticMarkup(
      <MemberAccessState hasMemberships surface="orders">
        <p>Connected order surface</p>
      </MemberAccessState>,
    );

    expect(markup).toContain("Connected order surface");
  });
});
