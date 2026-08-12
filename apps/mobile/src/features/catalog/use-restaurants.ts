import { useCallback, useEffect, useRef, useState } from "react";

import { parseRestaurantListResponse } from "@ordah-please/contracts";

import {
  type CatalogRequestDependencies,
  requestCatalogData,
  runtimeCatalogDependencies,
} from "./catalog-request";

type RestaurantSummary = ReturnType<typeof parseRestaurantListResponse>[number];

export type RestaurantsState =
  | Readonly<{ kind: "loading"; retry: () => void }>
  | Readonly<{
      kind: "ready";
      restaurants: readonly RestaurantSummary[];
      retry: () => void;
    }>
  | Readonly<{ kind: "error"; retry: () => void }>;

/** Loads the signed-in member's restaurant browse list with a retryable state. */
export function useRestaurants(
  dependencies: CatalogRequestDependencies = runtimeCatalogDependencies,
): RestaurantsState {
  const dependenciesRef = useRef(dependencies);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<
    | Readonly<{ kind: "loading" }>
    | Readonly<{
        kind: "ready";
        restaurants: readonly RestaurantSummary[];
      }>
    | Readonly<{ kind: "error" }>
  >({ kind: "loading" });
  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void requestCatalogData(
      "/api/catalog/restaurants",
      parseRestaurantListResponse,
      dependenciesRef.current,
    )
      .then((restaurants) => {
        if (!cancelled) {
          setState({ kind: "ready", restaurants });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ kind: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { ...state, retry };
}
