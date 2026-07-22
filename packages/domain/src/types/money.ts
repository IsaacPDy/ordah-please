declare const centavosBrand: unique symbol;

export type Centavos = number & { readonly [centavosBrand]: "centavos" };

const integerPesoFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  useGrouping: true,
});

/** Validates an external value before money enters the domain as Philippine centavos. */
export function parseCentavos(value: unknown): Centavos {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    Object.is(value, -0)
  ) {
    throw new TypeError("Centavos must be a non-negative safe integer.");
  }

  return value as Centavos;
}

/** Formats validated centavos for Philippine-peso display without changing stored money. */
export function formatCentavos(value: Centavos): string {
  const integerCentavos = BigInt(value);
  const wholePesos = integerCentavos / 100n;
  const remainingCentavos = integerCentavos % 100n;

  return `₱${integerPesoFormatter.format(wholePesos)}.${remainingCentavos
    .toString()
    .padStart(2, "0")}`;
}
