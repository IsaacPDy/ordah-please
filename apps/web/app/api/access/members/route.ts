import { createListMembersHandler } from "../../../../src/features/access/access-route-handlers";
import { accessRuntime } from "../../../../src/features/access/access-runtime";

export const GET = createListMembersHandler(accessRuntime);
