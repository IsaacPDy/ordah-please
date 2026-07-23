import { PublicApiError } from "@ordah-please/contracts";

export type AuthorizationPolicy<Context> = (
  context: Context,
) => boolean | Promise<boolean>;

/** Enforces one product authorization policy after the caller's Neon identity is loaded. */
export async function authorize<Context>(
  context: Context,
  policy: AuthorizationPolicy<Context>,
): Promise<void> {
  if (!(await policy(context))) {
    throw new PublicApiError(
      "FORBIDDEN",
      "You do not have access to this action.",
    );
  }
}
