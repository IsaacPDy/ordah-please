/** Defines the approved visual language once so every client communicates with the same hierarchy. */
export const designTokens = {
  colors: {
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
  },
  elevation: {
    raised: "0 12px 30px rgba(23, 32, 25, 0.08)",
  },
  radii: {
    card: 16,
    compact: 8,
    field: 12,
    majorCard: 24,
    pill: 999,
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  touchTarget: {
    minimum: 44,
  },
  typography: {
    family: "Nunito Sans",
    numeric: {
      fontVariant: ["tabular-nums"],
    },
    size: {
      body: 16,
      caption: 12,
      display: 32,
      label: 14,
      title: 24,
    },
    weight: {
      bold: 700,
      regular: 400,
      semibold: 600,
    },
  },
} as const;

export type DesignTokens = typeof designTokens;
