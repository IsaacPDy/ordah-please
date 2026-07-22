import { RefreshCw } from "lucide-react";

import { EmptyPage } from "../../components/empty-page";

/** Shows the refresh destination before supervised catalog work exists. */
export default function RefreshPage() {
  return (
    <EmptyPage
      description="Weekly refresh work and failures will appear here."
      emptyTitle="No refresh work yet"
      icon={RefreshCw}
      title="Refresh queue"
    />
  );
}
