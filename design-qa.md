# Order by KG UI — Design QA

- Source visual truth: user-provided chat reference, 1536 × 1024 px.
- Scope: minimal UI changes using the existing Feast Factory shell, typography, colors, imagery and card patterns.
- Implementation evidence: in-app browser captures in the current task at 1536 × 1024 and 390 × 844.
- State verified: anonymous customer with a temporary published KG catalog containing one vegetarian and one non-vegetarian dish. The temporary catalog was removed after verification.

## Findings

No P0, P1 or P2 visual defects remain. The new page fits the existing product rather than replacing the homepage layout from the reference. The reference's Order by KG entry is represented in the header, homepage ordering cards and footer, with the full dish-and-weight builder on `/order-by-kg`.

## Fidelity and responsive checks

- Existing serif headings, body type, primary red, ivory background, cards and borders remain consistent with the rest of the customer site.
- Desktop uses a dish grid with a sticky selection summary. Mobile collapses to one column with usable 44 px controls.
- Desktop measured 1531 px document width in a 1536 px viewport. Mobile measured 390 px document width in a 390 px viewport. Neither view had horizontal overflow.
- Existing catalog photography is reused. Dish names, diet labels, per-kg prices and live line totals remain legible at both viewports.
- Search and diet filtering work. Selecting 1.5 kg at ₹400.01/kg produced ₹600.02; adding 0.5 kg at ₹500/kg produced a combined ₹850.02 subtotal.
- Browser console errors: none.

## Verification

- API, customer and admin production builds passed.
- ESLint passed for all three applications.
- OpenAPI contract check passed.
- Full API suite passed, including the transactional PostgreSQL KG flow and mixed-cart checkout: 86/86.
- Temporary browser-test catalog and cart rows were removed after QA.

final result: passed

---

# Checkout address chooser — Design QA

- Source visual truth: `/var/folders/wl/lwjjyh6n1szd4mshv7057nm00000gn/T/codex-clipboard-65826796-feba-4c3d-93b0-2967d81c3495.png`
- Implementation: `apps/customer-web/components/selection-context-panel.tsx` (`AddressChooser` and compact checkout address row)
- Implementation screenshot evidence: Codex in-app browser tab 6, captured in this task in mobile-open and desktop-open states. The browser surface does not expose a filesystem path for its captures.
- Source pixels: 740 × 1600. Source represents an approximately 370 × 800 CSS-pixel mobile checkout at 2× density.
- Implementation viewports: 390 × 844 CSS pixels (mobile) and 1280 × 800 CSS pixels (desktop), device scale factor managed by the in-app browser.
- State: selected address collapsed; chooser open; alternate address selected and chooser closed.

## Full-view comparison evidence

The original checkout displayed every saved address inline below the selected address, pushing delivery options down the page. The implementation keeps only the selected address in checkout and moves alternatives into a bottom sheet on mobile. At the desktop breakpoint, the same chooser becomes a centered dialog. Both states were rendered and visually inspected in the in-app browser.

## Focused region comparison evidence

The address region was checked at mobile size for header hierarchy, selected radio state, address wrapping, the fixed add-address action, safe-area padding, and backdrop treatment. The desktop dialog was separately checked for width, centering, density, and list readability. No additional crop was needed because the complete chooser was readable in both captures.

## Required fidelity surfaces

- Fonts and typography: Existing product font tokens and weights are preserved. Address titles, metadata, helper copy, and actions retain a clear hierarchy without clipping.
- Spacing and layout rhythm: Mobile uses a bottom-aligned sheet with internal scrolling and a fixed footer. Desktop uses a compact centered dialog. Address rows remain comfortably tappable and do not overflow at 390px.
- Colors and visual tokens: Existing primary, foreground, muted, border, ivory, and secondary tokens are used. Selection is shown with border, fill, icon, and radio state rather than color alone.
- Image and icon quality: Existing Lucide address-type, check, close, and add icons are used consistently with the product. No new raster assets were required.
- Copy and content: “Change,” “Choose delivery address,” and “Add a new address” replace the ambiguous “Done” state. Address lines include locality, state, and pincode for repeated labels.

## Interaction and accessibility checks

- “Change” opens the chooser.
- Selecting another radio option closes the chooser immediately.
- Escape and backdrop close are implemented.
- Body scrolling is locked while the chooser is open.
- Dialog, radiogroup, radio state, labels, and minimum touch sizes are present.
- Browser console errors checked: none.

## Findings

No actionable P0, P1, or P2 issues remain.

P3: the local Next.js development badge can overlap the sheet footer in development mode only; it is not present in production builds.

## Comparison history

Initial comparison passed. No P0/P1/P2 visual fixes were required after the rendered mobile and desktop review.

final result: passed
