"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  House,
  ListChecks,
  LockKeyhole,
  MapPin,
  Search,
  Store,
  Users,
  ChartNoAxesColumn,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface WizardMember {
  readonly displayName: string;
  readonly role: "owner" | "manager" | "member";
  readonly userId: string;
  readonly imageUrl?: string | null;
}

interface WizardRestaurant {
  readonly restaurantId: string;
  readonly restaurantName: string;
  readonly heroImageUrl?: string | null;
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

/** Three-screen setup with the final review embedded beside restaurant settings. */
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
  const [step, setStep] = useState(1);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);
  const [search, setSearch] = useState("");
  const [addressMode, setAddressMode] = useState(
    groupAddress ? "saved" : "new",
  );
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

  const deliveryComplete = [recipientName, phoneNumber, lineOne, city].every(
    (value) => value.trim().length > 0,
  );

  async function startOrder(): Promise<void> {
    if (step !== 3 || pending || !readyToStart) return;
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
      className="setup-form setup-wizard"
      onSubmit={(event) => {
        event.preventDefault();
        void startOrder();
      }}
    >
      <ol aria-label="Order setup progress" className="wizard-progress">
        {["Group", "Delivery", "Restaurant", "Review"].map((label, index) => (
          <li
            key={label}
            aria-current={index + 1 === step ? "step" : undefined}
            className={index + 1 < step ? "is-complete" : ""}
          >
            <span>
              {index + 1 < step ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                index + 1
              )}
            </span>
            <small>{label}</small>
          </li>
        ))}
      </ol>
      <header className="wizard-intro">
        <p>Step {step} of 4</p>
        <h1 ref={headingRef} tabIndex={-1}>
          {step === 1
            ? "Who’s joining?"
            : step === 2
              ? "Where should it go?"
              : "Restaurant & voting"}
        </h1>
        <p>
          {step === 1
            ? "Select the people in this group. You’ll be the order manager automatically."
            : step === 2
              ? "Choose a saved place or enter delivery details for your group order."
              : "Set a fallback restaurant and how the group will choose."}
        </p>
      </header>
      {step === 1 ? (
        <section className="wizard-members">
          <div className="wizard-group">
            <span className="group-card__icon" aria-hidden="true">
              {groupName.charAt(0)}
            </span>
            <div>
              <strong>{groupName}</strong>
              <small>{members.length} people</small>
            </div>
            <Link href="/orders/new" className="soft-action">
              Change
            </Link>
          </div>
          <label className="member-search">
            <Search size={20} aria-hidden="true" />
            <input
              aria-label="Search members"
              type="search"
              placeholder="Search members…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <h2 className="list-caption">Group members</h2>
          <ul className="participant-grid">
            <li>
              <label className="participant-option participant-option--selected participant-option--manager">
                <span className="member-avatar" aria-hidden="true">
                  {manager?.displayName.charAt(0) ?? "Y"}
                </span>
                <span>
                  <strong>
                    {manager?.displayName ?? "You"} <em>You</em>
                  </strong>
                  <small>Order manager (required)</small>
                </span>
                <input checked disabled readOnly type="checkbox" />
                <LockKeyhole aria-hidden="true" size={18} />
              </label>
            </li>
            {selectableMembers
              .filter((member) =>
                member.displayName.toLowerCase().includes(search.toLowerCase()),
              )
              .map((member) => (
                <li key={member.userId}>
                  <label
                    className={`participant-option${participants.has(member.userId) ? " participant-option--selected" : ""}`}
                  >
                    <span className="member-avatar" aria-hidden="true">
                      {member.displayName.charAt(0)}
                    </span>
                    <span>
                      <strong>{member.displayName}</strong>
                      <small>
                        {member.role === "owner"
                          ? "Group Owner"
                          : member.role === "manager"
                            ? "Manager"
                            : "Member"}
                      </small>
                    </span>
                    <input
                      checked={participants.has(member.userId)}
                      onChange={() =>
                        setParticipants((current) =>
                          toggle(current, member.userId),
                        )
                      }
                      type="checkbox"
                    />
                  </label>
                </li>
              ))}
          </ul>
          {selectableMembers.length > 0 &&
          !selectableMembers.some((member) =>
            member.displayName.toLowerCase().includes(search.toLowerCase()),
          ) ? (
            <p role="status">No members match your search.</p>
          ) : null}
        </section>
      ) : null}
      {step === 2 ? (
        <fieldset className="setup-form__section wizard-delivery">
          <legend className="sr-only">Delivery details</legend>
          <div className="wizard-delivery-choice">
            <h2 className="desktop-heading">Choose a delivery address</h2>
            <div className="address-tabs">
              <button
                className={addressMode === "saved" ? "is-selected" : ""}
                disabled={!groupAddress}
                onClick={() => {
                  setAddressMode("saved");
                  if (groupAddress) {
                    setRecipientName(groupAddress.recipientName);
                    setPhoneNumber(groupAddress.phoneNumber);
                    setLineOne(groupAddress.lineOne);
                    setLineTwo(groupAddress.lineTwo ?? "");
                    setCity(groupAddress.city);
                    setPostalCode(groupAddress.postalCode ?? "");
                    setNotes(groupAddress.notes ?? "");
                  }
                }}
                type="button"
              >
                <House size={20} aria-hidden="true" />
                Saved addresses
              </button>
              <button
                className={addressMode === "new" ? "is-selected" : ""}
                onClick={() => setAddressMode("new")}
                type="button"
              >
                <MapPin size={20} aria-hidden="true" />
                Enter new address
              </button>
            </div>
            {addressMode === "saved" && groupAddress ? (
              <div className="saved-address">
                <span className="wizard-icon">
                  <House size={24} aria-hidden="true" />
                </span>
                <div>
                  <strong>{groupAddress.recipientName}</strong>
                  <small>
                    {groupAddress.lineOne}, {groupAddress.city}
                    {groupAddress.postalCode
                      ? `, ${groupAddress.postalCode}`
                      : ""}
                  </small>
                </div>
                <Check size={22} aria-hidden="true" />
              </div>
            ) : null}
          </div>
          <div className="wizard-delivery-fields">
            <h2 className="desktop-heading">Delivery details</h2>
            <p className="divider-caption">
              {addressMode === "saved" ? "or edit details" : "Delivery details"}
            </p>
            <label>
              Recipient name
              <input
                onChange={(event) => setRecipientName(event.target.value)}
                autoComplete="name"
                required
                value={recipientName}
              />
            </label>
            <label>
              Phone number
              <input
                onChange={(event) => setPhoneNumber(event.target.value)}
                autoComplete="tel"
                type="tel"
                required
                value={phoneNumber}
              />
            </label>
            <label>
              Address line 1
              <input
                onChange={(event) => setLineOne(event.target.value)}
                autoComplete="address-line1"
                required
                value={lineOne}
              />
            </label>
            <label>
              Address line 2
              <input
                onChange={(event) => setLineTwo(event.target.value)}
                autoComplete="address-line2"
                value={lineTwo}
              />
            </label>
            <label>
              City
              <input
                onChange={(event) => setCity(event.target.value)}
                autoComplete="address-level2"
                required
                value={city}
              />
            </label>
            <label>
              Postal code
              <input
                onChange={(event) => setPostalCode(event.target.value)}
                autoComplete="postal-code"
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
            <label className="checkbox-label">
              <input
                checked={saveAsGroupDefault}
                onChange={(event) =>
                  setSaveAsGroupDefault(event.target.checked)
                }
                type="checkbox"
              />
              Save as this group’s default address
            </label>
          </div>
        </fieldset>
      ) : null}
      {step === 3 ? (
        <div className="wizard-settings">
          <fieldset className="setup-form__section wizard-setting-card">
            <legend className="sr-only">Fallback restaurant</legend>
            <div className="wizard-card-heading">
              <span className="wizard-icon">
                <Store size={22} aria-hidden="true" />
              </span>
              <div>
                <h2>Fallback restaurant</h2>
                <p>
                  Used when no restaurant reaches half the votes or there’s a
                  tie.
                </p>
              </div>
            </div>
            <label>
              <span className="sr-only">Restaurant</span>
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
          </fieldset>
          <fieldset className="setup-form__section wizard-setting-card">
            <legend className="sr-only">Restaurant selection</legend>
            <div className="wizard-card-heading">
              <span className="wizard-icon">
                <ChartNoAxesColumn size={22} aria-hidden="true" />
              </span>
              <div>
                <h2>How do we choose?</h2>
                <p>Let the group vote or decide now.</p>
              </div>
            </div>
            <label>
              <span className="sr-only">How the restaurant is chosen</span>
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
                  onChange={(event) =>
                    setRestaurantDeadline(event.target.value)
                  }
                  required
                  type="datetime-local"
                  value={restaurantDeadline}
                />
              </label>
            ) : null}
            {votingMode === "shortlist" ? (
              <div>
                <p className="setup-form__hint">
                  Pick at least two. The fallback is always included.
                </p>
                <ul className="shortlist-options">
                  {restaurants.map((restaurant) => (
                    <li key={restaurant.restaurantId}>
                      <label className="checkbox-label">
                        <input
                          checked={
                            restaurant.restaurantId === fallbackRestaurantId ||
                            shortlistIds.has(restaurant.restaurantId)
                          }
                          disabled={
                            restaurant.restaurantId === fallbackRestaurantId
                          }
                          onChange={() =>
                            toggleShortlist(restaurant.restaurantId)
                          }
                          type="checkbox"
                        />
                        {restaurant.restaurantName} — {restaurant.branchName}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </fieldset>
          <fieldset className="setup-form__section wizard-setting-card">
            <legend className="sr-only">Food deadline</legend>
            <div className="wizard-card-heading">
              <span className="wizard-icon">
                <CalendarDays size={22} aria-hidden="true" />
              </span>
              <div>
                <h2>Food picks end</h2>
                <p>Set a deadline for everyone to place their orders.</p>
              </div>
            </div>
            <label>
              <span className="sr-only">Food picks end</span>
              <input
                onChange={(event) => setFoodDeadline(event.target.value)}
                required
                type="datetime-local"
                value={foodDeadline}
              />
            </label>
          </fieldset>
          <section
            className="wizard-review"
            aria-labelledby="wizard-review-heading"
          >
            <div className="wizard-card-heading">
              <span className="wizard-icon">
                <ListChecks size={22} aria-hidden="true" />
              </span>
              <div>
                <h2 id="wizard-review-heading">Review</h2>
                <p>Here’s what will happen.</p>
              </div>
              <button
                type="button"
                className="soft-action"
                onClick={() => setStep(1)}
              >
                Edit
              </button>
            </div>
            <dl>
              <div>
                <dt>
                  <Users size={15} aria-hidden="true" />
                  Group
                </dt>
                <dd>
                  {groupName} ({participants.size + 1} members)
                </dd>
              </div>
              <div>
                <dt>
                  <MapPin size={15} aria-hidden="true" />
                  Delivery to
                </dt>
                <dd>
                  {lineOne}, {city}
                </dd>
              </div>
              <div>
                <dt>
                  <Store size={15} aria-hidden="true" />
                  Fallback restaurant
                </dt>
                <dd>
                  {fallbackRestaurant
                    ? `${fallbackRestaurant.restaurantName} — ${fallbackRestaurant.branchName}`
                    : "Not selected"}
                </dd>
              </div>
              <div>
                <dt>
                  <ChartNoAxesColumn size={15} aria-hidden="true" />
                  Selection method
                </dt>
                <dd>
                  {votingMode === "voting_disabled"
                    ? "Voting off"
                    : votingMode === "shortlist"
                      ? "Shortlist"
                      : "Whole catalog"}
                </dd>
              </div>
              <div>
                <dt>
                  <CalendarDays size={15} aria-hidden="true" />
                  Food picks end
                </dt>
                <dd>
                  {foodDeadline
                    ? new Date(foodDeadline).toLocaleString("en-US")
                    : "Not set"}
                </dd>
              </div>
            </dl>
          </section>
          {!readyToStart && !pending ? (
            <p className="setup-form__hint">
              Still needed: {missingItems.join(", ")}.
            </p>
          ) : null}
          {message !== null ? (
            <p aria-live="polite" role="status">
              {message}
            </p>
          ) : null}
        </div>
      ) : null}
      <footer className="wizard-footer">
        {step === 1 ? (
          <div>
            <strong>
              {participants.size + 1}{" "}
              {participants.size === 0 ? "member" : "members"} selected
            </strong>
            <small>Including you</small>
          </div>
        ) : (
          <button
            className="secondary-action"
            disabled={pending}
            type="button"
            onClick={() => setStep(step - 1)}
          >
            <ArrowLeft size={20} aria-hidden="true" />
            Back
          </button>
        )}
        {step < 3 ? (
          <button
            className="primary-action"
            type="button"
            disabled={step === 2 && !deliveryComplete}
            onClick={() => setStep(step + 1)}
          >
            Next
            <ArrowRight size={20} aria-hidden="true" />
          </button>
        ) : (
          <button
            className="primary-action"
            disabled={pending || !readyToStart}
            type="submit"
          >
            {pending ? "Starting…" : "Start order"}
            {pending ? null : <ArrowRight size={20} aria-hidden="true" />}
          </button>
        )}
      </footer>
    </form>
  );
}
