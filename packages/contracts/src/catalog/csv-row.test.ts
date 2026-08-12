import { describe, expect, it } from "vitest";

import { parseCsvHeader, parseCsvRow } from "./csv-row.js";

const validHeader = [
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
];

const validRow = {
  restaurant_name: "McDonald's - Magsaysay / Naga Magsaysay",
  branch_name: "Magsaysay / Naga Magsaysay",
  source_platform: "GrabFood",
  source_restaurant_id: "2-C2LKHGNGCKKCJ2",
  source_url: "https://food.grab.com/ph/en/restaurant/example/2-C2LKHGNGCKKCJ2",
  cuisines: "American,Burger,Fried Chicken,Fast Food",
  category_name: "New Offers",
  item_name: "McCafé Iced Coffee Coco Mocha",
  description: "McCafé Iced Coffee Coco Mocha",
  price_php: "89.00",
  price_centavos: "8900",
  restaurant_min_price_php: "11.00",
  restaurant_max_price_php: "865.00",
  currency: "PHP",
  image_url:
    "https://huawei-food-cms.grab.com/compressed_avif/items/example/photo.avif",
  is_available: "true",
  collected_at: "2026-08-12",
};

describe("parseCsvHeader", () => {
  it("accepts the exact expected header row", () => {
    expect(() => parseCsvHeader(validHeader)).not.toThrow();
  });

  it("throws when a required column is missing", () => {
    expect(() =>
      parseCsvHeader(validHeader.filter((h) => h !== "price_centavos")),
    ).toThrow("CSV is missing required column: price_centavos");
  });

  it("throws when an unexpected extra column is present", () => {
    expect(() => parseCsvHeader([...validHeader, "extra_column"])).toThrow(
      "CSV contains unexpected column: extra_column",
    );
  });
});

describe("parseCsvRow", () => {
  it("parses a valid row into typed fields with cuisines split on comma", () => {
    const parsed = parseCsvRow(validRow);
    expect(parsed).toEqual({
      restaurantName: "McDonald's - Magsaysay / Naga Magsaysay",
      branchName: "Magsaysay / Naga Magsaysay",
      sourceRestaurantId: "2-C2LKHGNGCKKCJ2",
      sourceUrl:
        "https://food.grab.com/ph/en/restaurant/example/2-C2LKHGNGCKKCJ2",
      cuisines: ["American", "Burger", "Fried Chicken", "Fast Food"],
      categoryName: "New Offers",
      itemName: "McCafé Iced Coffee Coco Mocha",
      description: "McCafé Iced Coffee Coco Mocha",
      priceCentavos: 8900,
      imageUrl:
        "https://huawei-food-cms.grab.com/compressed_avif/items/example/photo.avif",
      isAvailable: true,
      collectedAt: "2026-08-12",
    });
  });

  it("trims whitespace around cuisine entries and drops empty ones", () => {
    const parsed = parseCsvRow({
      ...validRow,
      cuisines: " American ,, Burger ,",
    });
    expect(parsed.cuisines).toEqual(["American", "Burger"]);
  });

  it("throws when price_centavos is not a non-negative integer", () => {
    expect(() => parseCsvRow({ ...validRow, price_centavos: "-5" })).toThrow(
      "price_centavos must be a non-negative integer",
    );
  });

  it("throws when is_available is not 'true' or 'false'", () => {
    expect(() => parseCsvRow({ ...validRow, is_available: "yes" })).toThrow(
      "is_available must be 'true' or 'false'",
    );
  });

  it("throws when collected_at is not a valid YYYY-MM-DD date", () => {
    expect(() =>
      parseCsvRow({ ...validRow, collected_at: "08/12/2026" }),
    ).toThrow("collected_at must be a YYYY-MM-DD date");
  });

  it("throws when collected_at has the right shape but is not a real date", () => {
    expect(() =>
      parseCsvRow({ ...validRow, collected_at: "2026-02-31" }),
    ).toThrow("collected_at must be a real YYYY-MM-DD date");
  });

  it("rejects non-Grab source URLs and unsupported image hosts", () => {
    expect(() =>
      parseCsvRow({ ...validRow, source_url: "https://example.com/menu" }),
    ).toThrow("source_url must be an https Grab URL");
    expect(() =>
      parseCsvRow({ ...validRow, image_url: "https://example.com/image.jpg" }),
    ).toThrow("image_url must use the supported Grab image host");
  });

  it.each([
    "restaurant_name",
    "branch_name",
    "source_restaurant_id",
    "category_name",
    "item_name",
  ])("rejects a blank required %s", (field) => {
    expect(() => parseCsvRow({ ...validRow, [field]: "   " })).toThrow(
      `${field} must not be blank`,
    );
  });

  it("allows null description and null image_url", () => {
    const parsed = parseCsvRow({
      ...validRow,
      description: "",
      image_url: "",
    });
    expect(parsed.description).toBeNull();
    expect(parsed.imageUrl).toBeNull();
  });
});
