import type { RecentCatalogImportRow } from "@ordah-please/db";

/** Renders the latest catalog uploads with their stored source details. */
export function RecentImportsTable({
  imports,
}: {
  readonly imports: readonly RecentCatalogImportRow[];
}) {
  if (imports.length === 0) {
    return <p className="admin-empty">No catalog imports yet.</p>;
  }

  return (
    <div className="admin-imports-table-wrap">
      <table className="admin-imports-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>File name</th>
            <th>Restaurants</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((catalogImport) => (
            <tr key={catalogImport.id}>
              <td>
                <time dateTime={catalogImport.createdAt.toISOString()}>
                  {catalogImport.createdAt.toLocaleString("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Manila",
                  })}
                </time>
              </td>
              <td>{catalogImport.sourceFileName ?? "Catalog CSV"}</td>
              <td>{catalogImport.restaurantCount}</td>
              <td>{formatStatus(catalogImport.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Converts a stored import status into a short visible label. */
function formatStatus(status: RecentCatalogImportRow["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
