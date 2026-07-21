import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

/** Renders the intentionally minimal Android entry screen until feature UI is implemented. */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text>ordah please</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
