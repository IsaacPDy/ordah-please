/** Result returned after parsing and persisting an uploaded catalog CSV. */
export type CatalogImportWarning = Readonly<{
  row: number;
  reason: string;
}>;

export type CatalogImportSummary = Readonly<{
  restaurantsAdded: number;
  restaurantsUpdated: number;
  itemsAdded: number;
  itemsSkipped: number;
  warnings: readonly CatalogImportWarning[];
}>;
