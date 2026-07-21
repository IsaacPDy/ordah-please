import { describe, expect, it } from "vitest";

import { formatCentavos, parseCentavos } from "./money.js";

describe("parseCentavos", () => {
  it("accepts a non-negative integer centavo amount", () => {
    expect(parseCentavos(12_345)).toBe(12_345);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, -1, 2 ** 53])(
    "rejects unsafe or non-centavo numeric value %s",
    (value) => {
      expect(() => parseCentavos(value)).toThrowError(
        new TypeError("Centavos must be a non-negative safe integer."),
      );
    },
  );

  it("rejects negative zero instead of admitting two zero representations", () => {
    expect(() => parseCentavos(-0)).toThrowError(
      new TypeError("Centavos must be a non-negative safe integer."),
    );
  });
});

describe("formatCentavos", () => {
  it("formats integer centavos as Philippine pesos at the display boundary", () => {
    expect(formatCentavos(parseCentavos(123_456))).toBe("₱1,234.56");
  });

  it.each([
    [0, "₱0.00"],
    [1, "₱0.01"],
    [99, "₱0.99"],
    [100, "₱1.00"],
    [Number.MAX_SAFE_INTEGER, "₱90,071,992,547,409.91"],
  ] as const)("preserves exact integer cents for %i", (value, expected) => {
    expect(formatCentavos(parseCentavos(value))).toBe(expected);
  });
});
