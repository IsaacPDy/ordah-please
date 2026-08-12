// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateGroupDialog } from "./create-group-dialog";

const users = [
  { id: "user-1", displayName: "Mia Tan" },
  { id: "user-2", displayName: "Noah Lim" },
] as const;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Opens the create-group modal for one focused interaction test. */
function openDialog() {
  render(<CreateGroupDialog users={users} />);
  fireEvent.click(screen.getByRole("button", { name: "Create group" }));
}

describe("CreateGroupDialog", () => {
  it("opens as an accessible modal with a close button", () => {
    openDialog();

    expect(screen.getByRole("dialog", { name: "Create group" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("mounts the modal overlay at the document body instead of beside its trigger", () => {
    openDialog();

    expect(screen.getByTestId("create-group-backdrop").parentElement).toBe(
      document.body,
    );
  });

  it("closes on a backdrop click when no field has changed", () => {
    openDialog();

    fireEvent.click(screen.getByTestId("create-group-backdrop"));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays open and wobbles on a backdrop click when a field has input", () => {
    openDialog();
    fireEvent.change(screen.getByLabelText("Group name"), {
      target: { value: "Friday lunch" },
    });

    fireEvent.click(screen.getByTestId("create-group-backdrop"));

    const dialog = screen.getByRole("dialog", { name: "Create group" });
    expect(dialog.className).toContain("admin-dialog--wobble");
    expect(screen.getByDisplayValue("Friday lunch")).toBeTruthy();
  });

  it("asks for confirmation when X is pressed after a field changes", () => {
    openDialog();
    fireEvent.change(screen.getByLabelText("Owner"), {
      target: { value: "user-2" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.getByText("Discard this group?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep editing" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
  });

  it("keeps field input when the discard confirmation is cancelled", () => {
    openDialog();
    fireEvent.change(screen.getByLabelText("Group name"), {
      target: { value: "Friday lunch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.getByDisplayValue("Friday lunch")).toBeTruthy();
  });

  it("closes and clears the form when discard is confirmed", () => {
    openDialog();
    fireEvent.change(screen.getByLabelText("Group name"), {
      target: { value: "Friday lunch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));

    const groupNameInput =
      screen.getByLabelText<HTMLInputElement>("Group name");
    expect(groupNameInput.value).toBe("");
  });

  it("closes a clean dialog with Escape and restores focus to its trigger", () => {
    openDialog();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    const trigger = screen.getByRole("button", { name: "Create group" });
    expect(document.activeElement).toBe(trigger);
  });

  it("uses Escape to show discard confirmation and return to editing", () => {
    openDialog();
    fireEvent.change(screen.getByLabelText("Group name"), {
      target: { value: "Friday lunch" },
    });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Keep editing" }),
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(document.activeElement).toBe(screen.getByLabelText("Group name"));
  });

  it("keeps Tab focus inside the modal", () => {
    openDialog();
    const first = screen.getByRole("button", { name: "Close" });
    const last = screen.getByRole("button", { name: "Create group" });

    last.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Tab",
      shiftKey: true,
    });
    expect(document.activeElement).toBe(last);
  });

  it("ignores Escape while the create request is pending", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    openDialog();
    fireEvent.change(screen.getByLabelText("Group name"), {
      target: { value: "Friday lunch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create group" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Creating…" })).toBeTruthy(),
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.getByRole("dialog", { name: "Create group" })).toBeTruthy();
    expect(screen.queryByText("Discard this group?")).toBeNull();
  });
});
