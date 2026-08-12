import { catalogRuntime } from "../../../src/features/catalog/catalog-runtime";
import { AdminPage } from "../../components/admin-page";
import { RecentImportsTable } from "./recent-imports-table";
import { UploadForm } from "./upload-form";

/** Platform Admin upload entry point for catalog CSVs collected externally. */
export default async function ImportsPage() {
  const recentImports = await catalogRuntime.catalog.listRecentImports();

  return (
    <AdminPage
      description="Upload a CSV of restaurants and menu items collected via Codex Computer Use. Restaurants go live immediately."
      eyebrow="Restaurant data"
      title="Import catalog"
    >
      <section className="admin-panel">
        <UploadForm />
      </section>
      <section className="admin-panel">
        <h2>Recent imports</h2>
        <RecentImportsTable imports={recentImports} />
      </section>
    </AdminPage>
  );
}
