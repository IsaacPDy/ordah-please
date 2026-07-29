/** Adds the stored Better Auth cookie without introducing a bearer token or ambient credentials. */
export function buildAuthenticatedRequestInit(
  cookie: string,
  init: RequestInit = {},
): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  headers.delete("authorization");

  return {
    ...init,
    credentials: "omit",
    headers,
  };
}
