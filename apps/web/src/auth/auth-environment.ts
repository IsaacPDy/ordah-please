export interface AuthEnvironment {
  readonly baseUrl: string;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly isProduction: boolean;
  readonly secret: string;
}

/** Reads the server-only Better Auth and Google OAuth configuration. */
export function readAuthEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthEnvironment {
  const readRequired = (
    name:
      | "BETTER_AUTH_SECRET"
      | "BETTER_AUTH_URL"
      | "GOOGLE_CLIENT_ID"
      | "GOOGLE_CLIENT_SECRET",
  ): string => {
    const value = environment[name]?.trim();
    if (value === undefined || value === "") {
      throw new Error(`${name} is required.`);
    }
    return value;
  };

  const secret = readRequired("BETTER_AUTH_SECRET");
  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters.");
  }

  const rawBaseUrl = readRequired("BETTER_AUTH_URL");
  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBaseUrl);
  } catch {
    throw new Error("BETTER_AUTH_URL must be an absolute HTTP(S) origin.");
  }
  if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
    throw new Error("BETTER_AUTH_URL must be an absolute HTTP(S) origin.");
  }
  if (
    baseUrl.pathname !== "/" ||
    baseUrl.search !== "" ||
    baseUrl.hash !== "" ||
    baseUrl.username !== "" ||
    baseUrl.password !== ""
  ) {
    throw new Error("BETTER_AUTH_URL must not include a path.");
  }

  return {
    baseUrl: baseUrl.origin,
    googleClientId: readRequired("GOOGLE_CLIENT_ID"),
    googleClientSecret: readRequired("GOOGLE_CLIENT_SECRET"),
    isProduction: environment.NODE_ENV === "production",
    secret,
  };
}
