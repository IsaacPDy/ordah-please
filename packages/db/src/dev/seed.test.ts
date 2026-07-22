import { describe, expect, it } from "vitest";

import { readDevelopmentSeedGuard } from "./seed.js";

describe("development seed safety", () => {
  it("rejects production and non-development environments", () => {
    expect(() =>
      readDevelopmentSeedGuard({
        DATABASE_SEED_CONFIRMATION: "ordah-please-development-seed",
        NODE_ENV: "production",
      }),
    ).toThrowError("Development fixtures require NODE_ENV=development.");
    expect(() =>
      readDevelopmentSeedGuard({
        DATABASE_SEED_CONFIRMATION: "ordah-please-development-seed",
        NODE_ENV: "test",
      }),
    ).toThrowError("Development fixtures require NODE_ENV=development.");
  });

  it("requires an explicit non-secret confirmation phrase", () => {
    expect(() =>
      readDevelopmentSeedGuard({ NODE_ENV: "development" }),
    ).toThrowError(
      "DATABASE_SEED_CONFIRMATION must explicitly allow development seeding.",
    );
  });

  it("returns a typed guard only for the explicit development combination", () => {
    expect(
      readDevelopmentSeedGuard({
        DATABASE_SEED_CONFIRMATION: "ordah-please-development-seed",
        NODE_ENV: "development",
      }),
    ).toEqual({
      confirmation: "ordah-please-development-seed",
      environment: "development",
    });
  });
});
