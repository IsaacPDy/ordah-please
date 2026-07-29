import { createManageMemberHandler } from "../../../../../src/features/access/access-route-handlers";
import { accessRuntime } from "../../../../../src/features/access/access-runtime";

export const POST = createManageMemberHandler("remove", {
  ...accessRuntime,
  now: () => new Date(),
});
