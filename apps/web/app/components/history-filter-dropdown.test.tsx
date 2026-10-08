// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { HistoryFilterDropdown } from "./history-filter-dropdown";

afterEach(cleanup);

function Filter() {
  const [value, setValue] = useState("");
  return (
    <HistoryFilterDropdown
      label="Filter history by month"
      value={value}
      onChange={setValue}
      options={[
        { value: "", label: "All time" },
        { value: "October 2026", label: "October 2026" },
        { value: "September 2026", label: "September 2026" },
      ]}
    />
  );
}

it("opens a separate options list and selects a filter with focus restored", () => {
  render(<Filter />);
  const trigger = screen.getByRole("button", {
    name: "Filter history by month",
  });
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.click(trigger);
  expect(
    screen.getByRole("listbox", { name: "Filter history by month" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("option", { name: "October 2026" }));
  expect(trigger.textContent).toBe("October 2026");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("supports keyboard navigation, selection, and Escape without changing the filter", () => {
  render(<Filter />);
  const trigger = screen.getByRole("button", {
    name: "Filter history by month",
  });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  expect(document.activeElement).toBe(
    screen.getByRole("option", { name: "All time" }),
  );
  fireEvent.keyDown(document.activeElement!, { key: "End" });
  expect(document.activeElement).toBe(
    screen.getByRole("option", { name: "September 2026" }),
  );
  fireEvent.keyDown(document.activeElement!, { key: "Enter" });
  expect(trigger.textContent).toBe("September 2026");
  fireEvent.click(trigger);
  fireEvent.keyDown(document.activeElement!, { key: "Home" });
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(trigger.textContent).toBe("September 2026");
  expect(document.activeElement).toBe(trigger);
  expect(screen.queryByRole("listbox")).toBeNull();
});

it("dismisses on outside press, focus leaving, and trigger toggle", () => {
  render(
    <>
      <Filter />
      <button>Outside</button>
    </>,
  );
  const trigger = screen.getByRole("button", {
    name: "Filter history by month",
  });
  fireEvent.click(trigger);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.click(trigger);
  fireEvent.blur(screen.getByRole("option", { name: "All time" }), {
    relatedTarget: screen.getByRole("button", { name: "Outside" }),
  });
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.click(trigger);
  fireEvent.click(trigger);
  expect(screen.queryByRole("listbox")).toBeNull();
});
