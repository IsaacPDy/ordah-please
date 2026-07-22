import { describe, expect, it } from "vitest";

import { designTokens } from "./tokens";

describe("designTokens", () => {
  it("exposes the approved semantic colors", () => {
    expect(designTokens.colors).toEqual({
      border: "#DDE8E1",
      canvas: "#F8FBF9",
      error: "#B42318",
      onPrimary: "#FFFFFF",
      primary: "#0AAE5B",
      primaryStrong: "#078847",
      supportSurface: "#EFFAF3",
      surface: "#FFFFFF",
      textPrimary: "#172019",
      textSecondary: "#667069",
      warning: "#B86B00",
    });
  });

  it("uses the approved four-point spacing scale", () => {
    expect(designTokens.spacing).toEqual({
      xxs: 4,
      xs: 8,
      sm: 12,
      md: 16,
      lg: 24,
      xl: 32,
      xxl: 40,
    });
  });

  it("uses the approved radii and minimum touch target", () => {
    expect(designTokens.radii).toEqual({
      card: 16,
      compact: 8,
      field: 12,
      majorCard: 24,
      pill: 999,
    });
    expect(designTokens.touchTarget.minimum).toBe(44);
  });

  it("uses Nunito Sans and tabular numerals for operational values", () => {
    expect(designTokens.typography.family).toBe("Nunito Sans");
    expect(designTokens.typography.numeric.fontVariant).toEqual([
      "tabular-nums",
    ]);
  });
});
