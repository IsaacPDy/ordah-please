import { designTokens } from "@ordah-please/ui";

/** Pairs approved colors with shell surfaces at accessible text and icon contrast. */
export const shellColors = {
  activeNavigation: designTokens.colors.textPrimary,
  brand: designTokens.colors.primaryStrong,
  iconOnSurface: designTokens.colors.primaryStrong,
  primaryAction: designTokens.colors.primaryStrong,
} as const;
