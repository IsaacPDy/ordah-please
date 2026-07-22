/** Returns the row produced by a required write and reports an invariant breach if none was returned. */
export function requireWrittenRow<TRow>(rows: readonly TRow[]): TRow {
  const row = rows[0];
  if (row === undefined) {
    throw new Error("The database write did not return its required row.");
  }

  return row;
}
