export const APPLICATION_ROLES = [
  "member",
  "organizer",
  "group-owner",
  "platform-admin",
] as const;

export type ApplicationRole = (typeof APPLICATION_ROLES)[number];

export const ORDER_ROLES = ["participant", "organizer"] as const;

export type OrderRole = (typeof ORDER_ROLES)[number];
