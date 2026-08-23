import { Check, Clock3, MapPin } from "lucide-react";
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
  const votingClosed =
    now.getTime() >= view.order.restaurantDeadline.getTime();
  const foodClosed = now.getTime() >= view.order.foodDeadline.getTime();
  const restaurantName =
    view.order.restaurantName ?? view.order.initialRestaurantName;
  const branchName =
    view.order.selectedBranchName ?? view.order.initialBranchName;
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
  const orderedCount = view.participants.filter(
    (participant) =>
      participant.foodResponse === "confirmed" ||
      participant.foodResponse === "resolved",
  ).length;

  return (
    <MemberAccessState hasMemberships={hasMemberships} surface="orders">
      <div className="member-page">
        <header className="page-intro">
          <p className="eyebrow">{view.order.groupName}</p>
          <h1>
            {`${restaurantName} – ${branchName}`}{" "}
            <span className="status-pill status-pill--soft">
              {formatStateLabel(view.order.state)}
            </span>
          </h1>
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
        </header>

        {view.order.state === "restaurant_voting" ? (
          <p className="restaurant-empty">
            Restaurant voting opens here in the next update.
          </p>
        ) : null}
        {view.order.state === "ready_for_handoff" ? (
          <p className="restaurant-empty">
            The handoff summary opens here in the next update.
          </p>
        ) : null}

        {isFoodStage &&
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
              view.order.initialRestaurantId
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

        {isFoodStage && view.viewer.canManage ? (
          <section
            aria-labelledby="participants-heading"
            className="content-section"
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
                    <div className="participant-card__head">
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
                    </div>
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
                                <p className="pick-line__meta">
                                  {line.note}
                                </p>
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
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {view.viewer.canManage && view.order.state === "food_confirmation" ? (
          <FinishOrderButton orderId={view.order.orderId} />
        ) : null}

        {view.viewer.canManage &&
        view.order.state !== "ordered" &&
        view.order.state !== "cancelled" ? (
          <CancelOrderButton orderId={view.order.orderId} />
        ) : null}
      </div>
    </MemberAccessState>
  );
}
