# UI Context

## Approved Direction

Option 1 is the approved V1 visual direction. Its corrected reference is `context/assets/ordah-please-option-1.png`. It uses an original `ordah please` identity with a bright light canvas, emerald actions, pale mint support surfaces, rounded cards, restrained shadows, clear food photography, and a friendly high-legibility type system. Grab is a usability reference only; its logo, exact layout, branded art, and promotional treatments must not be copied.

## Structural UI Rules

- Web and Android invitation screens preserve the invitation through Better Auth Google sign-in and do not expose email/password or public registration.
- Invitation screens show sign-in before Join group, state that joining does not add the person to an order, disable duplicate submission, and provide one safe retryable error without exposing provider details.
- The Team screen spells roles as Owner, Organizer, and Member. Only owners see member-management data and actions; removing a member requires explicit confirmation, and platform-admin access can be requested but not approved there.
- Android is touch-first and native-feeling.
- The iPhone PWA provides equivalent ordering behavior and clear Home Screen installation guidance.
- The desktop admin portal prioritizes dense menu comparison, validation errors, and audit information.
- Limited mobile admin supports approvals, refresh-failure review, and pausing restaurants only.
- Every active-order view shows stage, deadline, participant status, and the no-response consequence.
- Every price display identifies itself as a food subtotal and excludes Grab fees, discounts, and promotions.
- Loading, empty, stale, unavailable, validation-error, and retry states are designed states, not afterthoughts.

## Accessibility Requirements

- All interactive controls have accessible names and visible focus states.
- Do not rely on color alone for status or error meaning.
- Support dynamic text sizing without clipping core actions.
- Touch targets are at least 44 by 44 logical pixels.
- Dialogs trap focus on web and restore focus on close.
- Use plain language for deadlines, automatic inclusion, and destructive actions.
- Use English for all application-authored copy and mock content.
- Preserve externally imported proper names verbatim so restaurant and menu identification stays accurate.

## V1 Visual Tokens and Libraries

- Light theme only for V1.
- Use the semantic colors, spacing, radii, and elevation rules in `design-structure.md`.
- Use Nunito Sans with tabular numerals for operational values.
- Use Lucide icons.
- Use React Native Paper as adapted Android primitives and shadcn/ui as adapted web/admin primitives.
- Treat the approved Option 1 active-order home screen as the representative member layout.
- Extend the same tokens to the iPhone PWA and use denser table/detail compositions in the desktop admin without changing the brand language.
