import { describe, expect, it } from "vitest";

import { parseAddUserToGroupRequest } from "./user-requests.js";

describe("parseAddUserToGroupRequest", () => {
  it("accepts a well-formed body", () => {
    expect(parseAddUserToGroupRequest({ groupId: "group-1" })).toEqual({
      groupId: "group-1",
    });
  });

  it("rejects a missing groupId", () => {
    expect(() => parseAddUserToGroupRequest({})).toThrow(TypeError);
  });

  it("rejects an empty groupId", () => {
    expect(() => parseAddUserToGroupRequest({ groupId: "   " })).toThrow(
      TypeError,
    );
  });

  it("rejects a non-string groupId", () => {
    expect(() => parseAddUserToGroupRequest({ groupId: 42 })).toThrow(TypeError);
  });

  it("rejects unknown keys", () => {
    expect(() =>
      parseAddUserToGroupRequest({ groupId: "group-1", extra: "ignored" }),
    ).toThrow(TypeError);
  });
});
