import {
  NunitoSans_400Regular,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  useFonts,
} from "@expo-google-fonts/nunito-sans";
import { Stack } from "expo-router";
import { PaperProvider } from "react-native-paper";

import { paperTheme } from "../src/theme/paper-theme";

/** Provides fonts, shared Paper styling, and the root navigation boundary for the mobile app. */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    NunitoSans_400Regular,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <PaperProvider theme={paperTheme}>
      <Stack screenOptions={{ headerShown: false }} />
    </PaperProvider>
  );
}
