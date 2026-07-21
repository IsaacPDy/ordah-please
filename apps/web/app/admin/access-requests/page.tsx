import { UserRoundCheck } from "lucide-react";

import { EmptyPage } from "../../components/empty-page";

/** Shows the access-review destination before account workflows are connected. */
export default function AccessRequestsPage() {
  return (
    <EmptyPage
      description="Admin-access requests requiring a decision will appear here."
      emptyTitle="No access requests"
      icon={UserRoundCheck}
      title="Access requests"
    />
  );
}
