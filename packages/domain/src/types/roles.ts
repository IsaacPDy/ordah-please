export const APPLICATION_ROLES = [
  "member",
  "manager",
  "group-owner",
  "platform-admin",
] as const;

export type ApplicationRole = (typeof APPLICATION_ROLES)[number];

export const ORDER_ROLES = ["participant", "manager"] as const;

export type OrderRole = (typeof ORDER_ROLES)[number];
