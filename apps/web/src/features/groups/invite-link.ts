import { createHash, randomBytes } from "node:crypto";

const PUBLIC_VALUE_BYTES = 32;
const PREFIX_LENGTH = 8;

export interface MintedInviteLink {
  readonly publicValue: string;
  readonly tokenHash: string;
  readonly tokenPrefix: string;
}

/** Mints a fresh deployment-bound invite link: public value, sha256 hash, and a short non-secret prefix. */
export function mintInviteLink(): MintedInviteLink {
  const bytes = randomBytes(PUBLIC_VALUE_BYTES);
  const publicValue = bytes.toString("base64url");
  return {
    publicValue,
    tokenHash: createHash("sha256").update(publicValue).digest("hex"),
    tokenPrefix: publicValue.slice(0, PREFIX_LENGTH),
  };
}

/** Recomputes the sha256 hash for a supplied public value, for lookup at acceptance time. */
export function hashPublicValue(publicValue: string): string {
  return createHash("sha256").update(publicValue).digest("hex");
}
