import { describe, expect, it } from "vitest";

import {
  parseAcceptInviteLinkRequest,
  parseCreateGroupRequest,
  parseRenameGroupRequest,
  parseRotateInviteLinkResponse,
} from "./group-requests.js";

describe("parseRenameGroupRequest", () => {
  it("accepts a non-empty name", () => {
    expect(parseRenameGroupRequest({ name: "Friends" })).toEqual({
      name: "Friends",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseRenameGroupRequest({ name: "  Friends  " })).toEqual({
      name: "Friends",
    });
  });

  it("rejects empty input", () => {
    expect(() => parseRenameGroupRequest({ name: "" })).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseRenameGroupRequest({ name: "Friends", extra: true }),
    ).toThrow(/unknown field/i);
  });
});

describe("parseCreateGroupRequest", () => {
  it("accepts a name and owner id", () => {
    expect(
      parseCreateGroupRequest({ name: "Friends", ownerId: "user-1" }),
    ).toEqual({ name: "Friends", ownerId: "user-1" });
  });

  it("rejects an empty name", () => {
    expect(() =>
      parseCreateGroupRequest({ name: "", ownerId: "user-1" }),
    ).toThrow();
  });

  it("rejects a missing owner id", () => {
    expect(() => parseCreateGroupRequest({ name: "Friends" })).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseCreateGroupRequest({
        name: "Friends",
        ownerId: "user-1",
        extra: true,
      }),
    ).toThrow(/unknown field/i);
  });
});

describe("parseRotateInviteLinkResponse", () => {
  it("accepts a public value and prefix", () => {
    expect(
      parseRotateInviteLinkResponse({
        publicValue: "abc12345_xyz",
        tokenPrefix: "abc12345",
      }),
    ).toEqual({ publicValue: "abc12345_xyz", tokenPrefix: "abc12345" });
  });

  it("rejects missing prefix", () => {
    expect(() =>
      parseRotateInviteLinkResponse({ publicValue: "abc12345_xyz" }),
    ).toThrow();
  });
});

describe("parseAcceptInviteLinkRequest", () => {
  it("accepts a public value", () => {
    expect(
      parseAcceptInviteLinkRequest({ publicValue: "abc12345_xyz" }),
    ).toEqual({ publicValue: "abc12345_xyz" });
  });

  it("rejects an empty public value", () => {
    expect(() => parseAcceptInviteLinkRequest({ publicValue: "" })).toThrow();
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseAcceptInviteLinkRequest({
        publicValue: "abc12345_xyz",
        groupId: "group-1",
      }),
    ).toThrow(/unknown field/i);
  });
});
