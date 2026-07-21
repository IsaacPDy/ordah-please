# Task 0.3 Design QA

## Comparison Target

- Source visual truth: `context/assets/ordah-please-option-1.png`
- Source resolution: 853 by 1844 pixels
- Member implementation screenshot: `design-qa-home-390x844.png`
- Admin implementation screenshot: `design-qa-admin-1440x900.png`
- Member viewport and state: 390 by 844 CSS pixels, Home empty state, Home selected
- Admin viewport and state: 1440 by 900 CSS pixels, admin overview empty state

Task 0.3 intentionally implements only the shared shell visible in the reference: product identity, color and typography system, rounded informational surface, and persistent member navigation. Active-order behavior, restaurant cards, food images, avatars, and persistence belong to later tasks and are not represented by placeholders.

## Browser Evidence

- The production Next.js build was opened in the Codex in-app browser.
- The member Home shell was captured at 390 by 844.
- The Orders link was activated in the browser; navigation reached `/orders`, the Orders empty state appeared, and the Orders link exposed its active state.
- The admin overview was captured at 1440 by 900 with its separate persistent navigation.
- Member navigation targets measured 94 by 63 CSS pixels each, exceeding the 44-by-44 minimum.
- The member document had no horizontal overflow.
- Browser console warnings and errors: none.

## Full-View Comparison Evidence

The approved reference and `design-qa-home-390x844.png` were opened together at the same mobile aspect ratio. The scoped regions preserve the reference hierarchy: green `ordah please` identity on a white header, bright light canvas, pale-mint rounded information card, charcoal headings, restrained border/shadow treatment, outlined navigation icons, and green selected navigation state. The empty state deliberately occupies less content than the complete reference because restaurant and active-order features are not part of Task 0.3.

The desktop admin capture confirms that the same token language scales into a denser table-ready layout without copying the member bottom-navigation structure.

## Focused-Region Comparison Evidence

- Header: the wordmark uses the approved emerald and friendly rounded Nunito Sans treatment with comparable mobile proportion and whitespace.
- Empty-state card: pale mint, thin border, restrained shadow, centered icon, and clear heading/body hierarchy match the reference's support-surface language without inventing product data.
- Bottom navigation: four evenly distributed destinations remain visible at 390 pixels, use outlined Lucide icons, and give the active Home destination a mint surface plus green foreground.
- Admin navigation: the active Overview item uses the same mint/green semantics while maintaining a persistent desktop sidebar.

No additional raster region was compared because Task 0.3 contains no image-bearing feature component.

## Required Fidelity Surfaces

- Fonts and typography: browser-computed body family is `Nunito Sans Variable`, with `Nunito Sans` and `sans-serif` fallbacks. The mobile headings and supporting copy remain readable without clipping.
- Spacing and layout rhythm: the shell follows the approved 4-point scale, maintains safe header/card/navigation spacing, keeps the bottom navigation visible, and has no horizontal overflow at 390 by 844.
- Colors and visual tokens: browser-computed canvas is `rgb(248, 251, 249)` (`#F8FBF9`) and text is `rgb(23, 32, 25)` (`#172019`); emerald, mint, surface, border, warning, and error tokens are also covered by passing token tests.
- Image quality and asset fidelity: no raster asset belongs to the implemented shell. Excluded source photos and avatars were not replaced with placeholders, CSS art, emoji, or fabricated imagery.
- Copy and content: all empty-state and navigation copy is English, honest about missing data, and does not invent orders, restaurants, favorites, or members.

## Findings

No actionable P0, P1, or P2 mismatch remains within Task 0.3 scope.

## Comparison History

- Pass 1: blocked in the UI sub-agent because it had no attached browser surface; no visual acceptance claim was made.
- Pass 2: the root task opened the production build in the in-app browser, captured member and admin evidence, tested member navigation, measured touch targets and overflow, and checked console output. No scoped P0/P1/P2 issue was found.

## Implementation Checklist

- [x] Capture the member Home shell at 390 by 844.
- [x] Capture the desktop admin overview at 1440 by 900.
- [x] Test member navigation and active-state behavior.
- [x] Verify touch-target size and horizontal overflow.
- [x] Check browser console warnings and errors.
- [x] Compare the approved reference and implementation at the same mobile aspect ratio.

## Follow-up Polish

Feature-specific imagery, active-order density, restaurant cards, notification controls, and populated admin tables require their own visual QA when their owning tasks implement them.

final result: passed
