import type { MenuItemId } from "@ordah-please/domain";

import {
  parseRecordId,
  parseStrictObject,
  rejectUnknownFields,
} from "../common/strict-boundary.js";

/** Parses the member request that saves one menu item as a favorite. */
export function parseFavoriteSaveRequest(
  value: unknown,
): Readonly<{ menuItemId: MenuItemId }> {
  const object = parseStrictObject(value, "Favorite save request");
  rejectUnknownFields(object, ["menuItemId"], "Favorite save request");

  return {
    menuItemId: parseRecordId<MenuItemId>(
      object.menuItemId,
      "Favorite menu item id",
    ),
  };
}
