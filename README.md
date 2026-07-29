# ordah please

`ordah please` is a private food-order planning app for a small group of invited friends. It helps the group decide where to order, remember what each person likes, collect everyone's final food choices, and prepare one organized summary for the person placing the order in Grab.

Invited users sign in with Google through self-hosted Better Auth. Authentication records stay separate from the product users, roles, memberships, and permanent order history stored in Neon.

## What it does

- Keeps a reviewed catalog of restaurants, branches, menus, prices, and item availability.
- Lets each person save up to three ranked food combinations for every restaurant.
- Lets an organizer choose who is included in an order, select a fallback restaurant, and set response deadlines.
- Supports optional restaurant voting using either a shortlist or the full catalog.
- Automatically uses a person's first-ranked valid combination when they do not respond before the food deadline.
- Lets people change their food, choose something new, or decline the order.
- Shows organizers which selections are missing or unavailable so they can resolve them before checkout.
- Combines everyone's selections into item totals while keeping a clear per-person breakdown.
- Calculates the food subtotal and creates copyable order details for the organizer.
- Opens the selected restaurant branch in Grab so the organizer can place the order manually.
- Records whether the order was placed or cancelled, with an optional receipt screenshot.
- Preserves completed orders in permanent history.
- Notifies participants about active orders, deadlines, and required actions.
- Gives administrators a review process for importing menus, checking weekly menu updates, and keeping old approved data available when an update fails.

## How an order works

1. Invited friends sign in and join the private group.
2. Members browse restaurants and save their preferred food combinations.
3. An organizer starts an order, selects the participants, chooses the restaurant-selection method, and sets the deadlines.
4. Participants vote for a restaurant when voting is enabled. If no alternative wins or the result is tied, the organizer's initial restaurant remains selected.
5. Participants confirm, change, or decline their food. A valid first-ranked combination is included automatically when someone does not respond.
6. The organizer resolves any missing selections and reviews the combined order summary.
7. The organizer copies the prepared details, opens Grab, and places and pays for the order manually.
8. The organizer records the final result, and `ordah please` keeps the order in history.

## What it does not do

`ordah please` does not automatically add items to a Grab cart, place an order, make a payment, collect repayment, or track delivery. It prepares and coordinates the group order; the organizer remains responsible for completing the purchase in Grab.
