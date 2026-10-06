"use client";

import { Bookmark, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface FavoriteRemoveButtonProps {
  readonly favoriteId: string;
  readonly mealName: string;
}

/** Removes one favorite for the signed-in member. */
export function FavoriteRemoveButton({
  favoriteId,
  mealName,
}: FavoriteRemoveButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove(): Promise<void> {
    setPending(true);
    try {
      const response = await fetch(
        `/api/favorites/${encodeURIComponent(favoriteId)}`,
        { method: "DELETE" },
      );
      if (response.ok) {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      aria-label={`Remove ${mealName} from favorites`}
      className="favorite-remove"
      disabled={pending}
      onClick={() => {
        void remove();
      }}
      type="button"
    >
      {pending ? (
        <LoaderCircle size={18} aria-hidden="true" />
      ) : (
        <Bookmark size={18} fill="currentColor" aria-hidden="true" />
      )}
    </button>
  );
}
