// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UploadForm } from "./upload-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function drop(files: File[]) {
  fireEvent.drop(screen.getByRole("region", { name: "Catalog file upload" }), {
    dataTransfer: { files },
  });
}

function csvFile(name = "menu.csv") {
  const file = new File(["restaurant_name\nExample"], name, {
    type: "text/csv",
  });
  Object.defineProperty(file, "text", {
    configurable: true,
    value: () => Promise.resolve("restaurant_name\nExample"),
  });
  return file;
}

describe("catalog upload selection", () => {
  it("selects a dropped CSV and sends it only after confirmation", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              restaurantsAdded: 1,
              restaurantsUpdated: 0,
              itemsAdded: 1,
              warnings: [],
            },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    render(<UploadForm />);
    drop([csvFile()]);
    await screen.findByText("Example");
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Import this Restaurant" }),
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(
      (fetch.mock.calls[0]![1]?.body as FormData).get("file"),
    ).toBeInstanceOf(File);
  });

  it.each(["menu.pdf", "menu.csv.exe"])(
    "rejects %s dropped over an existing selection",
    async (name) => {
      render(<UploadForm />);
      drop([csvFile()]);
      await screen.findByText("Example");
      drop([new File(["ignored"], name)]);
      expect(screen.getByRole("alert").textContent).toMatch(/CSV or Excel/);
      expect(
        screen.queryByRole("button", { name: "Import this Restaurant" }),
      ).toBeNull();
    },
  );

  it("rejects unsupported files chosen through the picker", () => {
    render(<UploadForm />);
    fireEvent.change(screen.getByLabelText("Upload CSV or Excel"), {
      target: { files: [new File(["ignored"], "menu.pdf")] },
    });
    expect(screen.getByRole("alert").textContent).toMatch(/CSV or Excel/);
  });

  it("rejects multiple dropped files", () => {
    render(<UploadForm />);
    drop([csvFile(), csvFile("second.csv")]);
    expect(screen.getByRole("alert").textContent).toMatch(/one file/);
  });

  it("rejects files above the size limit before reading them", () => {
    render(<UploadForm />);
    drop([new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.csv")]);
    expect(screen.getByRole("alert").textContent).toMatch(/5MB/);
  });

  it("does not let a late preview replace a newer selection", async () => {
    let finish!: (value: string) => void;
    const first = csvFile();
    Object.defineProperty(first, "text", {
      configurable: true,
      value: () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    });
    render(<UploadForm />);
    drop([first]);
    drop([csvFile("new.csv")]);
    await screen.findByText("Example");
    finish("restaurant_name\nOld restaurant");
    await waitFor(() =>
      expect(screen.queryByText("Old restaurant")).toBeNull(),
    );
  });
});

/** Selects one CSV and submits the import form. */
function submitCsv(name = "restaurants.csv") {
  const input = screen.getByLabelText<HTMLInputElement>("Upload CSV or Excel");
  const file = new File(["restaurant_name"], name, { type: "text/csv" });
  fireEvent.change(input, { target: { files: [file] } });
  const form = input.closest("form");
  if (form === null) throw new Error("Upload form is missing.");
  fireEvent.submit(form);
}

describe("UploadForm", () => {
  it("posts the selected CSV and renders the trusted import summary", async () => {
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            restaurantsAdded: 2,
            restaurantsUpdated: 0,
            itemsAdded: 47,
            itemsSkipped: 1,
            warnings: [{ row: 9, reason: "price_centavos is invalid" }],
          },
          ok: true,
        }),
        { headers: { "content-type": "application/json" }, status: 200 },
      ),
    );
    render(<UploadForm />);

    submitCsv();

    await waitFor(() => {
      expect(
        screen.getByText("Imported 2 restaurants, 47 menu items."),
      ).toBeTruthy();
    });
    expect(screen.getByText("Row 9: price_centavos is invalid")).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(1);
    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe("/api/admin/catalog/import");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it("shows the public API error message when import validation fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "CSV is missing required columns: cuisines" },
          ok: false,
        }),
        { headers: { "content-type": "application/json" }, status: 400 },
      ),
    );
    render(<UploadForm />);

    submitCsv("invalid.csv");

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(
        "CSV is missing required columns: cuisines",
      );
    });
  });
});
