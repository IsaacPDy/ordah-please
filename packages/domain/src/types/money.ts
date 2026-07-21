declare const centavosBrand: unique symbol;

export type Centavos = number & { readonly [centavosBrand]: "centavos" };

const philippinePesoFormatter = new Intl.NumberFormat("en-PH", {
  currency: "PHP",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

/** Validates an external value before money enters the domain as Philippine centavos. */
export function parseCentavos(value: unknown): Centavos {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Centavos must be a non-negative safe integer.");
  }

  return value as Centavos;
}

/** Formats validated centavos for Philippine-peso display without changing stored money. */
export function formatCentavos(value: Centavos): string {
  return philippinePesoFormatter.format(value / 100);
}
