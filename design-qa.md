# Task 0.3 Design QA

## Comparison Target

- Source visual truth: `context/assets/ordah-please-option-1.png`
- Source resolution: 853 by 1844 pixels
- Member web/PWA screenshot: `design-qa-home-390x844.png` (captured before the accessibility follow-up)
- Admin web screenshot: `design-qa-admin-1440x900.png` (captured before the accessibility follow-up)
- Member web/PWA viewport and state: 390 by 844 CSS pixels, Home empty state, Home selected
- Admin viewport and state: 1440 by 900 CSS pixels, admin overview empty state

Task 0.3 intentionally implements only the shared shell visible in the reference: product identity, color and typography system, rounded informational surface, and persistent member navigation. Active-order behavior, restaurant cards, food images, avatars, and persistence belong to later tasks and are not represented by placeholders.

## Browser Evidence

- The production Next.js web/PWA build was opened in the Codex in-app browser.
- The member web/PWA Home shell was captured at 390 by 844.
- The Orders link was activated in the browser; navigation reached `/orders`, the Orders empty state appeared, and the Orders link exposed its active state.
- The admin overview was captured at 1440 by 900 with its separate persistent navigation.
- Member navigation targets measured 94 by 63 CSS pixels each, exceeding the 44-by-44 minimum.
- The member document had no horizontal overflow.
- Browser console warnings and errors: none.
- Native Android visual evidence: not captured. Native safe-area behavior, tab runtime styles, accessible names, empty-state copy, and dynamic text configuration are covered by automated tests only and still require emulator/device visual QA.
- Current-capture status: stale. The accessibility follow-up changed active navigation, brand/icon contrast pairings, and native safe-area behavior after these web captures were taken.

## Full-View Comparison Evidence

The approved reference and the pre-follow-up `design-qa-home-390x844.png` were opened together at the same mobile web/PWA aspect ratio. The scoped regions preserved the reference hierarchy: green `ordah please` identity on a white header, bright light canvas, pale-mint rounded information card, charcoal headings, restrained border/shadow treatment, outlined navigation icons, and a mint selected-navigation surface. The empty state deliberately occupies less content than the complete reference because restaurant and active-order features are not part of Task 0.3.

The desktop admin capture confirms that the same token language scales into a denser table-ready layout without copying the member bottom-navigation structure.

## Focused-Region Comparison Evidence

- Header: the wordmark uses the approved emerald and friendly rounded Nunito Sans treatment with comparable mobile proportion and whitespace.
- Empty-state card: pale mint, thin border, restrained shadow, centered icon, and clear heading/body hierarchy match the reference's support-surface language without inventing product data.
- Bottom navigation: the pre-follow-up web/PWA capture shows four evenly distributed destinations at 390 pixels with outlined Lucide icons and a mint active surface. The current accessible charcoal foreground requires recapture.
- Admin navigation: the pre-follow-up capture shows a persistent desktop sidebar. Its current accessible charcoal-on-mint active state requires recapture.

No additional raster region was compared because Task 0.3 contains no image-bearing feature component.

## Required Fidelity Surfaces

- Fonts and typography: browser-computed web/PWA body family is `Nunito Sans Variable`, with `Nunito Sans` and `sans-serif` fallbacks. Native font loading and dynamic-text configuration pass automated checks but were not visually captured on Android.
- Spacing and layout rhythm: the captured web/PWA shell follows the approved 4-point scale and had no horizontal overflow at 390 by 844. Native top/bottom safe-area handling is now connected to runtime styles and passing tests, but lacks emulator/device visual proof.
- Colors and visual tokens: the pre-follow-up browser capture computed canvas as `rgb(248, 251, 249)` (`#F8FBF9`) and text as `rgb(23, 32, 25)` (`#172019`). Current regression tests prove at least 4.5:1 for brand and active-navigation text pairings and at least 3:1 for shell icons; the resulting web appearance requires recapture.
- Image quality and asset fidelity: no raster asset belongs to the implemented shell. Excluded source photos and avatars were not replaced with placeholders, CSS art, emoji, or fabricated imagery.
- Copy and content: all empty-state and navigation copy is English, honest about missing data, and does not invent orders, restaurants, favorites, or members.

## Findings

- [P0] Current web/PWA implementation lacks post-fix browser evidence.
  - Location: member and admin navigation, brand, and empty-state icon pairings.
  - Evidence: the saved screenshots predate the accessibility contrast changes.
  - Impact: the report cannot prove that the current commit preserves visual hierarchy and browser behavior.
  - Fix: rebuild the follow-up commit, recapture `/` at 390 by 844 and `/admin` at 1440 by 900, retest navigation/focus/overflow/console, and compare the new captures with the source.
- Native Android remains outside the browser comparison claim and requires emulator/device visual QA before native fidelity is asserted.

## Comparison History

- Pass 1: blocked in the UI sub-agent because it had no attached browser surface; no visual acceptance claim was made.
- Pass 2: the root task opened the production build in the in-app browser, captured member and admin evidence, tested member navigation, measured touch targets and overflow, and checked console output. No scoped P0/P1/P2 issue was found.
- Pass 3: independent review found contrast and native safe-area defects. RED-first regression tests were added; the accessible semantic pairings, runtime-linked touch targets, single admin page heading, and native safe-area configuration now pass. Post-fix browser recapture is pending.

## Implementation Checklist

- [ ] Recapture the current member web/PWA Home shell at 390 by 844.
- [ ] Recapture the current desktop admin overview at 1440 by 900.
- [ ] Retest current member navigation, focus, active-state behavior, touch-target size, and horizontal overflow.
- [ ] Recheck browser console warnings and errors against the current build.
- [ ] Compare the approved reference and current implementation at the same mobile aspect ratio.
- [ ] Capture the native Android shell on an emulator/device before claiming native visual fidelity.

## Follow-up Polish

Feature-specific imagery, active-order density, restaurant cards, notification controls, and populated admin tables require their own visual QA when their owning tasks implement them.

final result: blocked
