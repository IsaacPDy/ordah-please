# Task 0.3 Design QA

## Comparison Target

- Source visual truth: `context/assets/ordah-please-option-1.png`
- Source resolution: 853 by 1844 pixels
- Member web/PWA screenshot: `design-qa-home-390x844.png`
- Admin web screenshot: `design-qa-admin-1440x900.png`
- Member web/PWA viewport and state: 390 by 844 CSS pixels, Home empty state, Home selected
- Admin viewport and state: 1440 by 900 CSS pixels, admin overview empty state

Task 0.3 intentionally implements only the shared shell visible in the reference: product identity, color and typography system, rounded informational surface, and persistent member navigation. Active-order behavior, restaurant cards, food images, avatars, and persistence belong to later tasks and are not represented by placeholders.

## Browser Evidence

- The production Next.js web/PWA build at UI head `770a688` was opened in the Codex in-app browser.
- The current member Home shell was captured at 390 by 844 after the accessibility follow-up.
- The Orders link was activated in the browser. Navigation reached `/orders`, `aria-current="page"` moved to Orders, and the current Orders target measured 93.5 by 63 CSS pixels.
- Keyboard focus on Orders rendered a 3-pixel solid `rgb(7, 136, 71)` outline with a 3-pixel offset.
- The member document had no horizontal overflow at 390 CSS pixels.
- The current admin overview was captured at 1440 by 900. It had one `h1`, no horizontal overflow, and six 215-by-44 CSS-pixel navigation targets.
- Browser console warnings and errors: none on the tested member and admin routes.
- Browser-computed body styles used `Nunito Sans Variable`, canvas `rgb(248, 251, 249)`, and text `rgb(23, 32, 25)`.
- Native Android visual evidence was not captured. This report therefore makes no native pixel-fidelity claim. Native safe-area behavior, tab runtime styles, accessible names, empty-state copy, dynamic text configuration, and Android bundling are covered by automated checks; emulator/device visual QA remains a release-gate item.

## Full-View Comparison Evidence

The approved reference and current `design-qa-home-390x844.png` were compared at a matching mobile aspect ratio. The scoped regions preserve the reference hierarchy: green `ordah please` identity on a white header, bright light canvas, pale-mint rounded information card, charcoal headings, restrained border/shadow treatment, outlined navigation icons, and a mint selected-navigation surface. The empty state deliberately contains less content than the complete reference because restaurant and active-order features are not part of Task 0.3.

The current desktop admin capture confirms that the same token language scales into a denser table-ready layout without copying the member bottom-navigation structure.

## Focused-Region Comparison Evidence

- Header: the wordmark uses the approved emerald and friendly rounded Nunito Sans treatment with comparable mobile proportion and whitespace.
- Empty-state card: pale mint, thin border, restrained shadow, centered icon, and clear heading/body hierarchy match the reference's support-surface language without inventing product data.
- Bottom navigation: four evenly distributed destinations fit at 390 pixels with outlined Lucide icons, a mint active surface, 44-pixel-or-larger targets, and a visible keyboard focus ring.
- Admin navigation: the persistent desktop sidebar uses the same active treatment while retaining a separate admin information architecture. The page contains one page-level heading.

No additional raster region was compared because Task 0.3 contains no image-bearing feature component.

## Required Fidelity Surfaces

- Fonts and typography: browser-computed web/PWA body family is `Nunito Sans Variable`, with `Nunito Sans` and `sans-serif` fallbacks. Native font loading and dynamic-text configuration pass automated checks but were not visually captured on Android.
- Spacing and layout rhythm: the current web/PWA shell follows the approved 4-point scale and has no horizontal overflow at 390 by 844. Native top/bottom safe-area handling is connected to runtime styles and passing tests, but lacks emulator/device visual proof.
- Colors and visual tokens: the current browser capture computed canvas as `#F8FBF9`, text as `#172019`, and active navigation as charcoal on `#EFFAF3`. Regression tests prove at least 4.5:1 for brand and active-navigation text pairings and at least 3:1 for shell icons.
- Image quality and asset fidelity: no raster asset belongs to the implemented shell. Excluded source photos and avatars were not replaced with placeholders, CSS art, emoji, or fabricated imagery.
- Copy and content: all empty-state and navigation copy is English, honest about missing data, and does not invent orders, restaurants, favorites, or members.

## Findings

- No scoped P0, P1, or P2 web/PWA fidelity issue remains after the post-fix recapture.
- Native Android visual fidelity is explicitly deferred. It must be checked on an emulator/device at normal and enlarged system text before the release gate can claim native visual parity.

## Comparison History

- Pass 1: blocked in the UI sub-agent because it had no attached browser surface; no visual acceptance claim was made.
- Pass 2: the root task opened the production build in the in-app browser, captured member and admin evidence, tested member navigation, measured touch targets and overflow, and checked console output.
- Pass 3: independent review found contrast and native safe-area defects. RED-first regression tests were added; accessible semantic pairings, runtime-linked touch targets, a single admin page heading, and native safe-area configuration passed.
- Pass 4: the root task recaptured the post-fix member and admin shells, rechecked current navigation, active state, keyboard focus, target dimensions, overflow, heading structure, computed tokens, and browser logs. No scoped P0/P1/P2 web/PWA issue remained.

## Implementation Checklist

- [x] Recapture the current member web/PWA Home shell at 390 by 844.
- [x] Recapture the current desktop admin overview at 1440 by 900.
- [x] Retest current member navigation, focus, active-state behavior, touch-target size, and horizontal overflow.
- [x] Recheck browser console warnings and errors against the current build.
- [x] Compare the approved reference and current implementation at the same mobile aspect ratio.
- [ ] Capture the native Android shell on an emulator/device before claiming native visual fidelity.

## Follow-up Polish

Feature-specific imagery, active-order density, restaurant cards, notification controls, and populated admin tables require their own visual QA when their owning tasks implement them.

final result: passed for the Task 0.3 web/PWA shell; native visual fidelity is deferred and remains gated for release
