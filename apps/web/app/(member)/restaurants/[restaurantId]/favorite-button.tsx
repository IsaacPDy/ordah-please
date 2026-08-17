"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface FavoriteButtonProps {
  readonly favoriteId: string | null;
  readonly initiallyFavorited: boolean;
  readonly menuItemId: string;
}

/** Toggle that saves or removes one meal favorite for the signed-in member. */
export function FavoriteButton({
  favoriteId,
  initiallyFavorited,
  menuItemId,
}: FavoriteButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  function showMessage(text: string): void {
    setMessage(text);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  async function toggle(): Promise<void> {
    setPending(true);
    try {
      const response = initiallyFavorited && favoriteId !== null
        ? await fetch(
            `/api/favorites/${encodeURIComponent(favoriteId)}`,
            { method: "DELETE" },
          )
        : await fetch("/api/favorites", {
            body: JSON.stringify({ menuItemId }),
            headers: { "content-type": "application/json" },
            method: "POST",
          });
      if (!response.ok) {
        showMessage(await readErrorMessage(response));
        return;
      }
      router.refresh();
    } catch {
      showMessage("Couldn't reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="restaurant-detail__item-favorite-wrap">
      <button
        aria-label={
          initiallyFavorited
            ? "Remove favorite meal"
            : "Save favorite meal"
        }
        aria-pressed={initiallyFavorited}
        className={
          initiallyFavorited
            ? "restaurant-detail__item-favorite restaurant-detail__item-favorite--saved"
            : "restaurant-detail__item-favorite"
        }
        disabled={pending}
        onClick={() => {
          void toggle();
        }}
        type="button"
      >
        {initiallyFavorited ? (
          <Check aria-hidden="true" size={20} strokeWidth={2.4} />
        ) : (
          <Plus aria-hidden="true" size={20} strokeWidth={2.4} />
        )}
      </button>
      {message !== null ? (
        <p
          aria-live="polite"
          className="restaurant-detail__item-favorite-message"
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Reads the safe public message from a failed response, or returns a fallback. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    const message = body?.error?.message;
    return typeof message === "string" ? message : "Request failed.";
  } catch {
    return "Couldn't reach the server. Try again.";
  }
}
