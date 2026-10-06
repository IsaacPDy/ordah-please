import { randomUUID } from "node:crypto";
import { PublicApiError } from "@ordah-please/contracts";
import type { ReceiptsRepository } from "@ordah-please/db";
import type { ReceiptStorage } from "@ordah-please/storage";
import {
  receiptAccess,
  canViewReceipt,
  requireReceiptWrite,
  parseReceiptDetails,
  validateReceiptFile,
  type ReceiptMode,
} from "./receipt-policy";

export interface ReceiptRunner {
  run<T>(operation: (repository: ReceiptsRepository) => Promise<T>): Promise<T>;
}
export interface ReceiptView {
  sessionTotalCentavos: number | null;
  canSetSessionTotal: boolean;
  enabled: boolean;
  mode: ReceiptMode;
  submitterIds: string[];
  canManage: boolean;
  canSubmit: boolean;
  userId: string;
  participants: { userId: string; displayName: string }[];
  receipts: {
    id: string;
    mode: ReceiptMode;
    participantUserId: string | null;
    participantName: string | null;
    submitterName: string;
    amountCentavos: number | null;
    note: string;
    contentType: string;
    createdAt: string;
    canEdit: boolean;
  }[];
}
export function receiptId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new PublicApiError(
      "INVALID_INPUT",
      "Invalid receipt or session identifier.",
    );
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new PublicApiError("INVALID_INPUT", "Invalid receipt request.");
  return value as Record<string, unknown>;
}
export async function executeReceiptAction(
  command: {
    orderId: string;
    userId: string;
    action: string;
    input: unknown;
    receiptId?: string;
  },
  runner: ReceiptRunner,
  getStorage: () => ReceiptStorage,
) {
  receiptId(command.orderId);
  return runner.run(async (repo) => {
    const context = await repo.loadContext(command.orderId, command.userId);
    if (!context) throw new PublicApiError("NOT_FOUND", "Session not found.");
    const access = receiptAccess(context);
    if (!access.canAudit && !context.participantIds.includes(command.userId))
      throw new PublicApiError(
        "FORBIDDEN",
        "You do not have access to this session.",
      );
    const eligiblePeople = context.participants.filter((person) =>
      context.activeMemberIds.includes(person.userId),
    );
    const action = command.action;
    if (action === "list") {
      const rows = await repo.list(command.orderId);
      return {
        sessionTotalCentavos: context.sessionTotalCentavos,
        canSetSessionTotal: access.canAudit,
        enabled: context.enabled,
        mode: context.mode,
        submitterIds: access.canManage ? context.submitterIds : [],
        canManage: access.canManage,
        canSubmit: access.canSubmit,
        userId: command.userId,
        participants: access.canManage ? eligiblePeople : [],
        receipts: rows
          .filter(({ receipt }) =>
            canViewReceipt(context, {
              mode: receipt.mode as ReceiptMode,
              participantUserId: receipt.participantUserId,
            }),
          )
          .map(({ receipt, file, submitterName }) => {
            let canEdit = false;
            try {
              requireReceiptWrite(context, {
                ...receipt,
                mode: receipt.mode as ReceiptMode,
              });
              canEdit = true;
            } catch {
              /* Viewing does not grant mutation access. */
            }
            return {
              id: receipt.id,
              mode: receipt.mode as ReceiptMode,
              participantUserId: receipt.participantUserId,
              participantName: receipt.participantName,
              submitterName,
              amountCentavos: receipt.amountCentavos,
              note: receipt.note,
              contentType: file.contentType,
              createdAt: receipt.createdAt.toISOString(),
              canEdit,
            };
          }),
      } satisfies ReceiptView;
    }
    const input = object(command.input);
    if (action === "total") {
      if (!access.canAudit)
        throw new PublicApiError(
          "FORBIDDEN",
          "Only the group owner and managers can set the session total.",
        );
      const value = input.sessionTotalCentavos;
      if (
        value !== null &&
        (typeof value !== "number" ||
          !Number.isSafeInteger(value) ||
          value <= 0)
      )
        throw new PublicApiError(
          "INVALID_INPUT",
          "Enter a positive session total with at most two decimal places, or clear it.",
        );
      await repo.saveSessionTotal(command.orderId, value);
      return { saved: true };
    }
    if (action === "settings") {
      if (!access.canManage)
        throw new PublicApiError(
          "FORBIDDEN",
          "Only the group owner can change receipt settings.",
        );
      if (
        typeof input.enabled !== "boolean" ||
        !["group", "individual"].includes(String(input.mode)) ||
        !Array.isArray(input.submitterIds)
      )
        throw new PublicApiError("INVALID_INPUT", "Invalid receipt settings.");
      const submitterIds = [...new Set(input.submitterIds.map(receiptId))];
      if (
        submitterIds.some(
          (id) => !eligiblePeople.some((person) => person.userId === id),
        )
      )
        throw new PublicApiError(
          "INVALID_INPUT",
          "Choose current session participants.",
        );
      await repo.saveSettings(command.orderId, {
        enabled: input.enabled,
        mode: input.mode as ReceiptMode,
        submitterIds,
      });
      return { saved: true };
    }
    if (action === "prepare") {
      const details = parseReceiptDetails(input);
      validateReceiptFile(input.contentType, input.sizeBytes);
      const participantUserId =
        context.mode === "individual"
          ? receiptId(input.participantUserId ?? command.userId)
          : null;
      if (
        participantUserId &&
        !eligiblePeople.some((person) => person.userId === participantUserId)
      )
        throw new PublicApiError(
          "INVALID_INPUT",
          "Choose a current session participant.",
        );
      requireReceiptWrite(context, { mode: context.mode, participantUserId });
      const storage = getStorage();
      const id = randomUUID();
      const uploadUrl = await storage.uploadUrl(
        `receipts/pending/${id}`,
        input.contentType as string,
      );
      await repo.createUpload({
        id,
        orderId: command.orderId,
        userId: command.userId,
        mode: context.mode,
        participantUserId,
        ...details,
        contentType: input.contentType as string,
        sizeBytes: input.sizeBytes as number,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      });
      return { uploadId: id, uploadUrl };
    }
    if (action === "finalize") {
      const id = receiptId(input.uploadId);
      const saved = await repo.findByUpload(id);
      if (saved) {
        if (
          saved.orderId !== command.orderId ||
          saved.uploadedByUserId !== command.userId
        )
          throw new PublicApiError(
            "FORBIDDEN",
            "This upload belongs to another session or person.",
          );
        requireReceiptWrite(context, {
          ...saved,
          mode: saved.mode as ReceiptMode,
        });
        return { receiptId: saved.id };
      }
      const upload = await repo.findUpload(id);
      if (
        !upload ||
        upload.finalizedAt ||
        upload.expiresAt.getTime() <= Date.now()
      )
        throw new PublicApiError(
          "CONFLICT",
          "This upload expired or was already removed. Select the file again.",
        );
      if (
        upload.orderId !== command.orderId ||
        upload.userId !== command.userId
      )
        throw new PublicApiError(
          "FORBIDDEN",
          "This upload belongs to another session or person.",
        );
      requireReceiptWrite(context, {
        mode: upload.mode as ReceiptMode,
        participantUserId: upload.participantUserId,
      });
      if (upload.mode !== context.mode)
        throw new PublicApiError(
          "CONFLICT",
          "Receipt settings changed. Select the file again.",
        );
      const participant = eligiblePeople.find(
        (person) => person.userId === upload.participantUserId,
      );
      if (upload.mode === "individual" && !participant)
        throw new PublicApiError(
          "CONFLICT",
          "The participant is no longer in this session.",
        );
      try {
        await getStorage().validateAndCopy(
          `receipts/pending/${id}`,
          `receipts/final/${id}`,
          upload.contentType,
          upload.sizeBytes,
        );
      } catch (error) {
        const message =
          error instanceof Error &&
          /^(The file contents|The uploaded file|Invalid file)/.test(
            error.message,
          )
            ? error.message
            : "The upload could not be verified. Try again.";
        throw new PublicApiError("INVALID_INPUT", message);
      }
      const receipt = await repo.finalize(
        upload,
        participant?.displayName ?? null,
      );
      return { receiptId: receipt.id };
    }
    const id = receiptId(command.receiptId);
    const row = (await repo.list(command.orderId)).find(
      ({ receipt }) => receipt.id === id,
    );
    if (
      !row ||
      !canViewReceipt(context, {
        mode: row.receipt.mode as ReceiptMode,
        participantUserId: row.receipt.participantUserId,
      })
    )
      throw new PublicApiError("NOT_FOUND", "Receipt not found.");
    if (action === "file")
      return {
        url: await getStorage().downloadUrl(
          row.file.objectKey,
          row.file.contentType,
        ),
      };
    requireReceiptWrite(context, {
      ...row.receipt,
      mode: row.receipt.mode as ReceiptMode,
    });
    if (action === "edit") {
      await repo.update(id, parseReceiptDetails(input));
      return { saved: true };
    }
    if (action === "delete") {
      if (input.confirmed !== true)
        throw new PublicApiError(
          "INVALID_INPUT",
          "Confirm receipt removal first.",
        );
      await repo.remove(id, row.file.id, row.file.objectKey);
      return { removed: true };
    }
    throw new PublicApiError("INVALID_INPUT", "Unknown receipt action.");
  });
}

/** Bounded retryable cleanup; called after requests and by the scheduled cleanup endpoint. */
export async function cleanupReceiptObjects(
  runner: ReceiptRunner,
  storage: ReceiptStorage,
) {
  return runner.run(async (repo) => {
    await repo.expireUploads(new Date());
    const entries = await repo.cleanupEntries(new Date());
    for (const entry of entries) {
      try {
        await storage.remove(entry.objectKey);
        await repo.cleanupDone(entry.objectKey);
      } catch {
        await repo.cleanupFailed(entry.objectKey);
      }
    }
    return { processed: entries.length };
  });
}
