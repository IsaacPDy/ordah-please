"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionLogWrite } from "@ordah-please/db";

export interface EditorPerson {
  userId: string;
  displayName: string;
  foodResponse: SessionLogWrite["participants"][number]["foodResponse"];
  lines: {
    originalLineId?: string;
    itemName: string;
    quantity: number;
    unitPriceCentavos: number;
    note: string;
    lineSubtotalCentavos: number;
  }[];
}
interface Props {
  orderId: string;
  initial: SessionLogWrite;
  members: readonly { userId: string; displayName: string }[];
  restaurants: readonly {
    restaurantId: string;
    restaurantName: string;
    branchName: string;
  }[];
}
const emptyAddress = {
  recipientName: "",
  phoneNumber: "",
  lineOne: "",
  lineTwo: null,
  city: "",
  postalCode: null,
  notes: null,
};
/** Owner editor for manual session metadata and captured food history. */
export function SessionLogEditor({
  orderId,
  initial,
  members,
  restaurants,
}: Props) {
  const router = useRouter();
  const [log, setLog] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  function setPerson(index: number, change: Partial<EditorPerson>) {
    setLog((current) => ({
      ...current,
      participants: current.participants.map((person, i) =>
        i === index ? { ...person, ...change } : person,
      ),
    }));
  }
  async function save() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/log`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(log),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setMessage(body?.error?.message ?? "Could not save the session.");
        return;
      }
      router.push(`/orders/${orderId}`);
      router.refresh();
    } catch {
      setMessage("Couldn't reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }
  async function remove() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/log`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const body = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        setMessage(body?.error?.message ?? "Could not delete the session.");
        return;
      }
      router.push("/orders?tab=past");
      router.refresh();
    } catch {
      setMessage("Couldn't reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }
  const address = log.deliveryAddress;
  return (
    <form
      className="setup-form session-log-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <fieldset disabled={pending}>
        <legend>Session details</legend>
        <label>
          Status
          <select
            value={log.state}
            onChange={(event) =>
              setLog({
                ...log,
                state: event.target.value as SessionLogWrite["state"],
              })
            }
          >
            <option value="draft">Logged</option>
            <option value="ordered">Finished</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label>
          Session date
          <input
            type="datetime-local"
            required
            value={localDate(log.createdAt)}
            onChange={(event) => {
              if (event.target.value)
                setLog({
                  ...log,
                  createdAt: new Date(
                    `${event.target.value}+08:00`,
                  ).toISOString(),
                });
            }}
          />
        </label>
        <label>
          Completion date (optional)
          <input
            type="datetime-local"
            value={log.completedAt ? localDate(log.completedAt) : ""}
            onChange={(event) =>
              setLog({
                ...log,
                completedAt: event.target.value
                  ? new Date(`${event.target.value}+08:00`).toISOString()
                  : null,
              })
            }
          />
        </label>
        <label>
          Session manager
          <select
            value={log.managerUserId}
            onChange={(event) =>
              setLog({ ...log, managerUserId: event.target.value })
            }
          >
            {log.participants.map((person) => (
              <option key={person.userId} value={person.userId}>
                {person.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Restaurant (optional)
          <select
            value={log.restaurantId ?? ""}
            onChange={(event) =>
              setLog({ ...log, restaurantId: event.target.value || null })
            }
          >
            <option value="">Restaurant pending</option>
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
        <p>You can finish this session without choosing a restaurant.</p>
        <label>
          <input
            type="checkbox"
            checked={address !== null}
            onChange={(event) =>
              setLog({
                ...log,
                deliveryAddress: event.target.checked
                  ? { ...emptyAddress }
                  : null,
              })
            }
          />{" "}
          Include delivery details
        </label>
        {address ? (
          <div className="setup-fields">
            {Object.keys(emptyAddress).map((key) => (
              <label key={key}>
                {addressLabels[key]}
                <input
                  value={typeof address[key] === "string" ? address[key] : ""}
                  required={[
                    "recipientName",
                    "phoneNumber",
                    "lineOne",
                    "city",
                  ].includes(key)}
                  onChange={(event) =>
                    setLog({
                      ...log,
                      deliveryAddress: {
                        ...address,
                        [key]: event.target.value || null,
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        ) : null}
      </fieldset>
      <fieldset disabled={pending}>
        <legend>Participants and food</legend>
        {log.participants.map((person, index) => (
          <section className="participant-card" key={person.userId}>
            <label>
              Participant name
              <input
                required
                value={person.displayName}
                onChange={(event) =>
                  setPerson(index, { displayName: event.target.value })
                }
              />
            </label>
            <label>
              Food status
              <select
                value={person.foodResponse}
                onChange={(event) =>
                  setPerson(index, {
                    foodResponse: event.target
                      .value as EditorPerson["foodResponse"],
                    lines:
                      event.target.value === "declined" ||
                      event.target.value === "pending"
                        ? []
                        : [...person.lines],
                  })
                }
              >
                <option value="pending">No food selected</option>
                <option value="confirmed">Confirmed</option>
                <option value="declined">Not eating</option>
                <option value="resolved">Picked by the manager</option>
              </select>
            </label>
            {person.lines.map((line, lineIndex) => (
              <div className="session-log-line" key={lineIndex}>
                <label>
                  Item name
                  <input
                    required
                    value={line.itemName}
                    onChange={(event) =>
                      setPerson(index, {
                        lines: person.lines.map((item, i) =>
                          i === lineIndex
                            ? { ...item, itemName: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Quantity
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={line.quantity}
                    onChange={(event) =>
                      setPerson(index, {
                        lines: person.lines.map((item, i) =>
                          i === lineIndex
                            ? { ...item, quantity: Number(event.target.value) }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Unit price (PHP)
                  <PriceInput
                    cents={line.unitPriceCentavos}
                    onChange={(cents) =>
                      setPerson(index, {
                        lines: person.lines.map((item, i) =>
                          i === lineIndex
                            ? {
                                ...item,
                                unitPriceCentavos: cents,
                              }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Notes
                  <input
                    value={line.note}
                    onChange={(event) =>
                      setPerson(index, {
                        lines: person.lines.map((item, i) =>
                          i === lineIndex
                            ? { ...item, note: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() =>
                    setPerson(index, {
                      lines: person.lines.filter((_, i) => i !== lineIndex),
                    })
                  }
                >
                  Remove item
                </button>
              </div>
            ))}
            <button
              type="button"
              className="secondary-action"
              onClick={() =>
                setPerson(index, {
                  foodResponse: "confirmed",
                  lines: [
                    ...person.lines,
                    {
                      itemName: "",
                      quantity: 1,
                      unitPriceCentavos: 0,
                      note: "",
                      lineSubtotalCentavos: 0,
                    },
                  ],
                })
              }
            >
              Add food item
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={person.userId === log.managerUserId}
              onClick={() =>
                setLog({
                  ...log,
                  participants: log.participants.filter((_, i) => i !== index),
                })
              }
            >
              Remove participant
            </button>
          </section>
        ))}
        <label>
          Add participant
          <select
            value={addUserId}
            onChange={(event) => setAddUserId(event.target.value)}
          >
            <option value="">Choose a group member</option>
            {members
              .filter(
                (member) =>
                  !log.participants.some(
                    (person) => person.userId === member.userId,
                  ),
              )
              .map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName}
                </option>
              ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!addUserId}
          className="secondary-action"
          onClick={() => {
            const member = members.find(
              (member) => member.userId === addUserId,
            );
            if (member)
              setLog({
                ...log,
                participants: [
                  ...log.participants,
                  { ...member, foodResponse: "pending", lines: [] },
                ],
              });
            setAddUserId("");
          }}
        >
          Add participant
        </button>
      </fieldset>
      {message ? <p role="alert">{message}</p> : null}
      <div className="wizard-footer">
        <button className="primary-action" disabled={pending} type="submit">
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          className="secondary-action"
          disabled={pending}
          type="button"
          onClick={() => setDeleteOpen(true)}
        >
          Delete session
        </button>
      </div>
      {deleteOpen ? (
        <div
          role="alertdialog"
          aria-labelledby="delete-session-title"
          className="participant-card"
        >
          <h2 id="delete-session-title">Permanently delete this session?</h2>
          <p>
            Its participants and all saved food details will be removed from
            everyone's History. This cannot be undone.
          </p>
          <button
            type="button"
            disabled={pending}
            className="secondary-action"
            onClick={() => setDeleteOpen(false)}
          >
            Keep session
          </button>
          <button
            type="button"
            disabled={pending}
            className="admin-danger-button"
            onClick={() => void remove()}
          >
            Delete permanently
          </button>
        </div>
      ) : null}
    </form>
  );
}
function localDate(iso: string) {
  return new Date(new Date(iso).getTime() + 8 * 60 * 60_000)
    .toISOString()
    .slice(0, 16);
}
function PriceInput({
  cents,
  onChange,
}: {
  cents: number;
  onChange: (cents: number) => void;
}) {
  const [value, setValue] = useState((cents / 100).toFixed(2));
  useEffect(() => {
    setValue((current) =>
      Math.round(Number(current) * 100) === cents
        ? current
        : (cents / 100).toFixed(2),
    );
  }, [cents]);
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      required
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        onChange(Math.round(Number(event.target.value) * 100));
      }}
    />
  );
}
const addressLabels: Record<string, string> = {
  recipientName: "Recipient name",
  phoneNumber: "Phone number",
  lineOne: "Address",
  lineTwo: "Address line 2",
  city: "City",
  postalCode: "Postal code",
  notes: "Delivery notes",
};
