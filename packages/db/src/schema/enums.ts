import { pgEnum } from "drizzle-orm/pg-core";

export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "manager",
  "member",
]);
export const adminRequestStatusEnum = pgEnum("admin_request_status", [
  "pending",
  "approved",
  "rejected",
]);
export const filePurposeEnum = pgEnum("file_purpose", [
  "menu_thumbnail",
  "receipt",
  "import_source",
  "validation_report",
]);
export const fileStatusEnum = pgEnum("file_status", [
  "pending",
  "ready",
  "failed",
]);
export const catalogImportStatusEnum = pgEnum("catalog_import_status", [
  "draft",
  "invalid",
  "validated",
  "published",
  "failed",
]);
export const menuVersionStatusEnum = pgEnum("menu_version_status", [
  "draft",
  "published",
  "superseded",
]);
export const refreshStatusEnum = pgEnum("refresh_status", [
  "pending",
  "collecting",
  "review_required",
  "completed",
  "failed",
]);
export const refreshReviewOutcomeEnum = pgEnum("refresh_review_outcome", [
  "auto_published",
  "approved",
  "rejected",
  "failed",
]);
export const favoriteAvailabilityEnum = pgEnum("favorite_availability", [
  "available",
  "unavailable",
]);
export const orderStateEnum = pgEnum("order_state", [
  "draft",
  "restaurant_voting",
  "food_confirmation",
  "ready_for_handoff",
  "ordered",
  "cancelled",
]);
export const restaurantChoiceModeEnum = pgEnum("restaurant_choice_mode", [
  "voting_disabled",
  "shortlist",
  "global_catalog",
]);
export const orderParticipantRoleEnum = pgEnum("order_participant_role", [
  "manager",
  "member",
]);
export const restaurantResponseStatusEnum = pgEnum(
  "restaurant_response_status",
  ["pending", "responded"],
);
export const foodResponseStatusEnum = pgEnum("food_response_status", [
  "pending",
  "confirmed",
  "declined",
  "resolved",
]);
export const foodSelectionSourceEnum = pgEnum("food_selection_source", [
  "saved_favorite",
  "inline",
  "manager_resolution",
  "declined",
]);
export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
]);
export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);
