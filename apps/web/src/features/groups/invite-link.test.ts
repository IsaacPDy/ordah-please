import { describe, expect, it } from "vitest";

import { hashPublicValue, mintInviteLink } from "./invite-link";

describe("mintInviteLink", () => {
  it("produces a public value, a hash, and a prefix", () => {
    const link = mintInviteLink();

    expect(link.publicValue).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(link.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(link.tokenPrefix).toMatch(/^[A-Za-z0-9_-]{8}$/);
  });

  it("produces unique values on subsequent calls", () => {
    const a = mintInviteLink();
    const b = mintInviteLink();

    expect(a.publicValue).not.toBe(b.publicValue);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it("prefix is a substring of the public value", () => {
    const link = mintInviteLink();

    expect(link.publicValue.startsWith(link.tokenPrefix)).toBe(true);
  });

  it("hash matches hashPublicValue for the same input", () => {
    const link = mintInviteLink();

    expect(hashPublicValue(link.publicValue)).toBe(link.tokenHash);
  });
});

describe("hashPublicValue", () => {
  it("returns the sha256 hex digest of the input", () => {
    expect(hashPublicValue("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
