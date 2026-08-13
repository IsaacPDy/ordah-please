"use client";

import { useRef, useState } from "react";

type UploadOutcome =
  | { kind: "idle" }
  | { kind: "uploading" }
  | {
      kind: "success";
      summary: string;
      warnings: readonly { row: number; reason: string }[];
    }
  | { kind: "error"; message: string };

interface SelectedFilePreview {
  readonly name: string;
  readonly restaurantName: string | null;
}

/** Client component that uploads a CSV to /api/admin/catalog/import and renders the outcome. */
export function UploadForm() {
  const [outcome, setOutcome] = useState<UploadOutcome>({ kind: "idle" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SelectedFilePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function readRestaurantPreview(
    file: File,
  ): Promise<SelectedFilePreview> {
    const text = await file.text();
    const firstNewline = text.indexOf("\n");
    const headerLine =
      firstNewline === -1 ? text : text.slice(0, firstNewline);
    const firstDataLine =
      firstNewline === -1
        ? ""
        : text.slice(firstNewline + 1).split(/\r?\n/, 1)[0] ?? "";
    const headers = splitCsvLine(headerLine);
    const cells = splitCsvLine(firstDataLine);
    const nameIndex = headers.indexOf("restaurant_name");
    const rawName = nameIndex >= 0 ? cells[nameIndex]?.trim() ?? "" : "";
    return {
      name: file.name,
      restaurantName: rawName.length > 0 ? rawName : null,
    };
  }

  /** Splits a single CSV line into cells, honoring double-quoted cells with embedded commas. */
  function splitCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]!;
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i += 1;
            continue;
          }
          inQuotes = false;
          continue;
        }
        current += ch;
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        continue;
      }
      if (ch === ",") {
        cells.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    cells.push(current);
    return cells;
  }

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreview(null);
    setPreviewError(null);
    if (file === null) {
      return;
    }
    readRestaurantPreview(file)
      .then((next) => {
        setPreview(next);
      })
      .catch(() => {
        setPreview({ name: file.name, restaurantName: null });
      });
  }

  function resetSelection() {
    setSelectedFile(null);
    setPreview(null);
    setPreviewError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setOutcome({ kind: "error", message: "Pick a CSV file first." });
      return;
    }
    setOutcome({ kind: "uploading" });
    const body = new FormData();
    body.append("file", selectedFile);
    try {
      const response = await fetch("/api/admin/catalog/import", {
        body,
        method: "POST",
      });
      const payload = (await response.json()) as
        | { ok: true; data: importSuccessShape }
        | { ok: false; error: { message: string } };
      if (response.ok && payload.ok) {
        const total =
          payload.data.restaurantsAdded + payload.data.restaurantsUpdated;
        setOutcome({
          kind: "success",
          summary: `Imported ${total} restaurant${total === 1 ? "" : "s"}, ${payload.data.itemsAdded} menu item${payload.data.itemsAdded === 1 ? "" : "s"}.`,
          warnings: payload.data.warnings,
        });
        resetSelection();
      } else {
        const message = payload.ok ? "Import failed." : payload.error.message;
        setOutcome({ kind: "error", message });
      }
    } catch (err) {
      setOutcome({ kind: "error", message: (err as Error).message });
    }
  }

  const previewName = preview?.restaurantName ?? selectedFile?.name ?? null;

  return (
    <form
      className="admin-upload"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <input
        ref={inputRef}
        accept=".csv,text/csv"
        aria-label="Upload CSV"
        className="admin-upload__input"
        name="file"
        onChange={(event) => {
          void handleFileSelected(event);
        }}
        type="file"
      />
      <div className="admin-upload__dropzone">
        {previewName === null ? (
          <>
            <span className="admin-upload__label">Upload CSV</span>
            <button
              className="admin-primary-button admin-upload__button"
              disabled={outcome.kind === "uploading"}
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              Upload
            </button>
          </>
        ) : (
          <div className="admin-upload__preview">
            <span className="admin-upload__preview-logo" aria-hidden="true">
              {initialsOf(previewName)}
            </span>
            <strong className="admin-upload__preview-name">
              {previewName}
            </strong>
            <button
              className="admin-primary-button"
              disabled={outcome.kind === "uploading"}
              type="submit"
            >
              {outcome.kind === "uploading"
                ? "Importing…"
                : "Import this Restaurant"}
            </button>
            <button
              className="admin-upload__reset"
              disabled={outcome.kind === "uploading"}
              onClick={resetSelection}
              type="button"
            >
              Choose a different file
            </button>
          </div>
        )}
      </div>

      {previewError !== null ? (
        <p className="admin-error" role="alert">
          {previewError}
        </p>
      ) : null}

      {outcome.kind === "success" ? (
        <div className="admin-success">
          <p>{outcome.summary}</p>
          {outcome.warnings.length > 0 ? (
            <details>
              <summary>{outcome.warnings.length} row(s) skipped</summary>
              <ul>
                {outcome.warnings.map((warning) => (
                  <li key={warning.row}>
                    Row {warning.row}: {warning.reason}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
      {outcome.kind === "error" ? (
        <p className="admin-error" role="alert">
          {outcome.message}
        </p>
      ) : null}
    </form>
  );
}

/** Returns up to two uppercase initials from a restaurant name for the placeholder logo. */
function initialsOf(name: string): string {
  const cleaned = name.trim();
  if (cleaned.length === 0) {
    return "?";
  }
  const parts = cleaned.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

interface importSuccessShape {
  readonly restaurantsAdded: number;
  readonly restaurantsUpdated: number;
  readonly itemsAdded: number;
  readonly itemsSkipped: number;
  readonly warnings: readonly { row: number; reason: string }[];
}
