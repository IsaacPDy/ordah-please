import { Stack } from "expo-router";

/** Provides the root mobile navigation stack for all future Expo Router screens. */
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
