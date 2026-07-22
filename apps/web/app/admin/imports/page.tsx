import { ClipboardList } from "lucide-react";

import { EmptyPage } from "../../components/empty-page";

/** Shows the imports destination before reviewed files are uploaded. */
export default function ImportsPage() {
  return (
    <EmptyPage
      description="Uploaded import drafts and validation results will appear here."
      emptyTitle="No import drafts yet"
      icon={ClipboardList}
      title="Imports"
    />
  );
}
