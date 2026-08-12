import { useCallback, useEffect, useRef, useState } from "react";

import { parseRestaurantDetailResponse } from "@ordah-please/contracts";

import {
  type CatalogRequestDependencies,
  requestCatalogData,
  runtimeCatalogDependencies,
} from "./catalog-request";

type RestaurantDetail = ReturnType<typeof parseRestaurantDetailResponse>;

export type RestaurantDetailState =
  | Readonly<{ kind: "invalid"; retry: () => void }>
  | Readonly<{ kind: "loading"; retry: () => void }>
  | Readonly<{
      detail: RestaurantDetail;
      kind: "ready";
      retry: () => void;
    }>
  | Readonly<{ kind: "error"; retry: () => void }>;

/** Loads one signed-in member restaurant menu with invalid-id and retry states. */
export function useRestaurantDetail(
  restaurantId: string | null,
  dependencies: CatalogRequestDependencies = runtimeCatalogDependencies,
): RestaurantDetailState {
  const dependenciesRef = useRef(dependencies);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<
    | Readonly<{ kind: "loading"; restaurantId: string | null }>
    | Readonly<{
        detail: RestaurantDetail;
        kind: "ready";
        restaurantId: string;
      }>
    | Readonly<{ kind: "error"; restaurantId: string }>
  >({ kind: "loading", restaurantId });
  const retry = useCallback(() => {
    setState({ kind: "loading", restaurantId });
    setAttempt((value) => value + 1);
  }, [restaurantId]);

  useEffect(() => {
    if (restaurantId === null) {
      return;
    }

    let cancelled = false;

    void requestCatalogData(
      `/api/catalog/restaurants/${encodeURIComponent(restaurantId)}`,
      parseRestaurantDetailResponse,
      dependenciesRef.current,
    )
      .then((detail) => {
        if (!cancelled) {
          setState({ detail, kind: "ready", restaurantId });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ kind: "error", restaurantId });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, restaurantId]);

  if (restaurantId === null) {
    return { kind: "invalid", retry };
  }
  if (state.restaurantId !== restaurantId) {
    return { kind: "loading", retry };
  }
  return { ...state, retry };
}
