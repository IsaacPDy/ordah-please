"use client";

import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface WizardMember {
  readonly displayName: string;
  readonly role: "owner" | "manager" | "member";
  readonly userId: string;
}

interface WizardRestaurant {
  readonly restaurantId: string;
  readonly restaurantName: string;
  readonly branchId: string;
  readonly branchName: string;
}

interface WizardAddress {
  readonly recipientName: string;
  readonly phoneNumber: string;
  readonly lineOne: string;
  readonly lineTwo: string | null;
  readonly city: string;
  readonly postalCode: string | null;
  readonly notes: string | null;
}

/** One-screen order setup: participants, address, fallback, deadlines, voting mode. */
export function NewOrderWizard({
  groupAddress,
  groupId,
  groupName,
  managerUserId,
  members,
  restaurants,
}: {
  readonly groupAddress: WizardAddress | null;
  readonly groupId: string;
  readonly groupName: string;
  readonly managerUserId: string;
  readonly members: readonly WizardMember[];
  readonly restaurants: readonly WizardRestaurant[];
}) {
  const router = useRouter();
  // The manager is always a participant; never let them toggle or count themselves.
  const selectableMembers = members.filter(
    (member) => member.userId !== managerUserId,
  );
  const manager = members.find((member) => member.userId === managerUserId);
  const [participants, setParticipants] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [recipientName, setRecipientName] = useState(
    groupAddress?.recipientName ?? "",
  );
  const [phoneNumber, setPhoneNumber] = useState(
    groupAddress?.phoneNumber ?? "",
  );
  const [lineOne, setLineOne] = useState(groupAddress?.lineOne ?? "");
  const [lineTwo, setLineTwo] = useState(groupAddress?.lineTwo ?? "");
  const [city, setCity] = useState(groupAddress?.city ?? "");
  const [postalCode, setPostalCode] = useState(groupAddress?.postalCode ?? "");
  const [notes, setNotes] = useState(groupAddress?.notes ?? "");
  const [saveAsGroupDefault, setSaveAsGroupDefault] = useState(false);
  const [fallbackRestaurantId, setFallbackRestaurantId] = useState("");
  const [votingMode, setVotingMode] = useState<
    "voting_disabled" | "shortlist" | "global_catalog"
  >("voting_disabled");
  const [shortlistIds, setShortlistIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [restaurantDeadline, setRestaurantDeadline] = useState("");
  const [foodDeadline, setFoodDeadline] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fallbackRestaurant = restaurants.find(
    (restaurant) => restaurant.restaurantId === fallbackRestaurantId,
  );
  const votingEnabled = votingMode !== "voting_disabled";

  const shortlistComplete =
    votingMode !== "shortlist" ||
    (shortlistIds.size >= 2 && shortlistIds.has(fallbackRestaurantId));

  const readyToStart =
    recipientName.trim().length > 0 &&
    phoneNumber.trim().length > 0 &&
    lineOne.trim().length > 0 &&
    city.trim().length > 0 &&
    fallbackRestaurant !== undefined &&
    foodDeadline.length > 0 &&
    (!votingEnabled || restaurantDeadline.length > 0) &&
    shortlistComplete;

  const missingItems: string[] = [];
  if (
    recipientName.trim().length === 0 ||
    phoneNumber.trim().length === 0 ||
    lineOne.trim().length === 0 ||
    city.trim().length === 0
  ) {
    missingItems.push("address details");
  }
  if (fallbackRestaurant === undefined) {
    missingItems.push("Pick a fallback restaurant");
  }
  if (
    foodDeadline.length === 0 ||
    (votingEnabled && restaurantDeadline.length === 0)
  ) {
    missingItems.push("Pick voting and food deadlines");
  }
  if (!shortlistComplete) {
    missingItems.push("Pick at least two shortlist restaurants");
  }

  function toggle(
    set: ReadonlySet<string>,
    value: string,
  ): ReadonlySet<string> {
    const next = new Set(set);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    return next;
  }

  function toggleShortlist(restaurantId: string): void {
    if (restaurantId === fallbackRestaurantId) {
      return;
    }
    setShortlistIds((current) => toggle(current, restaurantId));
  }

  async function startOrder(): Promise<void> {
    if (fallbackRestaurant === undefined) {
      setMessage("Pick a fallback restaurant first.");
      return;
    }
    if (
      !Number.isFinite(new Date(foodDeadline).getTime()) ||
      (votingEnabled &&
        !Number.isFinite(new Date(restaurantDeadline).getTime()))
    ) {
      setMessage("Enter a valid date and time for the deadlines.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/orders", {
        body: JSON.stringify({
          deliveryAddress: {
            city,
            lineOne,
            lineTwo: lineTwo.trim().length === 0 ? null : lineTwo,
            notes: notes.trim().length === 0 ? null : notes,
            phoneNumber,
            postalCode: postalCode.trim().length === 0 ? null : postalCode,
            recipientName,
          },
          foodDeadline: new Date(foodDeadline).toISOString(),
          groupId,
          initialBranchId: fallbackRestaurant.branchId,
          initialRestaurantId: fallbackRestaurant.restaurantId,
          participantUserIds: [...participants],
          restaurantDeadline: votingEnabled
            ? new Date(restaurantDeadline).toISOString()
            : null,
          saveAsGroupDefault,
          shortlistRestaurantIds:
            votingMode === "shortlist" ? [...shortlistIds] : [],
          votingMode,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { orderId?: string };
        error?: { message?: string };
      } | null;
      if (!response.ok || body?.data?.orderId === undefined) {
        setMessage(body?.error?.message ?? "Couldn't start the order.");
        return;
      }
      router.push(`/orders/${body.data.orderId}`);
    } catch {
      setMessage("Couldn't reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-label={`New order for ${groupName}`}
      className="setup-form"
      onSubmit={(event) => {
        event.preventDefault();
        void startOrder();
      }}
    >
      <fieldset className="setup-form__section">
        <legend>1. Who’s joining?</legend>
        <p className="setup-form__hint">
          You are included automatically as the order manager.
        </p>
        <ul className="participant-grid">
          <li>
            <label className="participant-option participant-option--selected">
              <span>
                <strong>{manager?.displayName ?? "You"}</strong>
                <small>Order manager · required</small>
              </span>
              <input checked disabled readOnly type="checkbox" />
              <Check
                aria-hidden="true"
                className="participant-option__check"
                size={16}
              />
            </label>
          </li>
          {selectableMembers.map((member) => (
            <li key={member.userId}>
              <label
                className={`participant-option${participants.has(member.userId) ? " participant-option--selected" : ""}`}
              >
                <span>
                  <strong>{member.displayName}</strong>
                  <small>
                    {member.role === "member" ? "Member" : member.role}
                  </small>
                </span>
                <input
                  checked={participants.has(member.userId)}
                  onChange={() =>
                    setParticipants((current) => toggle(current, member.userId))
                  }
                  type="checkbox"
                />
                {participants.has(member.userId) ? (
                  <Check
                    aria-hidden="true"
                    className="participant-option__check"
                    size={16}
                  />
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="setup-form__section">
        <legend>2. Where should it go?</legend>
        <p className="setup-form__hint">
          Choose a saved place or edit the delivery details.
        </p>
        <label>
          Recipient name
          <input
            onChange={(event) => setRecipientName(event.target.value)}
            required
            value={recipientName}
          />
        </label>
        <label>
          Phone number
          <input
            onChange={(event) => setPhoneNumber(event.target.value)}
            required
            value={phoneNumber}
          />
        </label>
        <label>
          Address line 1
          <input
            onChange={(event) => setLineOne(event.target.value)}
            required
            value={lineOne}
          />
        </label>
        <label>
          Address line 2
          <input
            onChange={(event) => setLineTwo(event.target.value)}
            value={lineTwo}
          />
        </label>
        <label>
          City
          <input
            onChange={(event) => setCity(event.target.value)}
            required
            value={city}
          />
        </label>
        <label>
          Postal code
          <input
            onChange={(event) => setPostalCode(event.target.value)}
            value={postalCode}
          />
        </label>
        <label>
          Notes for the courier
          <input
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </label>
        <label>
          <input
            checked={saveAsGroupDefault}
            onChange={(event) => setSaveAsGroupDefault(event.target.checked)}
            type="checkbox"
          />{" "}
          Save as this group&apos;s default address
        </label>
      </fieldset>

      <fieldset className="setup-form__section">
        <legend>3. Pick a fallback restaurant</legend>
        <label>
          Restaurant
          <select
            onChange={(event) => {
              setFallbackRestaurantId(event.target.value);
              setShortlistIds((current) => {
                const next = new Set(current);
                next.delete(fallbackRestaurantId);
                next.add(event.target.value);
                return next;
              });
            }}
            required
            value={fallbackRestaurantId}
          >
            <option value="">Pick a restaurant…</option>
            {restaurants.map((restaurant) => (
              <option
                key={restaurant.restaurantId}
                value={restaurant.restaurantId}
              >
                {restaurant.restaurantName} — {restaurant.branchName}
              </option>
            ))}
          </select>
        </label>
        <p className="setup-form__hint">
          The fallback wins automatically when no restaurant reaches half the
          votes or the vote is tied.
        </p>
      </fieldset>

      <fieldset className="setup-form__section">
        <legend>4. How do we choose?</legend>
        <p className="setup-form__hint">
          Let the group vote or decide the restaurant now.
        </p>
        <label>
          How the restaurant is chosen
          <select
            onChange={(event) =>
              setVotingMode(
                event.target.value as
                  "voting_disabled" | "shortlist" | "global_catalog",
              )
            }
            value={votingMode}
          >
            <option value="voting_disabled">Voting off</option>
            <option value="shortlist">Shortlist</option>
            <option value="global_catalog">Whole catalog</option>
          </select>
        </label>
        {votingEnabled ? (
          <label>
            Voting ends
            <input
              onChange={(event) => setRestaurantDeadline(event.target.value)}
              required
              type="datetime-local"
              value={restaurantDeadline}
            />
          </label>
        ) : null}
        <label>
          Food picks end
          <input
            onChange={(event) => setFoodDeadline(event.target.value)}
            required
            type="datetime-local"
            value={foodDeadline}
          />
        </label>
      </fieldset>

      {votingMode === "shortlist" ? (
        <fieldset className="setup-form__section">
          <legend>5 · Shortlist</legend>
          <ul className="participant-grid">
            {restaurants.map((restaurant) => (
              <li key={restaurant.restaurantId}>
                <label>
                  <input
                    checked={
                      restaurant.restaurantId === fallbackRestaurantId ||
                      shortlistIds.has(restaurant.restaurantId)
                    }
                    disabled={restaurant.restaurantId === fallbackRestaurantId}
                    onChange={() => toggleShortlist(restaurant.restaurantId)}
                    type="checkbox"
                  />{" "}
                  {restaurant.restaurantName}
                </label>
              </li>
            ))}
          </ul>
          <p className="setup-form__hint">
            Pick at least two. The fallback restaurant is always on the list.
          </p>
        </fieldset>
      ) : null}

      <fieldset className="setup-form__section">
        <legend>Review</legend>
        <p>
          {participants.size + 1}{" "}
          {participants.size + 1 === 1 ? "participant" : "participants"} ·{" "}
          {fallbackRestaurant?.restaurantName ?? "no restaurant picked"} ·{" "}
          {votingEnabled ? "with voting" : "voting off"}
        </p>
        {message === null ? null : (
          <p aria-live="polite" role="status">
            {message}
          </p>
        )}
        <button
          className="primary-action"
          disabled={pending || !readyToStart}
          type="submit"
        >
          {pending ? "Starting…" : "Start order"}
          {pending ? null : <ArrowRight aria-hidden="true" size={20} />}
        </button>
        {!readyToStart && !pending ? (
          <p className="setup-form__hint">
            Still needed: {missingItems.join(", ")}.
          </p>
        ) : null}
      </fieldset>
    </form>
  );
}
