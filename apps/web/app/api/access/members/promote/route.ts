import { createManageMemberHandler } from "../../../../../src/features/access/access-route-handlers";
import { accessRuntime } from "../../../../../src/features/access/access-runtime";

export const POST = createManageMemberHandler("promote", {
  ...accessRuntime,
  now: () => new Date(),
});
