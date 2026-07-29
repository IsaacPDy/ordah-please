import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const FORBIDDEN_AUTH_PACKAGES = [
  "@better-auth/infra",
  "@clerk/backend",
  "@clerk/clerk-expo",
  "@clerk/nextjs",
] as const;

interface PackageManifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
}

/** Reads one workspace manifest so the policy test covers every dependency section. */
function readManifest(pathFromRoot: string): PackageManifest {
  const repositoryRoot = resolve(import.meta.dirname, "../../..");
  return JSON.parse(
    readFileSync(resolve(repositoryRoot, pathFromRoot), "utf8"),
  ) as PackageManifest;
}

describe("authentication dependency policy", () => {
  it("forbids retired Clerk packages and Better Auth Infrastructure", () => {
    const manifests = [
      readManifest("package.json"),
      readManifest("apps/mobile/package.json"),
      readManifest("apps/web/package.json"),
    ];
    const installedNames = manifests.flatMap((manifest) => [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
    ]);

    const forbiddenInstalledNames = FORBIDDEN_AUTH_PACKAGES.filter((name) =>
      installedNames.includes(name),
    );

    expect(forbiddenInstalledNames).toEqual([]);
  });
});
