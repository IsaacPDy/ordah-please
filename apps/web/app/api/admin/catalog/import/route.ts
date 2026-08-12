import { importCsvHandler } from "../../../../../src/features/catalog/csv-upload-handler";

/** Lets a Platform Admin upload a catalog CSV. */
export function POST(request: Request): Promise<Response> {
  return importCsvHandler(request);
}
