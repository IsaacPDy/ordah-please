import { describe, expect, it } from "vitest";
import {
  receiptAccess,
  canViewReceipt,
  requireReceiptWrite,
  parseReceiptDetails,
  validateReceiptFile,
} from "./receipt-policy";

const context = {
  role: "member" as const,
  userId: "member",
  participantIds: ["member", "other"],
  enabled: true,
  submitterIds: ["member"],
};
describe("receipt permissions", () => {
  it("allows selected participants but not unselected Managers or admins", () => {
    expect(receiptAccess(context).canSubmit).toBe(true);
    expect(
      receiptAccess({ ...context, role: "manager", submitterIds: [] })
        .canSubmit,
    ).toBe(false);
    expect(() => receiptAccess({ ...context, role: null })).toThrow();
  });
  it("rejects removed participants and disabled writes without hiding receipts", () => {
    expect(receiptAccess({ ...context, participantIds: [] }).canSubmit).toBe(
      false,
    );
    expect(receiptAccess({ ...context, enabled: false }).canSubmit).toBe(false);
    expect(
      canViewReceipt(context, { mode: "group", participantUserId: null }),
    ).toBe(true);
    expect(() =>
      requireReceiptWrite(
        { ...context, enabled: false },
        { mode: "group", participantUserId: null, uploadedByUserId: "member" },
      ),
    ).toThrow();
  });
  it("keeps individual receipts private while Managers audit all", () => {
    const receipt = { mode: "individual" as const, participantUserId: "other" };
    expect(canViewReceipt(context, receipt)).toBe(false);
    expect(canViewReceipt({ ...context, role: "manager" }, receipt)).toBe(true);
    expect(
      canViewReceipt(
        { ...context, participantIds: [] },
        { mode: "group", participantUserId: null },
      ),
    ).toBe(false);
  });
  it("allows owner assignment but rejects writing another person's individual receipt", () => {
    const receipt = {
      mode: "individual" as const,
      participantUserId: "other",
      uploadedByUserId: "member",
    };
    expect(() => requireReceiptWrite(context, receipt)).toThrow();
    expect(() =>
      requireReceiptWrite({ ...context, role: "owner" }, receipt),
    ).not.toThrow();
    expect(() =>
      requireReceiptWrite(context, {
        ...receipt,
        participantUserId: "member",
        uploadedByUserId: "other",
      }),
    ).toThrow();
  });
});
describe("receipt input", () => {
  it("accepts centavos and rejects unsafe or invalid amounts and long notes", () => {
    expect(
      parseReceiptDetails({ amountCentavos: 12345, note: " Lunch " }),
    ).toEqual({ amountCentavos: 12345, note: "Lunch" });
    for (const amountCentavos of [
      0,
      -1,
      1.5,
      NaN,
      Number.MAX_SAFE_INTEGER + 1,
      "100",
    ])
      expect(() => parseReceiptDetails({ amountCentavos })).toThrow();
    expect(() =>
      parseReceiptDetails({ amountCentavos: 1, note: "x".repeat(2001) }),
    ).toThrow();
  });
  it("permits supported files up to 10 MB only", () => {
    expect(() =>
      validateReceiptFile("image/png", 10 * 1024 * 1024),
    ).not.toThrow();
    expect(() => validateReceiptFile("image/svg+xml", 1)).toThrow();
    expect(() =>
      validateReceiptFile("application/pdf", 10 * 1024 * 1024 + 1),
    ).toThrow();
  });
});
