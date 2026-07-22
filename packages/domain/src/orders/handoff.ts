import type { UserId } from "../types/ids.js";
import { parseCentavos, type Centavos } from "../types/money.js";
import type {
  FoodSelectionSnapshot,
  HandoffLine,
  MemberSubtotal,
  OrderHandoff,
  SelectedItemSnapshot,
} from "./order.js";

type HandoffSelection = Readonly<{
  userId: UserId;
  displayName: string;
  selection: Readonly<Pick<FoodSelectionSnapshot, "items">>;
}>;

type MutableLine = {
  itemName: string;
  quantity: number;
  unitPriceCentavos: Centavos;
  modifiers: string[];
  note: string;
  memberQuantities: Array<{ userId: UserId; quantity: number }>;
  lineSubtotalCentavos: Centavos;
};

/** Adds or multiplies centavos while rejecting unsafe integer overflow. */
function safeCentavos(value: number): Centavos {
  return parseCentavos(value);
}

/** Validates item totals before quantities enter a consolidated handoff line. */
function safeQuantity(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError("Quantity must be a positive safe integer.");
  }

  return value;
}

/** Calculates the configured unit price and display modifier names for one item. */
function configuredItem(item: SelectedItemSnapshot): Readonly<{
  unitPriceCentavos: Centavos;
  modifiers: readonly string[];
}> {
  let unitPrice = item.unitPriceCentavos as number;
  const modifiers: string[] = [];

  if (item.variant !== null) {
    unitPrice = safeCentavos(unitPrice + item.variant.priceDeltaCentavos);
    modifiers.push(item.variant.name);
  }

  for (const modifier of item.modifiers) {
    unitPrice = safeCentavos(
      unitPrice + modifier.priceDeltaCentavos * modifier.quantity,
    );
    modifiers.push(
      modifier.quantity === 1
        ? modifier.name
        : `${modifier.quantity}x ${modifier.name}`,
    );
  }

  return { unitPriceCentavos: safeCentavos(unitPrice), modifiers };
}

/** Builds a stable key so only exactly matching configured items consolidate. */
function consolidationKey(
  item: SelectedItemSnapshot,
  unitPriceCentavos: Centavos,
  modifiers: readonly string[],
): string {
  return JSON.stringify([
    item.menuItemId,
    item.name,
    unitPriceCentavos,
    modifiers,
    item.note,
  ]);
}

/** Builds the deterministic manual-Grab handoff with consolidated and member totals. */
export function buildOrderHandoff(input: {
  selections: readonly HandoffSelection[];
  grabUrl: string | null;
}): OrderHandoff {
  const linesByKey = new Map<string, MutableLine>();
  const memberBreakdown: MemberSubtotal[] = [];

  for (const member of input.selections) {
    let memberSubtotal = safeCentavos(0);

    for (const item of member.selection.items) {
      const itemQuantity = safeQuantity(item.quantity);
      const configured = configuredItem(item);
      const itemSubtotal = safeCentavos(
        configured.unitPriceCentavos * itemQuantity,
      );
      memberSubtotal = safeCentavos(memberSubtotal + itemSubtotal);
      const key = consolidationKey(
        item,
        configured.unitPriceCentavos,
        configured.modifiers,
      );
      const existing = linesByKey.get(key);

      if (existing === undefined) {
        linesByKey.set(key, {
          itemName: item.name,
          quantity: itemQuantity,
          unitPriceCentavos: configured.unitPriceCentavos,
          modifiers: [...configured.modifiers],
          note: item.note,
          memberQuantities: [{ userId: member.userId, quantity: itemQuantity }],
          lineSubtotalCentavos: itemSubtotal,
        });
      } else {
        existing.quantity = safeQuantity(existing.quantity + itemQuantity);
        existing.lineSubtotalCentavos = safeCentavos(
          existing.lineSubtotalCentavos + itemSubtotal,
        );
        existing.memberQuantities.push({
          userId: member.userId,
          quantity: itemQuantity,
        });
      }
    }

    memberBreakdown.push({
      userId: member.userId,
      displayName: member.displayName,
      subtotalCentavos: memberSubtotal,
    });
  }

  const lines: readonly HandoffLine[] = [...linesByKey.values()];
  const foodSubtotalCentavos = lines.reduce(
    (subtotal, line) => safeCentavos(subtotal + line.lineSubtotalCentavos),
    safeCentavos(0),
  );
  const copyableText = lines
    .map((line) => {
      const modifiers =
        line.modifiers.length === 0 ? "" : ` — ${line.modifiers.join(", ")}`;
      const note = line.note.length === 0 ? "" : ` — ${line.note}`;
      return `${line.quantity}x ${line.itemName}${modifiers}${note}`;
    })
    .join("\n");

  return {
    lines,
    memberBreakdown,
    foodSubtotalCentavos,
    copyableText,
    grabUrl: input.grabUrl,
  };
}
