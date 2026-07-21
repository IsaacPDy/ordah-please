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
});

describe("formatCentavos", () => {
  it("formats integer centavos as Philippine pesos at the display boundary", () => {
    expect(formatCentavos(parseCentavos(123_456))).toBe("₱1,234.56");
  });
});
