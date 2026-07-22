import { History } from "lucide-react";

import { EmptyPage } from "../../components/empty-page";

/** Shows the audit destination before authorized product events are recorded. */
export default function AuditPage() {
  return (
    <EmptyPage
      description="Auditable catalog and access events will appear here."
      emptyTitle="No audit events yet"
      icon={History}
      title="Audit log"
    />
  );
}
