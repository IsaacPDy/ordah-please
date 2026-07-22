import { createDatabaseClient } from "../client.js";
import { readDevelopmentSeedGuard, seedDevelopmentData } from "./seed.js";

const guard = readDevelopmentSeedGuard();
const client = createDatabaseClient();

try {
  const summary = await seedDevelopmentData(client.database, guard);
  console.log(
    `Development seed complete: ${summary.users} users, ${summary.groups} group, ${summary.restaurants} restaurant, ${summary.branches} branch, ${summary.menuItems} menu items.`,
  );
} finally {
  await client.close();
}
