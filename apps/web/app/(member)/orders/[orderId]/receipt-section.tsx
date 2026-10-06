"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { ReceiptView } from "../../../../src/features/orders/receipt-service";
import Image from "next/image";
import "./receipt-section.css";

async function api<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const result = (await response.json()) as {
    data: T;
    error?: { message: string };
  };
  if (!response.ok)
    throw new Error(
      result.error?.message ?? "Receipts could not be saved. Try again.",
    );
  return result.data;
}
function amount(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error(
      "Enter a positive PHP amount with at most two decimal places.",
    );
  const [whole, decimal = ""] = value.trim().split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0)
    throw new Error("Enter a positive PHP amount.");
  return cents;
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Receipts could not be saved. Try again.";
}
function uploadFile(
  url: string,
  file: File,
  progress: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", file.type);
    request.timeout = 120_000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        progress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error("The file could not be uploaded. Try again."));
    request.onerror = () =>
      reject(
        new Error(
          "The file could not be uploaded. Check your connection and try again.",
        ),
      );
    request.ontimeout = () =>
      reject(new Error("The upload timed out. Try again."));
    request.send(file);
  });
}
export function ReceiptSection({ orderId }: { orderId: string }) {
  const endpoint = `/api/orders/${orderId}/receipts`;
  const [view, setView] = useState<ReceiptView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [php, setPhp] = useState("");
  const [note, setNote] = useState("");
  const [participant, setParticipant] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = useRef<{ uploadId: string; signature: string } | null>(null);
  const load = useCallback(async () => {
    try {
      const data = await api<ReceiptView>(endpoint);
      setView(data);
      setError("");
      return true;
    } catch (failure) {
      setError(message(failure));
      return false;
    }
  }, [endpoint]);
  useEffect(() => {
    void load();
  }, [load]);
  async function settings(
    input: Pick<ReceiptView, "enabled" | "mode" | "submitterIds">,
  ) {
    setBusy(true);
    setError("");
    try {
      await api(endpoint, "PATCH", input);
      await load();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !view) {
      setError("Choose a receipt file.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (
        !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
          file.type,
        ) ||
        file.size < 1 ||
        file.size > 10 * 1024 * 1024
      )
        throw new Error("Choose a JPEG, PNG, WebP, or PDF file up to 10 MB.");
      const input = {
        contentType: file.type,
        sizeBytes: file.size,
        amountCentavos: amount(php),
        note,
        ...(view.mode === "individual"
          ? {
              participantUserId: view.canManage
                ? participant || view.userId
                : view.userId,
            }
          : {}),
      };
      const signature = JSON.stringify({
        ...input,
        name: file.name,
        lastModified: file.lastModified,
      });
      let uploadId =
        pending.current?.signature === signature
          ? pending.current.uploadId
          : null;
      if (!uploadId) {
        const prepared = await api<{ uploadId: string; uploadUrl: string }>(
          `${endpoint}/uploads`,
          "POST",
          input,
        );
        setProgress(0);
        await uploadFile(prepared.uploadUrl, file, setProgress);
        uploadId = prepared.uploadId;
        pending.current = { uploadId, signature };
      }
      setProgress(100);
      await api(`${endpoint}/finalize`, "POST", { uploadId });
      pending.current = null;
      setFile(null);
      setPhp("");
      setNote("");
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } catch (failure) {
      setError(message(failure));
      if (/expired|settings changed|no longer/.test(message(failure)))
        pending.current = null;
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }
  return (
    <section
      className="content-section receipt-section"
      id="session-receipts"
      aria-labelledby="receipts-heading"
    >
      {view ? (
        <SessionTotal
          key={String(view.sessionTotalCentavos)}
          endpoint={endpoint}
          view={view}
          onSaved={load}
        />
      ) : null}
      <div className="section-heading-row">
        <h2 id="receipts-heading">Receipts</h2>
        {view ? (
          <span className="count-badge">{view.receipts.length}</span>
        ) : null}
      </div>
      {error ? (
        <>
          <p role="alert">{error}</p>
          {!view ? (
            <button
              type="button"
              className="secondary-action"
              onClick={() => void load()}
            >
              Retry receipts
            </button>
          ) : null}
        </>
      ) : null}
      {!view && !error ? <p role="status">Loading receipts…</p> : null}
      {view?.canManage ? (
        <div className="receipt-settings">
          <label className="receipt-switch">
            <input
              type="checkbox"
              role="switch"
              checked={view.enabled}
              disabled={busy}
              onChange={(event) =>
                void settings({
                  enabled: event.target.checked,
                  mode: view.mode,
                  submitterIds: view.submitterIds,
                })
              }
            />
            Enable receipt attachments
          </label>
          <label className="field-label">
            Receipt mode
            <select
              value={view.mode}
              disabled={busy}
              onChange={(event) =>
                void settings({
                  enabled: view.enabled,
                  mode: event.target.value as ReceiptView["mode"],
                  submitterIds: view.submitterIds,
                })
              }
            >
              <option value="group">Group</option>
              <option value="individual">Individual</option>
            </select>
          </label>
          <p className="receipt-help">
            Group receipts are shared with session participants. Individual
            receipts are visible to their participant, the owner, and Managers.
            Changing modes affects new receipts only.
          </p>
          <fieldset disabled={busy}>
            <legend>People allowed to attach receipts</legend>
            <p className="receipt-help">
              You always have permission while receipts are enabled. Managers
              must be selected too.
            </p>
            {view.participants
              .filter((person) => person.userId !== view.userId)
              .map((person) => (
                <label className="receipt-person" key={person.userId}>
                  <input
                    type="checkbox"
                    checked={view.submitterIds.includes(person.userId)}
                    onChange={(event) =>
                      void settings({
                        enabled: view.enabled,
                        mode: view.mode,
                        submitterIds: event.target.checked
                          ? [...view.submitterIds, person.userId]
                          : view.submitterIds.filter(
                              (id) => id !== person.userId,
                            ),
                      })
                    }
                  />
                  {person.displayName}
                </label>
              ))}
          </fieldset>
        </div>
      ) : null}
      {view && !view.enabled ? (
        <p className="receipt-help">
          Receipt attachments are disabled. Saved receipts remain available.
        </p>
      ) : null}
      {view?.canSubmit ? (
        <form className="receipt-form" onSubmit={(event) => void submit(event)}>
          <fieldset disabled={busy}>
            <legend>Attach receipt</legend>
            {view.mode === "individual" && view.canManage ? (
              <label className="field-label">
                Receipt for
                <select
                  value={
                    participant ||
                    (view.participants.some(
                      (person) => person.userId === view.userId,
                    )
                      ? view.userId
                      : "")
                  }
                  required
                  onChange={(event) => setParticipant(event.target.value)}
                >
                  <option value="" disabled>
                    Choose a participant
                  </option>
                  {view.participants.map((person) => (
                    <option value={person.userId} key={person.userId}>
                      {person.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="field-label">
              Receipt file
              <input
                ref={fileInput}
                type="file"
                required
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  pending.current = null;
                }}
              />
            </label>
            <p className="receipt-help">
              JPEG, PNG, WebP, or PDF · up to 10 MB · one file per receipt
            </p>
            <label className="field-label">
              Receipt amount (PHP)
              <input
                type="text"
                inputMode="decimal"
                value={php}
                required
                placeholder="0.00"
                onChange={(event) => setPhp(event.target.value)}
              />
            </label>
            <label className="field-label">
              Note (optional)
              <textarea
                value={note}
                maxLength={2000}
                rows={2}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <button className="primary-action" type="submit">
              {busy ? "Saving receipt…" : "Attach receipt"}
            </button>
          </fieldset>
          {progress !== null ? (
            <div role="status">
              <progress
                max={100}
                value={progress}
                aria-label="Receipt upload progress"
              />
              <span>
                {progress === 100
                  ? "Verifying receipt…"
                  : `Uploading ${progress}%`}
              </span>
            </div>
          ) : null}
          <p className="receipt-help">
            Receipt amounts are separate from food subtotals.
          </p>
        </form>
      ) : null}
      {view && view.enabled && !view.canSubmit ? (
        <p className="receipt-help">
          The owner can give you permission to attach receipts.
        </p>
      ) : null}
      {view?.receipts.length === 0 ? (
        <p className="receipt-help">No receipts available.</p>
      ) : null}
      <div className="receipt-list">
        {view?.receipts.map((receipt) => (
          <ReceiptCard
            key={receipt.id}
            receipt={receipt}
            endpoint={endpoint}
            reload={load}
          />
        ))}
      </div>
    </section>
  );
}
function ReceiptCard({
  receipt,
  endpoint,
  reload,
}: {
  receipt: ReceiptView["receipts"][number];
  endpoint: string;
  reload: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [php, setPhp] = useState(
    receipt.amountCentavos === null
      ? ""
      : (receipt.amountCentavos / 100).toFixed(2),
  );
  const [note, setNote] = useState(receipt.note);
  const url = `${endpoint}/${receipt.id}/file`;
  async function mutate(method: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(`${endpoint}/${receipt.id}`, method, body);
      setEditing(false);
      setRemoving(false);
      await reload();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(false);
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    try {
      void mutate("PATCH", { amountCentavos: amount(php), note });
    } catch (failure) {
      setError(message(failure));
    }
  }
  return (
    <article className="receipt-card">
      <div className="receipt-card__heading">
        <strong>
          {receipt.mode === "group"
            ? "Group receipt"
            : `${receipt.participantName ?? "Participant"}'s receipt`}
        </strong>
        <strong>
          {receipt.amountCentavos === null
            ? "Amount not recorded"
            : new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(receipt.amountCentavos / 100)}
        </strong>
      </div>
      <p className="receipt-help">
        Attached by {receipt.submitterName} ·{" "}
        {new Date(receipt.createdAt).toLocaleDateString("en-PH", {
          timeZone: "Asia/Manila",
        })}
      </p>
      {receipt.contentType === "application/pdf" ? (
        <a
          className="secondary-action"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          Open PDF receipt
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer">
          {previewFailed ? (
            "Open receipt image"
          ) : (
            // Authenticated short-lived redirect cannot use the public Next image optimizer.
            <Image
              width={600}
              height={400}
              unoptimized
              src={url}
              alt={`Receipt attached by ${receipt.submitterName}`}
              className="receipt-preview"
              loading="lazy"
              onError={() => setPreviewFailed(true)}
            />
          )}
        </a>
      )}
      {receipt.note ? <p className="receipt-note">{receipt.note}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {receipt.canEdit && !editing && !removing ? (
        <div className="receipt-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              setPhp(
                receipt.amountCentavos === null
                  ? ""
                  : (receipt.amountCentavos / 100).toFixed(2),
              );
              setNote(receipt.note);
              setEditing(true);
            }}
          >
            Edit receipt details
          </button>
          <button
            type="button"
            className="secondary-action"
            onClick={() => setRemoving(true)}
          >
            Remove receipt
          </button>
        </div>
      ) : null}
      {editing && receipt.canEdit ? (
        <form className="receipt-form" onSubmit={save}>
          <fieldset disabled={busy}>
            <legend>Edit receipt details</legend>
            <label className="field-label">
              Receipt amount (PHP)
              <input
                value={php}
                inputMode="decimal"
                required
                onChange={(event) => setPhp(event.target.value)}
              />
            </label>
            <label className="field-label">
              Note (optional)
              <textarea
                maxLength={2000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <div className="receipt-actions">
              <button type="submit" className="primary-action">
                Save receipt details
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      ) : null}
      {removing && receipt.canEdit ? (
        <div
          className="receipt-remove"
          role="group"
          aria-label="Confirm receipt removal"
        >
          <p>
            Permanently remove this receipt and its attachment? This cannot be
            undone.
          </p>
          <div className="receipt-actions">
            <button
              type="button"
              className="primary-action"
              disabled={busy}
              onClick={() => void mutate("DELETE", { confirmed: true })}
            >
              Confirm removal
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={busy}
              onClick={() => setRemoving(false)}
            >
              Keep receipt
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function SessionTotal({
  endpoint,
  view,
  onSaved,
}: {
  endpoint: string;
  view: ReceiptView;
  onSaved: () => Promise<boolean>;
}) {
  const [value, setValue] = useState(
    view.sessionTotalCentavos === null
      ? ""
      : (view.sessionTotalCentavos / 100).toFixed(2),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api(`${endpoint}/total`, "PATCH", {
        sessionTotalCentavos: value.trim() ? amount(value) : null,
      });
      setSaved(true);
      await onSaved();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="receipt-settings">
      <h3>Session total</h3>
      <p className="receipt-help">
        The owner and managers set this separately from the food subtotal and
        receipt amounts. Uploading or removing receipts does not change it.
      </p>
      {view.canSetSessionTotal ? (
        <form className="receipt-form" onSubmit={(event) => void save(event)}>
          <label className="field-label">
            Session total (PHP)
            <input
              type="text"
              inputMode="decimal"
              value={value}
              disabled={saving}
              onChange={(event) => {
                setValue(event.target.value);
                setSaved(false);
              }}
              placeholder="Not set"
            />
          </label>
          <p className="receipt-help">
            Leave blank to clear the session total.
          </p>
          <button className="primary-action" disabled={saving} type="submit">
            {saving ? "Saving…" : "Save session total"}
          </button>
          {saved ? <p role="status">Session total saved.</p> : null}
          {error ? <p role="alert">{error}</p> : null}
        </form>
      ) : (
        <p>
          {view.sessionTotalCentavos === null
            ? "Not set"
            : new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(view.sessionTotalCentavos / 100)}
        </p>
      )}
    </div>
  );
}
