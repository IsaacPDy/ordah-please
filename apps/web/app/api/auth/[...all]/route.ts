import { toNextJsHandler } from "better-auth/next-js";

import {
  getServerAuth,
  type ServerAuth,
} from "../../../../src/auth/server-auth";

type AuthFactory = () => Pick<ServerAuth, "handler">;
type AuthRouteMethod = (request: Request) => Promise<Response>;

/** Builds lazy Next.js handlers so runtime secrets are read only when an auth request arrives. */
export function createAuthRouteHandlers(getAuth: AuthFactory): {
  readonly GET: AuthRouteMethod;
  readonly POST: AuthRouteMethod;
} {
  const handle: AuthRouteMethod = async (request) => {
    try {
      return await toNextJsHandler(getAuth()).GET(request);
    } catch {
      return Response.json(
        {
          error: {
            code: "AUTH_UNAVAILABLE",
            message: "Authentication is temporarily unavailable.",
          },
          success: false,
        },
        { status: 500 },
      );
    }
  };

  return { GET: handle, POST: handle };
}

export const { GET, POST } = createAuthRouteHandlers(getServerAuth);
