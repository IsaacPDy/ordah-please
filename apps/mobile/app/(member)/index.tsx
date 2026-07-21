import { CircleCheck } from "lucide-react-native";

import { ShellScreen } from "../../src/components/shell-screen";

/** Shows the member home shell without inventing an order before real order data exists. */
export default function HomeScreen() {
  return (
    <ShellScreen
      description="Active orders and restaurant updates will appear here."
      emptyTitle="Nothing needs your attention yet"
      icon={CircleCheck}
      title="Your home"
    />
  );
}
