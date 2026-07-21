import { designTokens } from "@ordah-please/ui";
import {
  configureFonts,
  MD3LightTheme,
  type MD3Theme,
} from "react-native-paper";

/** Maps the shared design language onto React Native Paper without moving product rules into the UI. */
export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    background: designTokens.colors.canvas,
    error: designTokens.colors.error,
    onBackground: designTokens.colors.textPrimary,
    onPrimary: designTokens.colors.onPrimary,
    onPrimaryContainer: designTokens.colors.textPrimary,
    onSurface: designTokens.colors.textPrimary,
    onSurfaceVariant: designTokens.colors.textSecondary,
    outline: designTokens.colors.border,
    primary: designTokens.colors.primary,
    primaryContainer: designTokens.colors.supportSurface,
    secondary: designTokens.colors.primaryStrong,
    surface: designTokens.colors.surface,
    surfaceVariant: designTokens.colors.supportSurface,
  },
  fonts: configureFonts({
    config: {
      fontFamily: "NunitoSans_400Regular",
    },
  }),
  roundness: designTokens.radii.field,
};
