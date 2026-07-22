import { designTokens } from "@ordah-please/ui";
import { describe, expect, it } from "vitest";

import { shellColors } from "./shell-colors";

/** Converts a hex color channel to linear light so contrast assertions match WCAG math. */
function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

/** Calculates relative luminance for an opaque six-digit hex color. */
function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => channelToLinear(Number.parseInt(channel, 16)));

  if (!channels || channels.length !== 3) {
    throw new Error(`Expected an opaque six-digit hex color, received ${hex}`);
  }

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/** Calculates the WCAG contrast ratio between two opaque hex colors. */
function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("shellColors", () => {
  it("keeps prominent text and icons readable on white surfaces", () => {
    expect(
      contrastRatio(shellColors.brand, designTokens.colors.surface),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(shellColors.iconOnSurface, designTokens.colors.surface),
    ).toBeGreaterThanOrEqual(3);
  });

  it("keeps selected navigation labels readable on mint", () => {
    expect(
      contrastRatio(
        shellColors.activeNavigation,
        designTokens.colors.supportSurface,
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
