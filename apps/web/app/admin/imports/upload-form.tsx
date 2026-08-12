"use client";

import { useState } from "react";

type UploadOutcome =
  | { kind: "idle" }
  | { kind: "uploading" }
  | {
      kind: "success";
      summary: string;
      warnings: readonly { row: number; reason: string }[];
    }
  | { kind: "error"; message: string };

/** Client component that uploads a CSV to /api/admin/catalog/import and renders the outcome. */
export function UploadForm() {
  const [outcome, setOutcome] = useState<UploadOutcome>({ kind: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    if (!input) {
      setOutcome({ kind: "error", message: "Form is missing the file input." });
      return;
    }
    const file = input.files?.[0];
    if (!file) {
      setOutcome({ kind: "error", message: "Pick a CSV file first." });
      return;
    }
    setOutcome({ kind: "uploading" });
    const body = new FormData();
    body.append("file", file);
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
        form.reset();
      } else {
        const message = payload.ok ? "Import failed." : payload.error.message;
        setOutcome({ kind: "error", message });
      }
    } catch (err) {
      setOutcome({ kind: "error", message: (err as Error).message });
    }
  }

  return (
    <form
      className="admin-upload"
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <label className="admin-upload__dropzone">
        <span className="admin-upload__label">Upload CSV</span>
        <input
          accept=".csv,text/csv"
          aria-label="Upload CSV"
          name="file"
          type="file"
        />
      </label>
      <button
        className="admin-primary-button"
        disabled={outcome.kind === "uploading"}
        type="submit"
      >
        {outcome.kind === "uploading" ? "Importing…" : "Upload"}
      </button>
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

interface importSuccessShape {
  readonly restaurantsAdded: number;
  readonly restaurantsUpdated: number;
  readonly itemsAdded: number;
  readonly itemsSkipped: number;
  readonly warnings: readonly { row: number; reason: string }[];
}
