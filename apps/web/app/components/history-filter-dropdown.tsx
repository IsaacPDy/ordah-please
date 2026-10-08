"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

interface HistoryFilterDropdownProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly { value: string; label: string }[];
  readonly onChange: (value: string) => void;
}

/** History-only single selection with a stacked, anchored options panel. */
export function HistoryFilterDropdown({
  label,
  value,
  options,
  onChange,
}: HistoryFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const search = useRef({ text: "", time: 0 });
  const listId = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  useEffect(() => {
    if (!open) return;
    optionRefs.current[selectedIndex]?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open, selectedIndex]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    close();
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    switch (event.key) {
      case "ArrowDown":
        next = (index + 1) % options.length;
        break;
      case "ArrowUp":
        next = (index + options.length - 1) % options.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = options.length - 1;
        break;
      case "Escape":
        event.preventDefault();
        close();
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(index);
        return;
      default: {
        if (
          event.key.length !== 1 ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        )
          return;
        const now = Date.now();
        const text =
          (now - search.current.time < 700 ? search.current.text : "") +
          event.key.toLowerCase();
        search.current = { text, time: now };
        const match = options.findIndex((option) =>
          option.label.toLowerCase().startsWith(text),
        );
        if (match < 0) return;
        next = match;
      }
    }
    event.preventDefault();
    optionRefs.current[next]?.focus();
  }

  return (
    <div
      className="history-dropdown"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        className="history-dropdown__trigger"
        type="button"
        ref={trigger}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{options[selectedIndex]?.label}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="history-dropdown__options"
          role="listbox"
          aria-label={label}
          id={listId}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              className="history-dropdown__option"
              aria-selected={option.value === value}
              tabIndex={-1}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              onClick={() => choose(index)}
              onKeyDown={(event) => navigate(event, index)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
