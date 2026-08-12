import {
  apiFailure,
  apiSuccess,
  parseCsvHeader,
  parseCsvRow,
  PublicApiError,
  type CsvRow,
} from "@ordah-please/contracts";
import type { CatalogImportSummary } from "@ordah-please/domain";

import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";

import { catalogRuntime } from "./catalog-runtime";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const CSV_CONTENT_TYPES = new Set([
  "application/csv",
  "application/vnd.ms-excel",
  "text/csv",
]);

type MaybePromise<Value> = Value | Promise<Value>;

export interface ImportCsvHandlerDependencies {
  readonly importCatalog: (
    userId: string,
    sourceFileName: string,
    rows: readonly CsvRow[],
    warnings: readonly { row: number; reason: string }[],
  ) => MaybePromise<CatalogImportSummary>;
  readonly loadIdentity: (
    session: VerifiedSession,
  ) => MaybePromise<AppIdentity>;
  readonly verifySession: (request: Request) => MaybePromise<VerifiedSession>;
}

interface ParsedCsv {
  readonly rows: readonly Record<string, string>[];
  readonly warnings: readonly { row: number; reason: string }[];
}

/** Splits a raw CSV string into header-validated rows plus per-row warnings. */
function parseCsvText(text: string): ParsedCsv {
  const allLines = splitCsvLines(text);
  const nonEmpty = allLines.filter((line) => line.length > 0);
  if (nonEmpty.length === 0) {
    throw new PublicApiError("INVALID_INPUT", "CSV is empty.");
  }
  const header = nonEmpty[0]!;
  parseCsvHeader(header);

  const rows: Record<string, string>[] = [];
  const warnings: { row: number; reason: string }[] = [];

  for (let i = 1; i < nonEmpty.length; i += 1) {
    const cells = nonEmpty[i]!;
    if (cells.length !== header.length) {
      warnings.push({
        row: i + 1,
        reason: `Expected ${header.length} cells, got ${cells.length}.`,
      });
      continue;
    }
    const record: Record<string, string> = {};
    header.forEach((name, idx) => {
      record[name] = cells[idx] ?? "";
    });
    rows.push(record);
  }

  return { rows, warnings };
}

/** Splits CSV text into lines, then each line into cells, honoring double-quoted cells with embedded commas and newlines. */
function splitCsvLines(text: string): string[][] {
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentCell = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentCell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      currentCell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      currentLine.push(currentCell);
      currentCell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      currentLine.push(currentCell);
      lines.push(currentLine);
      currentLine = [];
      currentCell = "";
      i += 1;
      continue;
    }
    currentCell += ch;
    i += 1;
  }
  if (currentCell.length > 0 || currentLine.length > 0) {
    currentLine.push(currentCell);
    lines.push(currentLine);
  }
  return lines;
}

/** Creates the CSV upload endpoint with explicit authentication and storage boundaries. */
export function createImportCsvHandler(
  dependencies: ImportCsvHandlerDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      const session = await dependencies.verifySession(request);
      const identity = await dependencies.loadIdentity(session);
      if (!identity.isPlatformAdmin) {
        throw new PublicApiError("FORBIDDEN", "Platform Admin only.");
      }

      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        throw new PublicApiError("INVALID_INPUT", "Missing file field.");
      }
      if (file.size > MAX_FILE_BYTES) {
        throw new PublicApiError(
          "INVALID_INPUT",
          "File too large. CSVs must be under 5MB.",
        );
      }
      if (
        !file.name.toLowerCase().endsWith(".csv") ||
        !CSV_CONTENT_TYPES.has(file.type.toLowerCase())
      ) {
        throw new PublicApiError("INVALID_INPUT", "Please upload a .csv file.");
      }

      const text = await file.text();
      let parsed: ParsedCsv;
      try {
        parsed = parseCsvText(text);
      } catch (error) {
        if (error instanceof PublicApiError) throw error;
        throw new PublicApiError(
          "INVALID_INPUT",
          error instanceof Error ? error.message : "Couldn't read this CSV.",
        );
      }

      const typedRows: CsvRow[] = [];
      const warnings = [...parsed.warnings];
      parsed.rows.forEach((record, idx) => {
        try {
          typedRows.push(parseCsvRow(record));
        } catch (err) {
          warnings.push({ row: idx + 2, reason: (err as Error).message });
        }
      });
      if (typedRows.length === 0) {
        throw new PublicApiError(
          "INVALID_INPUT",
          "No valid rows found in this CSV.",
        );
      }

      const result = await dependencies.importCatalog(
        identity.userId,
        file.name,
        typedRows,
        warnings,
      );
      return Response.json(apiSuccess(result));
    } catch (error) {
      if (error instanceof PublicApiError) {
        return Response.json(apiFailure(error), {
          status: PUBLIC_ERROR_STATUS[codeOf(error)],
        });
      }
      return Response.json(apiFailure(error), { status: 500 });
    }
  };
}

/** Runtime CSV upload handler backed by the authenticated catalog repository. */
export const importCsvHandler = createImportCsvHandler({
  importCatalog: (userId, sourceFileName, rows, warnings) =>
    catalogRuntime.catalog.importCatalog(
      userId,
      sourceFileName,
      rows,
      warnings,
    ),
  loadIdentity: catalogRuntime.loadIdentity,
  verifySession: catalogRuntime.verifySession,
});

const PUBLIC_ERROR_STATUS = {
  CONFLICT: 409,
  FORBIDDEN: 403,
  INTERNAL_FAILURE: 500,
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  UNAUTHENTICATED: 401,
  UNAVAILABLE: 503,
} as const;

function codeOf(error: PublicApiError): keyof typeof PUBLIC_ERROR_STATUS {
  return error.code;
}
