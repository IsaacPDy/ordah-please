/** File restrictions shared by catalog selection and the authenticated upload endpoint. */
export const CATALOG_FILE_ACCEPT =
  ".csv,.xls,.xlsx,text/csv,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const MAX_CATALOG_FILE_BYTES = 5 * 1024 * 1024;

const types: Record<string, readonly string[]> = {
  csv: ["", "text/csv", "application/csv", "application/vnd.ms-excel"],
  xls: ["", "application/vnd.ms-excel", "application/octet-stream"],
  xlsx: [
    "",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
  ],
};

export function catalogFileError(
  file: Pick<File, "name" | "size" | "type">,
): string | null {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (!types[extension]?.includes(file.type.toLowerCase())) {
    return "Please upload a CSV or Excel file (.csv, .xls, or .xlsx).";
  }
  if (file.size > MAX_CATALOG_FILE_BYTES) {
    return "File too large. CSV and Excel files must be 5MB or smaller.";
  }
  return null;
}

/** Reads CSV directly or converts the first Excel worksheet into the same catalog format. */
export async function readCatalogFile(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith(".csv")) return file.text();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isXlsx = file.name.toLowerCase().endsWith(".xlsx");
  const signature = isXlsx
    ? [0x50, 0x4b, 0x03, 0x04]
    : [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (!signature.every((value, index) => bytes[index] === value)) {
    throw new Error(
      "Couldn't read this Excel file. Check the format and try again.",
    );
  }
  const { read, utils } = await import("xlsx");
  const workbook = read(bytes, { type: "array", sheets: 0 });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) throw new Error("The Excel file has no worksheets.");
  return utils.sheet_to_csv(sheet);
}
