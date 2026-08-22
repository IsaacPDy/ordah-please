# Member PWA Reference Redesign — Design QA

## Comparison target

- Source visual truth:
  - `/var/folders/d0/skyhm8fs12z29dlf5dj20bt00000gn/T/codex-clipboard-c483ffad-3825-4403-8c24-e0345085cef0.png` — Home
  - `/var/folders/d0/skyhm8fs12z29dlf5dj20bt00000gn/T/codex-clipboard-9be449eb-f8cf-425c-b51f-a1cc616edda5.png` — New order
  - `/var/folders/d0/skyhm8fs12z29dlf5dj20bt00000gn/T/codex-clipboard-bfb2b020-6195-44eb-abc6-d3cd4da4f028.png` — Orders
  - `/var/folders/d0/skyhm8fs12z29dlf5dj20bt00000gn/T/codex-clipboard-8e9d57fe-fde5-4068-ae52-f84bf423d151.png` — Favorites
  - `/var/folders/d0/skyhm8fs12z29dlf5dj20bt00000gn/T/codex-clipboard-0c141792-f404-4124-b956-1a003cf41bca.png` — Groups
  - `/var/folders/d0/skyhm8fs12z29dlf5dj20bt00000gn/T/codex-clipboard-67250c7d-1f7a-4935-8d26-290a9dcdc3cd.png` — Group details
- Implementation captures: `context/evidence/member-pwa-reference-redesign/{home,orders,favorites,groups,new-order,group-detail}.png`
- Combined comparison evidence: `context/evidence/member-pwa-reference-redesign/*-comparison.png`
- Browser viewport: 403 × 706 CSS px, device scale factor 1.
- Source pixels: 788–806 × 1,396–1,418; source images were normalized to the implementation capture dimensions before compositing.
- Implementation pixels: 388px wide on scrollable routes because the in-app browser capture excludes its 15px scrollbar; the final Group details evidence is a full-page 388 × 895 capture. Groups remains a 403 × 706 non-scrollable state.
- State: authenticated as the existing local Isaac account with real group, order, address, restaurant, image, and role data.

## Full-view comparison evidence

- Home: hierarchy, muted palette, greeting, active-order card, progress, category pills, restaurant photography, floating action, and bottom navigation match the source language.
- Orders: intro, three pills, Active/History separation, count badge, status-first card, chevron, and persistent actions match.
- Favorites: intro, icon-based empty state, centered guidance, browse action, floating action, and selected tab match.
- Groups: intro, initial avatars, large bordered cards, role context, chevrons, floating action, and selected tab match.
- New order: back/header shell, intro, progress rail, two-column participant cards, selected check state, section hierarchy, and persistent navigation match. Real editable address fields remain visible because the existing workflow requires them.
- Group details: centered group identity, member roster cards, role labels, primary/secondary actions, and selected tab match. The redundant floating action is intentionally omitted so it cannot cover Copy invite link.

## Focused region comparison evidence

- New-order participant grid measured 340px wide with two 166px tracks inside the mobile content region. Document scroll width is 388px, proving the earlier horizontal overflow is gone.
- Participant selection was exercised in the browser; the selected member card changed to `participant-option--selected` while the required manager checkbox stayed disabled.
- Group details opened for the real owner group. The exact-group Start an order link, Copy invite link action, roster roles, and existing rotate-link fallback remained present.

## Required fidelity surfaces

- Fonts and typography: Nunito Sans remains the app font. Display headings use the reference-like 32px, 700-weight, tight tracking; labels and secondary copy use restrained sizes and line heights.
- Spacing and layout rhythm: 24px mobile side margins, 22–24px cards, compact 8–12px internal gaps, fixed four-tab bar, and route-aware persistent action reproduce the source rhythm.
- Colors and tokens: muted forest `#55945B`, strong green `#477C4D`, pale green `#F0FAF2`, white surfaces, `#182019` text, and `#DCE5DE` borders match the visible reference family.
- Image quality and asset fidelity: the implementation keeps the real imported restaurant images and profile image; no placeholder or generated replacement was introduced. Lucide remains the icon library.
- Copy and content: page framing follows the source, while imported names, real group names, exact roles, live counts, and full editable workflow content remain authoritative.

## Comparison history

1. Initial browser pass: shared content began 20–30px too low and Home's deadline wrapped, making the active card too tall. Fixed the header/content geometry and added a compact Manila-time Home formatter.
2. Second pass: Home repeated the response count visibly and lacked category pills; Favorites illustration was oversized. Hid the duplicate line accessibly, added real cuisine-derived pills, and reduced the illustration surface.
3. Wizard pass: the browser-native fieldset minimum width expanded the participant grid to 509px and clipped the second card. Added shrink-safe fieldset/grid constraints; final tracks are 166px + 166px with no document overflow.
4. Review pass: replaced decorative Orders filters with truthful non-interactive pills, strengthened green action contrast to 4.5:1 or better, restored full bottom safe-area spacing, and styled the existing invite-link rotation fallback consistently.
5. Interaction pass: removed the redundant floating New Order action from Group details, where it covered part of the full-width Copy invite link control. The existing Start an order action preserves the same capability without intersecting another touch target.
6. Final pass: no actionable P0/P1/P2 visual differences remain. Remaining differences are intentional live-product constraints: real images/content and editable address fields rather than screenshot sample data.

## Interaction and runtime checks

- Navigated Home, Orders, Favorites, Groups, New order, and Group details in the in-app browser.
- Opened the exact owner group and exact-group New order state.
- Exercised participant selection without submitting or mutating an order.
- Checked browser console errors on every captured route: none.

## Findings

- No actionable P0, P1, or P2 findings remain.
- P3: the in-app browser scrollbar is visible in scrollable evidence captures; it is browser chrome, not application UI.
- P3: live content can wrap differently from the sample names in the references. Cards remain responsive and no horizontal overflow remains.

## Open questions

- None.

## Implementation checklist

- [x] Shared reference palette and shell
- [x] Home, Orders, Favorites, Groups, Group details, and New order hierarchy
- [x] Existing assets, icons, data, routes, permissions, and mutations preserved
- [x] Responsive mobile overflow check
- [x] Primary interaction and console check
- [x] Unit tests, typecheck, lint, and production build

## Compact-density refinement

- Evidence: `context/evidence/member-pwa-compact-density/{restaurant-detail,order-detail}.png` and matching `*-comparison.png` boards.
- Restaurant and order details now use only the circular shell back control.
- Restaurant menu rows measure 84–85px with 68px real food images; three rows intersect the first 403 × 706 viewport and several fit once the menu list reaches the top.
- Restaurant details suppresses the floating New Order action so it cannot cover an item favorite control.
- No horizontal overflow was found; the 388px document width reflects the in-app browser's 15px scrollbar gutter.
- No actionable P0, P1, or P2 compact-density findings remain.

Final automated evidence: 94 test files / 520 tests passed; full workspace typecheck passed; web production build passed; lint passed with one pre-existing mobile hook dependency warning outside this redesign.

final result: passed
