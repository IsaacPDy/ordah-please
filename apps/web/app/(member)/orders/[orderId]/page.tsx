import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  ClipboardList,
  Users,
  Utensils,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { OrderDetailSections } from "./order-detail-sections";
import Image from "next/image";
import { notFound } from "next/navigation";

import { PublicApiError } from "@ordah-please/contracts";
import { formatCentavos, parseCentavos } from "@ordah-please/domain";

import { getCurrentServerPageIdentity } from "../../../../src/auth/load-server-page-identity";
import {
  formatDeadline,
  formatStateLabel,
} from "../../../../src/features/orders/order-format";
import { ordersRuntime } from "../../../../src/features/orders/orders-runtime";
import { MemberAccessState } from "../../../components/member-access-state";
import { CancelOrderButton } from "./cancel-order-button";
import { FinishOrderButton } from "./finish-order-button";
import { FoodPickerSection } from "./food-picker-section";

type OrderView = Awaited<ReturnType<typeof ordersRuntime.loadOrderDetailView>>;

function participantStatus(
  participant: OrderView["participants"][number],
  lineCount: number,
  foodClosed: boolean,
): { readonly className: string; readonly label: string } {
  if (participant.foodResponse === "confirmed") {
    return {
      className: "participant-status participant-status--ok",
      label:
        lineCount > 0
          ? `Ordered · ${lineCount} ${lineCount === 1 ? "choice" : "choices"}`
          : "Ordered",
    };
  }
  if (participant.foodResponse === "declined") {
    return {
      className: "participant-status participant-status--muted",
      label: "Not eating",
    };
  }
  if (participant.foodResponse === "resolved") {
    return {
      className: "participant-status participant-status--ok",
      label: "Picked by the manager",
    };
  }
  if (foodClosed) {
    return {
      className: "participant-status participant-status--warn",
      label: "Did not order anything",
    };
  }
  return {
    className: "participant-status participant-status--muted",
    label: "Picking…",
  };
}

