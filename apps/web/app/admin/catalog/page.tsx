import { Store } from "lucide-react";

import { EmptyPage } from "../../components/empty-page";

/** Shows the catalog destination before reviewed restaurants are published. */
export default function CatalogPage() {
  return (
    <EmptyPage
      description="Published restaurants and branches will appear here."
      emptyTitle="No catalog records yet"
      icon={Store}
      title="Catalog"
    />
  );
}
