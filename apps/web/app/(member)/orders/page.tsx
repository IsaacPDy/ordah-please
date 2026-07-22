import { ShoppingBag } from "lucide-react";

import { EmptyPage } from "../../components/empty-page";

/** Shows the member order destination before real orders exist. */
export default function OrdersPage() {
  return (
    <EmptyPage
      description="Orders you join or organize will appear here."
      emptyTitle="No orders yet"
      icon={ShoppingBag}
      title="Orders"
    />
  );
}
