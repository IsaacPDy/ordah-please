"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { formatCentavos, parseCentavos } from "@ordah-please/domain";

export interface PickerFavorite {
  readonly favoriteId: string;
  readonly rank: number;
  readonly name: string;
  readonly description: string | null;
  readonly priceCentavos: number | null;
  readonly available: boolean;
}

/** The member-facing favorites picker for one open order. */
export function FoodPickerSection({
  orderId,
  restaurantId,
  restaurantName,
  favorites,
  currentStatus,
  currentLines,
  locked,
}: {
  readonly orderId: string;
  readonly restaurantId: string;
  readonly restaurantName: string;
  readonly favorites: readonly PickerFavorite[];
  readonly currentStatus: "pending" | "confirmed" | "declined" | "resolved";
  readonly currentLines: readonly {
    readonly itemName: string;
    readonly note: string;
    readonly quantity: number;
  }[];
  readonly locked: boolean;
}) {
  const router = useRouter();
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function post(body: Record<string, unknown>): Promise<void> {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/food-response`,
        {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      if (!response.ok) {
        const failure = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setMessage(
          failure?.error?.message ?? "Couldn't save your pick. Try again.",
        );
        return;
      }
      setSelectedFavoriteId(null);
      router.refresh();
    } catch {
      setMessage("Couldn't reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  const heading =
    currentStatus === "confirmed"
      ? "Ready to order"
      : currentStatus === "declined"
        ? "Not eating"
        : "Your favorite picks";
  const selected =
    favorites.find((favorite) => favorite.favoriteId === selectedFavoriteId) ??
    null;

  return (
    <section aria-labelledby="food-picks-heading" className="content-section">
      <p className="eyebrow">{`${restaurantName} favorites`}</p>
      <div className="section-heading-row">
        <h2 id="food-picks-heading">{heading}</h2>
        <span className="count-badge">{favorites.length}</span>
      </div>

      {locked ? (
        <p className="locked-note">
          {currentStatus === "confirmed"
            ? "Food picks have closed. Your pick is locked in."
            : currentStatus === "declined"
              ? "Food picks have closed. You're marked as not eating."
              : "Food picks have closed. No pick was made for you."}
        </p>
      ) : currentStatus === "pending" && favorites.length > 0 ? (
        <p className="fallback-note">
          If the deadline passes without your pick, your #1 favorite is ordered
          automatically.
        </p>
      ) : null}

      {favorites.length === 0 && !locked ? (
        <p className="restaurant-empty">
          {`No favorites for ${restaurantName} yet. `}
          <a href={`/restaurants/${encodeURIComponent(restaurantId)}`}>
            Browse the menu
          </a>
          {" to add favorites before food picks close."}
        </p>
      ) : null}

      {currentStatus === "confirmed" ? (
        <>
          <ul className="group-list">
            {currentLines.map((line) => (
              <li
                className="food-card food-card--selected"
                key={`${line.itemName}-${line.note}`}
              >
                <span className="food-card__body">
                  <span className="food-card__name">{line.itemName}</span>
                  {line.note ? (
                    <span className="food-card__meta">{line.note}</span>
                  ) : null}
                </span>
                <span className="food-card__meta">{`× ${line.quantity}`}</span>
              </li>
            ))}
          </ul>
          {locked ? null : (
            <div className="pick-actions">
              <button
                className="text-button"
                disabled={pending}
                onClick={() => {
                  void post({ kind: "clear" });
                }}
                type="button"
              >
                Cancel pick
              </button>
              <button
                className="text-button"
                disabled={pending}
                onClick={() => {
                  void post({ kind: "declined" });
                }}
                type="button"
              >
                Not eating
              </button>
            </div>
          )}
        </>
      ) : currentStatus === "declined" ? (
        locked ? null : (
          <div className="pick-actions">
            <button
              className="text-button"
              disabled={pending}
              onClick={() => {
                void post({ kind: "clear" });
              }}
              type="button"
            >
              Pick a favorite instead
            </button>
          </div>
        )
      ) : locked ? null : (
        <>
          <ul className="group-list">
            {favorites.map((favorite) => {
              const isSelected =
                favorite.favoriteId === selectedFavoriteId;
              return (
                <li key={favorite.favoriteId}>
                  <button
                    aria-pressed={isSelected}
                    className={`food-card${isSelected ? " food-card--selected" : ""}${favorite.available ? "" : " food-card--unavailable"}`}
                    disabled={!favorite.available}
                    onClick={() => {
                      setSelectedFavoriteId(
                        isSelected ? null : favorite.favoriteId,
                      );
                    }}
                    type="button"
                  >
                    <span className="food-card__body">
                      <span className="food-card__name">{favorite.name}</span>
                      {favorite.description ? (
                        <span className="food-card__meta">
                          {favorite.description}
                        </span>
                      ) : null}
                      <span className="food-card__meta">
                        {favorite.rank === 1
                          ? "#1 · ordered automatically if you don't pick"
                          : favorite.available
                            ? "Favorite"
                            : "Unavailable"}
                      </span>
                    </span>
                    <span className="food-card__price">
                      {favorite.priceCentavos === null
                        ? ""
                        : formatCentavos(parseCentavos(favorite.priceCentavos))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {selected === null ? (
            <div className="pick-actions">
              <button
                className="text-button"
                disabled={pending}
                onClick={() => {
                  void post({ kind: "declined" });
                }}
                type="button"
              >
                Not eating
              </button>
            </div>
          ) : (
            <div className="pick-actions">
              <button
                className="primary-action"
                disabled={pending}
                onClick={() => {
                  void post({
                    favoriteId: selected.favoriteId,
                    kind: "favorite",
                  });
                }}
                type="button"
              >
                {pending ? "Saving…" : "Order this!"}
              </button>
              <button
                className="text-button"
                disabled={pending}
                onClick={() => {
                  setSelectedFavoriteId(null);
                }}
                type="button"
              >
                Cancel pick
              </button>
            </div>
          )}
        </>
      )}

      {message === null ? null : (
        <p aria-live="polite" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
