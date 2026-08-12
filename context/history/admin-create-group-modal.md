# Admin Create group modal

## What changed

- Renders the Create group form through a body portal so the overlay is centered in the viewport instead of anchored beside its trigger.
- Keeps dirty form values when the backdrop is clicked and gives the card a short wobble.
- Opens an explicit discard confirmation when the X is used on a dirty form.
- Traps keyboard focus inside the modal, gives Escape the same safe clean/dirty behavior, focuses the confirmation action, and restores focus to the Create group trigger after closing.

## Completion evidence

- Focused Vitest passed 11 interaction tests covering portal placement, clean and dirty closing, confirmation, value retention/reset, Escape, focus restoration, Tab wrapping, and ignoring Escape during an in-flight create request.
- Web typecheck, web lint, and `git diff --check` passed after the keyboard repair.
- Authenticated browser verification on `/admin/groups` measured zero horizontal and vertical center offset at 1280x800 and 390x844. The narrow card fit fully inside the viewport with 16px side spacing.
- Browser verification found meaningful page content, no Next.js error overlay, and no captured console errors.
