import { createDatabaseClient } from "../client.js";
import {
  linkAuthIdentityInDatabase,
  readAuthIdentityLinkGuard,
} from "./link-auth-identity.js";

/** Reads one required non-secret record identifier without displaying its value. */
function readRequiredIdentifier(
  name: "AUTH_USER_ID" | "PRODUCT_USER_ID",
): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === "") {
    throw new Error(`${name} is required.`);
  }
  return value;
}

const guard = readAuthIdentityLinkGuard();
const client = createDatabaseClient();

try {
  await linkAuthIdentityInDatabase(
    client.database,
    {
      authUserId: readRequiredIdentifier("AUTH_USER_ID"),
      productUserId: readRequiredIdentifier("PRODUCT_USER_ID"),
    },
    guard,
  );
  console.log("Development auth identity link complete.");
} finally {
  await client.close();
}
