import "@fontsource-variable/nunito-sans/wght.css";
import { designTokens } from "@ordah-please/ui";
import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  description: "Private food-order planning for friends.",
  title: "ordah please",
};

const webTokenStyle = {
  "--color-border": designTokens.colors.border,
  "--color-canvas": designTokens.colors.canvas,
  "--color-error": designTokens.colors.error,
  "--color-on-primary": designTokens.colors.onPrimary,
  "--color-primary": designTokens.colors.primary,
  "--color-primary-strong": designTokens.colors.primaryStrong,
  "--color-support": designTokens.colors.supportSurface,
  "--color-surface": designTokens.colors.surface,
  "--color-text": designTokens.colors.textPrimary,
  "--color-text-secondary": designTokens.colors.textSecondary,
  "--color-warning": designTokens.colors.warning,
  "--font-family": designTokens.typography.family,
  "--font-size-body": `${designTokens.typography.size.body}px`,
  "--font-size-caption": `${designTokens.typography.size.caption}px`,
  "--font-size-display": `${designTokens.typography.size.display}px`,
  "--font-size-label": `${designTokens.typography.size.label}px`,
  "--font-size-title": `${designTokens.typography.size.title}px`,
  "--radius-card": `${designTokens.radii.card}px`,
  "--radius-compact": `${designTokens.radii.compact}px`,
  "--radius-field": `${designTokens.radii.field}px`,
  "--radius-major-card": `${designTokens.radii.majorCard}px`,
  "--shadow-raised": designTokens.elevation.raised,
  "--space-1": `${designTokens.spacing.xxs}px`,
  "--space-2": `${designTokens.spacing.xs}px`,
  "--space-3": `${designTokens.spacing.sm}px`,
  "--space-4": `${designTokens.spacing.md}px`,
  "--space-6": `${designTokens.spacing.lg}px`,
  "--space-8": `${designTokens.spacing.xl}px`,
  "--space-10": `${designTokens.spacing.xxl}px`,
  "--touch-target": `${designTokens.touchTarget.minimum}px`,
} as CSSProperties;

/** Provides the shared HTML document wrapper for every web route. */
export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" style={webTokenStyle}>
      <body>{children}</body>
    </html>
  );
}
