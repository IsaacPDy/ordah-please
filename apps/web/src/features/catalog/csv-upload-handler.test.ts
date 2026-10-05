import { utils, write } from "xlsx";
import { describe, expect, it, vi } from "vitest";

vi.mock("./catalog-runtime", () => ({
  catalogRuntime: {},
}));

import { CSV_REQUIRED_HEADERS } from "@ordah-please/contracts";
import { parseId, type UserId } from "@ordah-please/domain";

import type { AppIdentity } from "../../auth/load-app-identity";
import type { VerifiedSession } from "../../auth/verify-session";
import { createImportCsvHandler } from "./csv-upload-handler";

const session: VerifiedSession = {
  authUserId: "auth-user-1",
  displayName: "Admin",
  email: "admin@example.com",
  imageUrl: null,
};

const identity: AppIdentity = {
  ...session,
  isPlatformAdmin: true,
  memberships: [],
  userId: parseId<UserId>("10000000-0000-4000-8000-000000000001"),
};

/** Builds one multipart request matching the browser upload form. */
function uploadRequest(
  contents: string,
  options: { name?: string; type?: string } = {},
): Request {
  const form = new FormData();
  form.set(
    "file",
    new File([contents], options.name ?? "catalog.csv", {
      type: options.type ?? "text/csv",
    }),
  );
  return new Request("https://ordah.test/api/admin/catalog/import", {
    body: form,
    method: "POST",
  });
}

/** Creates the upload handler with an observable repository boundary. */
function createHandler() {
  const invalidateCatalog = vi.fn();
  const importCatalog = vi.fn(() =>
    Promise.resolve({
      itemsAdded: 1,
      itemsSkipped: 0,
      restaurantsAdded: 1,
      restaurantsUpdated: 0,
      warnings: [],
    }),
  );
  return {
    handler: createImportCsvHandler({
      importCatalog,
      invalidateCatalog,
      loadIdentity: () => identity,
      verifySession: () => session,
    }),
    importCatalog,
    invalidateCatalog,
  };
}

describe("catalog CSV upload handler", () => {
  it("invalidates shared catalog reads after a successful import", async () => {
    const { handler, invalidateCatalog } = createHandler();
    const row = CSV_REQUIRED_HEADERS.map((header) => {
      if (header === "price_centavos") return "19900";
      if (header === "collected_at") return "2026-09-12";
      if (header === "is_available") return "true";
      if (header === "source_url") return "https://food.grab.com/menu";
      if (header === "image_url") return "";
      return "Example";
    }).join(",");

    const response = await handler(
      uploadRequest(`${CSV_REQUIRED_HEADERS.join(",")}\n${row}`),
    );

    expect(response.status).toBe(200);
    expect(invalidateCatalog).toHaveBeenCalledOnce();
  });

  it("returns invalid input when required headers are missing", async () => {
    const { handler, importCatalog } = createHandler();

    const response = await handler(uploadRequest("restaurant_name\nExample"));

    expect(response.status).toBe(400);
    expect(importCatalog).not.toHaveBeenCalled();
  });

  it("rejects a CSV when every data row is invalid", async () => {
    const { handler, importCatalog } = createHandler();
    const badRow = CSV_REQUIRED_HEADERS.map((header) =>
      header === "price_centavos" ? "not-a-number" : "value",
    ).join(",");

    const response = await handler(
      uploadRequest(`${CSV_REQUIRED_HEADERS.join(",")}\n${badRow}`),
    );

    expect(response.status).toBe(400);
    expect(importCatalog).not.toHaveBeenCalled();
  });

  it("rejects a .csv file with a non-CSV content type", async () => {
    const { handler, importCatalog } = createHandler();

    const response = await handler(
      uploadRequest("ignored", { type: "application/octet-stream" }),
    );

    expect(response.status).toBe(400);
    expect(importCatalog).not.toHaveBeenCalled();
  });
});

describe("catalog Excel uploads", () => {
  it.each(["xlsx", "xls"] as const)(
    "imports a real %s workbook through existing row validation",
    async (extension) => {
      const row = CSV_REQUIRED_HEADERS.map((header) => {
        if (header === "price_centavos") return 19900;
        if (header === "collected_at") return "2026-09-12";
        if (header === "is_available") return true;
        if (header === "source_url") return "https://food.grab.com/menu";
        if (header === "image_url") return "";
        return "Example";
      });
      const workbook = utils.book_new();
      utils.book_append_sheet(
        workbook,
        utils.aoa_to_sheet([[...CSV_REQUIRED_HEADERS], row]),
        "Catalog",
      );
      const contents = write(workbook, {
        type: "array",
        bookType: extension === "xls" ? "biff8" : "xlsx",
      }) as ArrayBuffer;
      const form = new FormData();
      form.set(
        "file",
        new File([contents], `catalog.${extension}`, {
          type:
            extension === "xls"
              ? "application/vnd.ms-excel"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const { handler, importCatalog } = createHandler();
      const response = await handler(
        new Request("https://ordah.test/api/admin/catalog/import", {
          method: "POST",
          body: form,
        }),
      );
      expect(response.status).toBe(200);
      expect(importCatalog).toHaveBeenCalledWith(
        identity.userId,
        `catalog.${extension}`,
        [expect.objectContaining({ priceCentavos: 19900 })],
        [],
      );
    },
  );

  it.each(["menu.pdf", "menu.csv.exe", "menu.xlsx"])(
    "rejects unsupported or disguised contents in %s",
    async (name) => {
      const { handler, importCatalog } = createHandler();
      const response = await handler(uploadRequest("not a workbook", { name }));
      expect(response.status).toBe(400);
      expect(importCatalog).not.toHaveBeenCalled();
    },
  );
});
