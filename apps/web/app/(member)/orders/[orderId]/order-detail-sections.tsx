"use client";
import { useState, type ReactNode } from "react";

/** Keeps terminal participants and immutable delivery details in separate views. */
export function OrderDetailSections({
  participants,
  details,
}: {
  readonly participants: ReactNode;
  readonly details: ReactNode;
}) {
  const [tab, setTab] = useState("participants");
  return (
    <div className="terminal-order-sections">
      <div className="segmented-control" aria-label="Order sections">
        <button
          type="button"
          aria-pressed={tab === "participants"}
          onClick={() => setTab("participants")}
        >
          Participants
        </button>
        <button
          type="button"
          aria-pressed={tab === "details"}
          onClick={() => setTab("details")}
        >
          Details
        </button>
      </div>
      <div hidden={tab !== "participants"}>{participants}</div>
      <div hidden={tab !== "details"}>{details}</div>
    </div>
  );
}
