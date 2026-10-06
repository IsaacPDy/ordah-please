import { PublicApiError } from "@ordah-please/contracts";

export type ReceiptMode = "group" | "individual";
export interface ReceiptContext {
  role: "owner" | "manager" | "member" | null;
  userId: string;
  participantIds: readonly string[];
  enabled: boolean;
  submitterIds: readonly string[];
}
export interface ReceiptSubject {
  mode: ReceiptMode;
  participantUserId: string | null;
}
export function receiptAccess(context: ReceiptContext) {
  if (!context.role)
    throw new PublicApiError(
      "FORBIDDEN",
      "You do not have access to this session.",
    );
  const owner = context.role === "owner";
  const participant = context.participantIds.includes(context.userId);
  return {
    canManage: owner,
    canAudit: owner || context.role === "manager",
    canSubmit:
      context.enabled &&
      (owner || (participant && context.submitterIds.includes(context.userId))),
  };
}
export function canViewReceipt(
  context: ReceiptContext,
  receipt: ReceiptSubject,
) {
  const access = receiptAccess(context);
  return (
    access.canAudit ||
    (context.participantIds.includes(context.userId) &&
      (receipt.mode === "group" ||
        receipt.participantUserId === context.userId))
  );
}
export function requireReceiptWrite(
  context: ReceiptContext,
  receipt: ReceiptSubject & { uploadedByUserId?: string },
) {
  const access = receiptAccess(context);
  if (!access.canSubmit)
    throw new PublicApiError(
      "FORBIDDEN",
      "You cannot change receipts for this session.",
    );
  if (
    !access.canManage &&
    ((receipt.uploadedByUserId &&
      receipt.uploadedByUserId !== context.userId) ||
      (receipt.mode === "individual" &&
        receipt.participantUserId !== context.userId))
  )
    throw new PublicApiError(
      "FORBIDDEN",
      "You can change only your own receipts.",
    );
}
export function parseReceiptDetails(value: unknown) {
  if (!value || typeof value !== "object")
    throw new PublicApiError("INVALID_INPUT", "Enter receipt details.");
  const input = value as Record<string, unknown>;
  if (
    typeof input.amountCentavos !== "number" ||
    !Number.isSafeInteger(input.amountCentavos) ||
    input.amountCentavos <= 0
  )
    throw new PublicApiError(
      "INVALID_INPUT",
      "Enter a positive PHP amount with at most two decimal places.",
    );
  if (
    input.note !== undefined &&
    (typeof input.note !== "string" || input.note.length > 2000)
  )
    throw new PublicApiError(
      "INVALID_INPUT",
      "The note must be at most 2,000 characters.",
    );
  return {
    amountCentavos: input.amountCentavos,
    note: typeof input.note === "string" ? input.note.trim() : "",
  };
}
export const RECEIPT_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
export function validateReceiptFile(contentType: unknown, sizeBytes: unknown) {
  if (
    typeof contentType !== "string" ||
    !RECEIPT_CONTENT_TYPES.includes(contentType) ||
    typeof sizeBytes !== "number" ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes < 1 ||
    sizeBytes > 10 * 1024 * 1024
  )
    throw new PublicApiError(
      "INVALID_INPUT",
      "Choose a JPEG, PNG, WebP, or PDF file up to 10 MB.",
    );
}
