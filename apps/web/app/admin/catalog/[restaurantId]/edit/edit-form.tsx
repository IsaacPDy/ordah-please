"use client";

import { useState } from "react";
import Image from "next/image";

interface ItemRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly basePriceCentavos: number;
  readonly isAvailable: boolean;
  readonly imageUrl: string | null;
  readonly sortOrder: number;
}

interface CategoryRow {
  readonly name: string;
  readonly items: readonly ItemRow[];
}

interface Detail {
  readonly restaurantId: string;
  readonly restaurantName: string;
  readonly cuisines: readonly string[];
  readonly branchId: string;
  readonly branchName: string;
  readonly grabUrl: string | null;
  readonly menuVersionPublishedAt: string;
  readonly categories: readonly CategoryRow[];
}

type SaveOutcome =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "done" }
  | { kind: "error"; message: string };

/** Client form that PATCHes restaurant and per-item edits. */
export function EditForm({ initial }: { initial: Detail }) {
  const [restaurantName, setRestaurantName] = useState(initial.restaurantName);
  const [cuisines, setCuisines] = useState(initial.cuisines.join(", "));
  const [branchName, setBranchName] = useState(initial.branchName);
  const [grabUrl, setGrabUrl] = useState(initial.grabUrl ?? "");
  const [itemsById, setItemsById] = useState<Record<string, ItemRow>>(() => {
    const map: Record<string, ItemRow> = {};
    for (const category of initial.categories) {
      for (const item of category.items) {
        map[item.id] = { ...item };
      }
    }
    return map;
  });
  const [outcome, setOutcome] = useState<SaveOutcome>({ kind: "idle" });

  function updateItem(itemId: string, patch: Partial<ItemRow>) {
    setItemsById((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId]!, ...patch },
    }));
  }

  function buildItemDiff(item: ItemRow): Record<string, unknown> {
    const original = initial.categories
      .flatMap((category) => category.items)
      .find((entry) => entry.id === item.id);
    if (!original) return {};
    const diff: Record<string, unknown> = {};
    if (item.name !== original.name) diff.name = item.name;
    if (item.description !== original.description)
      diff.description = item.description;
    if (item.basePriceCentavos !== original.basePriceCentavos) {
      diff.basePriceCentavos = item.basePriceCentavos;
    }
    if (item.isAvailable !== original.isAvailable)
      diff.isAvailable = item.isAvailable;
    if (item.imageUrl !== original.imageUrl) diff.imageUrl = item.imageUrl;
    return diff;
  }

  async function handleSave() {
    setOutcome({ kind: "saving" });
    try {
      const restaurantResponse = await fetch(
        `/api/admin/catalog/restaurants/${initial.restaurantId}`,
        {
          body: JSON.stringify({
            cuisines: cuisines
              .split(",")
              .map((entry) => entry.trim())
              .filter((entry) => entry.length > 0),
            branchName,
            grabUrl: grabUrl.length > 0 ? grabUrl : null,
            name: restaurantName,
          }),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        },
      );
      if (!restaurantResponse.ok) {
        const body = (await restaurantResponse.json()) as {
          error?: { message?: string };
        };
        throw new Error(body.error?.message ?? "Restaurant save failed.");
      }

      for (const item of Object.values(itemsById)) {
        const diff = buildItemDiff(item);
        if (Object.keys(diff).length === 0) continue;
        const response = await fetch(`/api/admin/catalog/items/${item.id}`, {
          body: JSON.stringify(diff),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        });
        if (!response.ok) {
          const body = (await response.json()) as {
            error?: { message?: string };
          };
          throw new Error(
            body.error?.message ?? `Item ${item.name} save failed.`,
          );
        }
      }
      setOutcome({ kind: "done" });
    } catch (err) {
      setOutcome({ kind: "error", message: (err as Error).message });
    }
  }

  return (
    <div className="admin-edit-form">
      <section className="admin-panel">
        <h2>Restaurant</h2>
        <label className="admin-field">
          <span>Restaurant name</span>
          <input
            onChange={(event) => setRestaurantName(event.target.value)}
            type="text"
            value={restaurantName}
          />
        </label>
        <label className="admin-field">
          <span>Cuisines (comma-separated)</span>
          <input
            onChange={(event) => setCuisines(event.target.value)}
            type="text"
            value={cuisines}
          />
        </label>
      </section>

      <section className="admin-panel">
        <h2>Branch</h2>
        <label className="admin-field">
          <span>Branch name</span>
          <input
            onChange={(event) => setBranchName(event.target.value)}
            type="text"
            value={branchName}
          />
        </label>
        <label className="admin-field">
          <span>Grab URL</span>
          <input
            onChange={(event) => setGrabUrl(event.target.value)}
            type="url"
            value={grabUrl}
          />
        </label>
      </section>

      <section className="admin-panel">
        <h2>Menu</h2>
        {initial.categories.map((category) => (
          <details key={category.name} open>
            <summary>{category.name}</summary>
            <ul className="admin-item-list">
              {category.items.map((item) => {
                const current = itemsById[item.id]!;
                return (
                  <li className="admin-item-row" key={item.id}>
                    {current.imageUrl ? (
                      <Image
                        alt=""
                        height={64}
                        src={current.imageUrl}
                        width={64}
                      />
                    ) : null}
                    <label className="admin-field">
                      <span>Name</span>
                      <input
                        onChange={(event) =>
                          updateItem(item.id, { name: event.target.value })
                        }
                        type="text"
                        value={current.name}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Description</span>
                      <input
                        onChange={(event) =>
                          updateItem(item.id, {
                            description: event.target.value || null,
                          })
                        }
                        type="text"
                        value={current.description ?? ""}
                      />
                    </label>
                    <label className="admin-field">
                      <span>Price (PHP)</span>
                      <input
                        min="0"
                        onChange={(event) =>
                          updateItem(item.id, {
                            basePriceCentavos: Math.round(
                              Number(event.target.value) * 100,
                            ),
                          })
                        }
                        step="0.01"
                        type="number"
                        value={(current.basePriceCentavos / 100).toFixed(2)}
                      />
                    </label>
                    <label className="admin-field admin-field--inline">
                      <input
                        checked={current.isAvailable}
                        onChange={(event) =>
                          updateItem(item.id, {
                            isAvailable: event.target.checked,
                          })
                        }
                        type="checkbox"
                      />
                      <span>Available</span>
                    </label>
                    <label className="admin-field">
                      <span>Image URL</span>
                      <input
                        onChange={(event) =>
                          updateItem(item.id, {
                            imageUrl: event.target.value || null,
                          })
                        }
                        type="url"
                        value={current.imageUrl ?? ""}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </section>

      <div className="admin-edit-actions">
        <button
          className="admin-primary-button"
          disabled={outcome.kind === "saving"}
          onClick={() => {
            void handleSave();
          }}
          type="button"
        >
          {outcome.kind === "saving" ? "Saving…" : "Save changes"}
        </button>
        {outcome.kind === "done" ? (
          <p className="admin-success" role="status">
            Saved.
          </p>
        ) : null}
        {outcome.kind === "error" ? (
          <p className="admin-error" role="alert">
            {outcome.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type { Detail };
