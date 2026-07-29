import {
  buildMobileAuthOptions,
  readMobileApiUrl,
  readMobileSessionCookie,
} from "./auth-client";
import { buildAuthenticatedRequestInit } from "./authenticated-request";

jest.mock("@better-auth/expo/client", () => ({
  expoClient: (options: unknown) => ({ id: "expo", options }),
}));

jest.mock("better-auth/react", () => ({
  createAuthClient: (options: unknown) => ({ options }),
}));

jest.mock("expo-secure-store", () => ({
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
}));

describe("mobile auth client", () => {
  const storage = {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
  };

  it("configures the Expo cookie bridge for ordah please", () => {
    const options = buildMobileAuthOptions("https://api.example.test", storage);

    expect(options.baseURL).toBe("https://api.example.test");
    expect(options.plugins.map((plugin) => plugin.id)).toEqual(["expo"]);
    expect(
      (
        options.plugins[0] as unknown as {
          options: Record<string, unknown>;
        }
      ).options,
    ).toMatchObject({
      cookiePrefix: "ordah-please",
      scheme: "ordahplease",
      storage,
      storagePrefix: "ordah-please",
    });
  });

  it.each([undefined, "", "api.example.test", "https://api.example.test/path"])(
    "rejects an invalid public API origin",
    (value) => {
      expect(() => readMobileApiUrl(value)).toThrow(
        "EXPO_PUBLIC_API_URL must be an absolute HTTP(S) origin.",
      );
    },
  );

  it("adds only the stored cookie to authenticated API requests", () => {
    const options = buildAuthenticatedRequestInit(
      "ordah-please.session_token=opaque",
      {
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    expect(options).toMatchObject({
      credentials: "omit",
      method: "POST",
    });
    expect(new Headers(options.headers)).toEqual(
      new Headers({
        "content-type": "application/json",
        cookie: "ordah-please.session_token=opaque",
      }),
    );
    expect(new Headers(options.headers).has("authorization")).toBe(false);
  });

  it("requires a stored Better Auth cookie before protected native requests", () => {
    expect(
      readMobileSessionCookie({
        getCookie: () => "ordah-please.session_token=opaque",
      }),
    ).toBe("ordah-please.session_token=opaque");
    expect(() => readMobileSessionCookie({ getCookie: () => "" })).toThrow(
      "A Better Auth session is required.",
    );
  });
});
