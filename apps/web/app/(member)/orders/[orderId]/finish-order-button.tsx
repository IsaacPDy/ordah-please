"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Manager control that finishes the order early after confirmation. */
export function FinishOrderButton({
  orderId,
  applyFavorites = true,
}: {
  readonly orderId: string;
  readonly applyFavorites?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function finish(): Promise<void> {
    if (
      !window.confirm(
        applyFavorites
          ? "Finish this order now? Anyone who hasn't picked gets their #1 favorite ordered."
          : "Finish this session now? A restaurant is optional and a group owner or manager can edit it afterward.",
      )
    ) {
      return;
    }
    setPending(true);
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/finish`,
        {
          body: JSON.stringify({}),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setMessage(body?.error?.message ?? "Couldn't finish the order.");
        return;
      }
      router.push("/orders");
      router.refresh();
    } catch {
      setMessage("Couldn't reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        className="primary-action"
        disabled={pending}
        onClick={() => {
          void finish();
        }}
        type="button"
      >
        {pending ? "Finishing…" : "Finish order now"}
      </button>
      {message === null ? null : (
        <p aria-live="polite" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
