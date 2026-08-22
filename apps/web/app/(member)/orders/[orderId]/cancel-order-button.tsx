"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Manager control that cancels an active order after confirmation. */
export function CancelOrderButton({ orderId }: { readonly orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function cancel(): Promise<void> {
    if (
      !window.confirm(
        "Cancel this order? Votes and food picks will be kept in history.",
      )
    ) {
      return;
    }
    setPending(true);
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/complete`,
        {
          body: JSON.stringify({ result: "cancelled" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setMessage(body?.error?.message ?? "Couldn't cancel the order.");
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
        className="text-button"
        disabled={pending}
        onClick={() => {
          void cancel();
        }}
        type="button"
      >
        {pending ? "Cancelling…" : "Cancel order"}
      </button>
      {message === null ? null : (
        <p aria-live="polite" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
