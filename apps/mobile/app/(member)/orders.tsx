import { ShoppingBag } from "lucide-react-native";

import { ShellScreen } from "../../src/components/shell-screen";

/** Shows the orders destination while truthfully communicating that no orders exist. */
export default function OrdersScreen() {
  return (
    <ShellScreen
      description="Orders you join or organize will appear here."
      emptyTitle="No orders yet"
      icon={ShoppingBag}
      title="Orders"
    />
  );
}
