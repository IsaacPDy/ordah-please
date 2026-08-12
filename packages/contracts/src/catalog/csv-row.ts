export const CSV_REQUIRED_HEADERS = [
  "restaurant_name",
  "branch_name",
  "source_platform",
  "source_restaurant_id",
  "source_url",
  "cuisines",
  "category_name",
  "item_name",
  "description",
  "price_php",
  "price_centavos",
  "restaurant_min_price_php",
  "restaurant_max_price_php",
  "currency",
  "image_url",
  "is_available",
  "collected_at",
] as const;

export type CsvRow = Readonly<{
  restaurantName: string;
  branchName: string;
  sourceRestaurantId: string;
  sourceUrl: string;
  cuisines: readonly string[];
  categoryName: string;
  itemName: string;
  description: string | null;
  priceCentavos: number;
  imageUrl: string | null;
  isAvailable: boolean;
  collectedAt: string;
}>;

/** Validates the exact CSV header row. Throws on missing or unexpected columns. */
export function parseCsvHeader(header: readonly string[]): void {
  for (const required of CSV_REQUIRED_HEADERS) {
    if (!header.includes(required)) {
      throw new Error(`CSV is missing required column: ${required}`);
    }
  }
  for (const column of header) {
    if (
      !CSV_REQUIRED_HEADERS.includes(
        column as (typeof CSV_REQUIRED_HEADERS)[number],
      )
    ) {
      throw new Error(`CSV contains unexpected column: ${column}`);
    }
  }
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function asString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return value;
}

/** Trims one required CSV identifier and rejects an empty cell. */
function asRequiredString(value: unknown, field: string): string {
  const raw = asString(value, field).trim();
  if (raw.length === 0) {
    throw new Error(`${field} must not be blank`);
  }
  return raw;
}

function asNonNegativeInt(value: unknown, field: string): number {
  const raw = asString(value, field).trim();
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return Number(raw);
}

function asBooleanFlag(value: unknown, field: string): boolean {
  const raw = asString(value, field).trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${field} must be 'true' or 'false'`);
}

function asIsoDate(value: unknown, field: string): string {
  const raw = asString(value, field).trim();
  if (!ISO_DATE_PATTERN.test(raw)) {
    throw new Error(`${field} must be a YYYY-MM-DD date`);
  }
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== raw
  ) {
    throw new Error(`${field} must be a real YYYY-MM-DD date`);
  }
  return raw;
}

function asNullableString(value: unknown, field: string): string | null {
  const raw = asString(value, field).trim();
  return raw.length === 0 ? null : raw;
}

/** Accepts only HTTPS Grab restaurant links at the import trust boundary. */
function asGrabSourceUrl(value: unknown): string {
  const raw = asString(value, "source_url").trim();
  try {
    const url = new URL(raw);
    if (
      url.protocol === "https:" &&
      (url.hostname === "grab.com" || url.hostname.endsWith(".grab.com"))
    ) {
      return raw;
    }
  } catch {
    // The public validation message below intentionally hides parser details.
  }
  throw new Error("source_url must be an https Grab URL");
}

/** Accepts blank images or the Grab CDN host configured by the web renderer. */
function asGrabImageUrl(value: unknown): string | null {
  const raw = asNullableString(value, "image_url");
  if (raw === null) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol === "https:" &&
      url.hostname === "huawei-food-cms.grab.com"
    ) {
      return raw;
    }
  } catch {
    // The public validation message below intentionally hides parser details.
  }
  throw new Error("image_url must use the supported Grab image host");
}

function asCuisines(value: unknown): readonly string[] {
  const raw = asString(value, "cuisines");
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Parses one CSV row (as a Record<headerName, cellValue>) into a typed value. */
export function parseCsvRow(row: Record<string, unknown>): CsvRow {
  return {
    restaurantName: asRequiredString(row.restaurant_name, "restaurant_name"),
    branchName: asRequiredString(row.branch_name, "branch_name"),
    sourceRestaurantId: asRequiredString(
      row.source_restaurant_id,
      "source_restaurant_id",
    ),
    sourceUrl: asGrabSourceUrl(row.source_url),
    cuisines: asCuisines(row.cuisines),
    categoryName: asRequiredString(row.category_name, "category_name"),
    itemName: asRequiredString(row.item_name, "item_name"),
    description: asNullableString(row.description, "description"),
    priceCentavos: asNonNegativeInt(row.price_centavos, "price_centavos"),
    imageUrl: asGrabImageUrl(row.image_url),
    isAvailable: asBooleanFlag(row.is_available, "is_available"),
    collectedAt: asIsoDate(row.collected_at, "collected_at"),
  };
}
