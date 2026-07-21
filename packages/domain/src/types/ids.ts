declare const recordIdBrand: unique symbol;

export type RecordId<RecordName extends string> = string & {
  readonly [recordIdBrand]: RecordName;
};

export type BranchId = RecordId<"branch">;
export type FavoriteId = RecordId<"favorite">;
export type FileId = RecordId<"file">;
export type GroupId = RecordId<"group">;
export type ImportId = RecordId<"import">;
export type JobId = RecordId<"job">;
export type MenuVersionId = RecordId<"menu-version">;
export type NotificationId = RecordId<"notification">;
export type OrderId = RecordId<"order">;
export type RestaurantId = RecordId<"restaurant">;
export type UserId = RecordId<"user">;

/** Converts a validated boundary value into the requested record ID brand. */
export function parseId<Id extends RecordId<string>>(value: unknown): Id {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError("Record ID must be a non-blank string.");
  }

  return value as Id;
}