/** The living order page: one destination that adapts to the order's state. */
export default async function OrderDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly orderId: string }>;
}) {
  const { orderId } = await params;
  const identityResult = await getCurrentServerPageIdentity();
  const hasMemberships =
    identityResult.status === "authenticated" &&
    identityResult.identity.memberships.length > 0;

  let view: OrderView | undefined;
  if (identityResult.status === "authenticated") {
    try {
      view = await ordersRuntime.loadOrderDetailView(
        identityResult.identity,
        orderId,
      );
    } catch (error) {
      if (
        error instanceof PublicApiError &&
        (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
      ) {
        notFound();
      }
      throw error;
    }
  }

  if (!view) {
    return (
      <MemberAccessState hasMemberships={hasMemberships} surface="orders">
        {null}
      </MemberAccessState>
    );
  }

  const now = new Date();
  const votingClosed = now.getTime() >= view.order.restaurantDeadline.getTime();
  const foodClosed = now.getTime() >= view.order.foodDeadline.getTime();
  const restaurantName =
    view.order.restaurantName ??
    view.order.initialRestaurantName ??
    "Restaurant pending";
  const branchName =
    view.order.selectedBranchName ?? view.order.initialBranchName ?? "";
  const isTerminal =
    view.order.state === "ordered" ||
    view.order.state === "cancelled" ||
    view.order.state === "draft";
  const isFoodStage = view.order.state !== "restaurant_voting";
  const pickerLocked = foodClosed || view.order.state !== "food_confirmation";

  const linesByUser = new Map<string, OrderView["lines"][number][]>();
  for (const line of view.lines) {
    const list = linesByUser.get(line.userId) ?? [];
    list.push(line);
    linesByUser.set(line.userId, list);
  }
  const viewerUserId =
    identityResult.status === "authenticated"
      ? identityResult.identity.userId
      : null;
  const viewerParticipant = view.participants.find(
    (participant) => participant.userId === viewerUserId,
  );
  const summaryLines = view.viewer.canManage
    ? view.lines
    : view.lines.filter((line) => line.userId === viewerUserId);
  const orderedCount = view.participants.filter(
    (participant) =>
      participant.foodResponse === "confirmed" ||
      participant.foodResponse === "resolved",
  ).length;

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="orders">
      <div
        className={`member-page order-detail-page${isTerminal ? " order-detail-page--terminal" : " order-detail-page--social"}`}
      >
        {!isTerminal ? (
          <nav className="session-sidebar" aria-label="Session navigation">
            <Link href="/" className="session-sidebar__back">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to home
            </Link>
            <a href="#session-overview">
              <ClipboardList size={16} aria-hidden="true" />
              Order session
            </a>
            {view.viewer.canManage ||
            view.order.state === "restaurant_voting" ? (
              <a href="#participants-heading">
                <Users size={16} aria-hidden="true" />
                Participants
              </a>
            ) : null}
            <Link
              href={`/restaurants/${view.order.selectedRestaurantId ?? view.order.initialRestaurantId}`}
            >
              <Utensils size={16} aria-hidden="true" />
              Menu
            </Link>
            <a href="#shared-order-summary">
              <ClipboardList size={16} aria-hidden="true" />
              Order summary
            </a>
            {view.viewer.canManage ? (
              <a href="#session-settings">
                <Settings size={16} aria-hidden="true" />
                Settings
              </a>
            ) : null}
          </nav>
        ) : null}
        {!isTerminal ? (
          <ol className="order-stage-track" aria-label="Session progress">
            {["Restaurant", "Food", "Review"].map((label, index) => (
              <li
                key={label}
                aria-current={
                  (view.order.state === "restaurant_voting"
                    ? 0
                    : view.order.state === "food_confirmation"
                      ? 1
                      : 2) === index
                    ? "step"
                    : undefined
                }
              >
                {label}
              </li>
            ))}
          </ol>
        ) : null}
        {view.viewer.canEdit ? (
          <Link className="secondary-action" href={`/orders/${orderId}/edit`}>
            Edit or delete session
          </Link>
        ) : null}
        {(view.order.state === "draft" ||
          view.order.state === "ready_for_handoff" ||
          view.order.state === "restaurant_voting") &&
        view.viewer.canManage ? (
          <FinishOrderButton orderId={orderId} applyFavorites={false} />
        ) : null}
        {isTerminal && view.order.restaurantImageUrl ? (
          <Image
            alt=""
            className="order-detail-hero"
            src={view.order.restaurantImageUrl}
            width={430}
            height={180}
          />
        ) : null}
        <header
          id="session-overview"
          className={`page-intro order-detail-header${!isTerminal ? " order-detail-header--active" : ""}`}
        >
          {!isTerminal && view.order.restaurantImageUrl ? (
            <Image
              className="active-session-photo"
              src={view.order.restaurantImageUrl}
              alt=""
              width={393}
              height={220}
            />
          ) : null}
          <span className="status-pill status-pill--complete">
            {formatStateLabel(view.order.state)}
          </span>
          {isTerminal ? (
            <>
              <p className="eyebrow">{view.order.groupName}</p>
              <h1>
                {branchName
                  ? `${restaurantName} – ${branchName}`
                  : restaurantName}
              </h1>
            </>
          ) : (
            <>
              <h1>{view.order.groupName}</h1>
              <p className="session-restaurant">
                {branchName
                  ? `${restaurantName} – ${branchName}`
                  : restaurantName}
              </p>
            </>
          )}
          {isTerminal ? (
            <div className="terminal-order-meta">
              <p>
                {view.order.completedAt
                  ? new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "Asia/Manila",
                    }).format(view.order.completedAt)
                  : "Saved before completion"}{" "}
                · {view.participants.length} people
              </p>
              <div>
                <strong>
                  {formatCentavos(
                    parseCentavos(
                      view.lines.reduce(
                        (sum, line) => sum + line.lineSubtotalCentavos,
                        0,
                      ),
                    ),
                  )}
                </strong>
                <small>
                  {view.viewer.canManage
                    ? "Food subtotal"
                    : "Your food subtotal"}
                </small>
              </div>
            </div>
          ) : (
            <>
              {" "}
              <p className="deadline">
                <Clock3 aria-hidden="true" size={16} />{" "}
                {`Voting ${votingClosed ? "closed" : "ends"} · ${formatDeadline(view.order.restaurantDeadline)}`}
              </p>
              <p className="deadline">
                <Clock3 aria-hidden="true" size={16} />{" "}
                {`Food picks ${foodClosed ? "ended" : "end"} · ${formatDeadline(view.order.foodDeadline)}`}
              </p>
              <p className="deadline">
                <MapPin aria-hidden="true" size={16} />{" "}
                {`${view.order.deliveryAddress.lineOne}, ${view.order.deliveryAddress.city}`}
              </p>
            </>
          )}
          {!isTerminal ? (
            <div className="session-quick-actions">
              <Link
                className="secondary-action"
                href={`/restaurants/${view.order.selectedRestaurantId ?? view.order.initialRestaurantId}`}
              >
                View restaurant
              </Link>
              {view.viewer.canManage && isFoodStage ? (
                <a className="primary-action" href="#participants-heading">
                  Manage order
                </a>
              ) : null}
            </div>
          ) : null}
        </header>

        {!isTerminal ? (
          <aside className="session-summary" id="shared-order-summary">
            <h2>
              {view.viewer.canManage
                ? "Group order summary"
                : "Your order summary"}
            </h2>
            <strong className="session-summary__total">
              {formatCentavos(
                parseCentavos(
                  summaryLines.reduce(
                    (sum, line) => sum + line.lineSubtotalCentavos,
                    0,
                  ),
                ),
              )}
            </strong>
            <small>
              {summaryLines.reduce((sum, line) => sum + line.quantity, 0)} items
              · Food subtotal
            </small>
            <p>Excludes delivery fees, discounts, and promotions.</p>
            {view.order.state === "food_confirmation" ? (
              <div className="session-summary__waiting">
                <Clock3 size={20} aria-hidden="true" />
                <span>
                  {foodClosed
                    ? "Food picks have ended."
                    : `${view.participants.filter((participant) => participant.foodResponse === "pending").length} people have not responded.`}
                  <small>
                    Rank 1 is included automatically at the deadline when
                    available.
                  </small>
                </span>
              </div>
            ) : null}
          </aside>
        ) : null}
        {!isTerminal ? (
          <div
            className="session-response-progress"
            aria-label="Participant response progress"
          >
            <progress
              max={view.participants.length || 1}
              value={
                view.order.state === "restaurant_voting"
                  ? view.participants.filter(
                      (participant) =>
                        participant.restaurantResponse === "responded",
                    ).length
                  : view.participants.filter(
                      (participant) => participant.foodResponse !== "pending",
                    ).length
              }
            />
            <small>
              {view.order.state === "restaurant_voting"
                ? view.participants.filter(
                    (participant) =>
                      participant.restaurantResponse === "responded",
                  ).length
                : view.participants.filter(
                    (participant) => participant.foodResponse !== "pending",
                  ).length}{" "}
              of {view.participants.length} have responded
            </small>
          </div>
        ) : null}
        {view.order.state === "restaurant_voting" ? (
          <p className="restaurant-empty">
            Restaurant voting opens here in the next update.
          </p>
        ) : null}
        {view.order.state === "ready_for_handoff" ? (
          <p className="restaurant-empty">
            This session is ready to finish. You can update its details
            afterward.
          </p>
        ) : null}

        {!isTerminal &&
        isFoodStage &&
        viewerParticipant !== undefined &&
        view.viewer.kind === "participant" ? (
          <FoodPickerSection
            currentLines={(linesByUser.get(viewerParticipant.userId) ?? []).map(
              (line) => ({
                itemName: line.itemName,
                note: line.note,
                quantity: line.quantity,
              }),
            )}
            currentStatus={viewerParticipant.foodResponse}
            favorites={view.viewerFavorites}
            locked={pickerLocked}
            orderId={view.order.orderId}
            restaurantId={
              view.order.selectedRestaurantId ??
              view.order.initialRestaurantId ??
              ""
            }
            restaurantName={restaurantName}
          />
        ) : null}

        {view.order.state === "food_confirmation" && !view.viewer.canManage ? (
          <p className="pick-progress">{`${orderedCount} of ${view.participants.length} ordered`}</p>
        ) : null}

        {view.order.state === "restaurant_voting" ? (
          <section
            aria-labelledby="participants-heading"
            className="content-section"
          >
            <div className="section-heading-row">
              <h2 id="participants-heading">Participants</h2>
              <span className="count-badge">{view.participants.length}</span>
            </div>
            <ul className="group-list">
              {view.participants.map((participant) => (
                <li className="group-card" key={participant.userId}>
                  <span aria-hidden="true" className="group-card__icon">
                    {participant.displayName.charAt(0)}
                  </span>
                  <span className="group-card__body">
                    <span className="group-card__name">
                      {participant.displayName}
                    </span>
                    <span className="group-card__meta">
                      {participant.role === "manager"
                        ? "Order manager"
                        : "Member"}{" "}
                      ·{" "}
                      {participant.restaurantResponse === "responded"
                        ? "Voted"
                        : "Hasn't voted"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {isTerminal ? (
          <OrderDetailSections
            participants={<TerminalOrderLog view={view} />}
            details={
              <section className="order-saved-details">
                <h2>Order details</h2>{" "}
                <p className="deadline">
                  <Clock3 aria-hidden="true" size={16} />{" "}
                  {`Voting ${votingClosed ? "closed" : "ends"} · ${formatDeadline(view.order.restaurantDeadline)}`}
                </p>
                <p className="deadline">
                  <Clock3 aria-hidden="true" size={16} />{" "}
                  {`Food picks ${foodClosed ? "ended" : "end"} · ${formatDeadline(view.order.foodDeadline)}`}
                </p>
                <p className="deadline">
                  <MapPin aria-hidden="true" size={16} />{" "}
                  {`${view.order.deliveryAddress.lineOne}, ${view.order.deliveryAddress.city}`}
                </p>
                <p>
                  {view.viewer.canEdit
                    ? "You can edit this session, including its participants and saved food."
                    : "These saved details are read-only."}
                </p>
              </section>
            }
          />
        ) : null}

        {!isTerminal && isFoodStage && view.viewer.canManage ? (
          <section
            aria-labelledby="participants-heading"
            className="content-section session-participants"
          >
            <p className="info-banner">
              Top favorites stay visible until a participant confirms one meal.
            </p>
            <div className="section-heading-row">
              <h2 id="participants-heading">Participants</h2>
              <span className="count-badge">{view.participants.length}</span>
            </div>
            <ul className="group-list">
              {view.participants.map((participant) => {
                const lines = linesByUser.get(participant.userId) ?? [];
                const status = participantStatus(
                  participant,
                  lines.length,
                  foodClosed,
                );
                return (
                  <li className="participant-card" key={participant.userId}>
                    <details className="session-participant-details">
                      <summary className="participant-card__head">
                        <div className="participant-card__id">
                          <span aria-hidden="true" className="member-avatar">
                            {participant.displayName.charAt(0)}
                          </span>
                          <div>
                            <p className="participant-card__name">
                              {participant.displayName}
                            </p>
                            <p className="participant-card__meta">
                              {participant.role === "manager"
                                ? "Order manager"
                                : "Member"}
                            </p>
                          </div>
                        </div>
                        <p className={status.className}>
                          {participant.foodResponse === "confirmed" ? (
                            <Check aria-hidden="true" size={16} />
                          ) : null}
                          {status.label}
                        </p>
                        {lines.length > 0 ? (
                          <span className="session-participant-view">
                            View
                            <ChevronRight size={14} aria-hidden="true" />
                          </span>
                        ) : null}
                      </summary>
                      {lines.length > 0 ? (
                        <ul className="participant-card__lines">
                          {lines.map((line) => (
                            <li
                              className="pick-line"
                              key={`${participant.userId}-${line.itemName}-${line.note}`}
                            >
                              <div>
                                <p className="pick-line__name">
                                  {line.itemName}
                                </p>
                                {line.note ? (
                                  <p className="pick-line__meta">{line.note}</p>
                                ) : null}
                                <p className="pick-line__meta">{`× ${line.quantity}`}</p>
                              </div>
                              <p className="pick-line__price">
                                {formatCentavos(
                                  parseCentavos(line.lineSubtotalCentavos),
                                )}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="session-settings" id="session-settings">
          {view.viewer.canManage && view.order.state === "food_confirmation" ? (
            <FinishOrderButton orderId={view.order.orderId} />
          ) : null}

          {view.viewer.canManage &&
          view.order.state !== "ordered" &&
          view.order.state !== "cancelled" ? (
            <CancelOrderButton orderId={view.order.orderId} />
          ) : null}
        </div>
      </div>
    </MemberAccessState>
  );
}

/** Shows exact immutable food lines for the participants visible to this viewer. */
function TerminalOrderLog({ view }: { readonly view: OrderView }) {
  const linesByUser = new Map<string, OrderView["lines"][number][]>();
  for (const line of view.lines) {
    const lines = linesByUser.get(line.userId) ?? [];
    lines.push(line);
    linesByUser.set(line.userId, lines);
  }

  return (
    <section aria-labelledby="order-log-heading" className="content-section">
      <div className="section-heading-row">
        <h2 id="order-log-heading">Order log</h2>
        <span className="count-badge">{view.participants.length}</span>
      </div>
      <ul className="group-list">
        {view.participants.map((participant) => {
          const lines = linesByUser.get(participant.userId) ?? [];
          const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
          const status =
            participant.foodResponse === "declined"
              ? "Not eating"
              : itemCount === 0
                ? "No food selected"
                : `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
          return (
            <li className="participant-card" key={participant.userId}>
              <details className="terminal-participant">
                <summary className="participant-card__head">
                  <div className="participant-card__id">
                    <span aria-hidden="true" className="member-avatar">
                      {participant.displayName.charAt(0)}
                    </span>
                    <div>
                      <p className="participant-card__name">
                        {participant.displayName}
                      </p>
                      <p className="participant-card__meta">{status}</p>
                    </div>
                  </div>
                  {lines.length ? (
                    <strong className="participant-subtotal">
                      {formatCentavos(
                        parseCentavos(
                          lines.reduce(
                            (sum, line) => sum + line.lineSubtotalCentavos,
                            0,
                          ),
                        ),
                      )}
                    </strong>
                  ) : null}
                  <ChevronRight
                    aria-hidden="true"
                    className="terminal-participant__chevron"
                    size={18}
                  />
                </summary>
                {lines.length === 0 ? null : (
                  <ul className="participant-card__lines">
                    {lines.map((line, index) => (
                      <li
                        className="pick-line"
                        key={`${participant.userId}-${line.itemName}-${index}`}
                      >
                        <div>
                          <p className="pick-line__name">{line.itemName}</p>
                          {line.note.length === 0 ? null : (
                            <p className="pick-line__meta">{line.note}</p>
                          )}
                          <p className="pick-line__meta">× {line.quantity}</p>
                        </div>
                        <p className="pick-line__price">
                          {formatCentavos(
                            parseCentavos(line.lineSubtotalCentavos),
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
