// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UploadForm } from "./upload-form";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Selects one CSV and submits the import form. */
function submitCsv(name = "restaurants.csv") {
  const input = screen.getByLabelText<HTMLInputElement>("Upload CSV");
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
      expect(
        screen.getByRole("alert").textContent,
      ).toBe("CSV is missing required columns: cuisines");
    });
  });
});
