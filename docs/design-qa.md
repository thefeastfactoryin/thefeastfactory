# Design QA — Cart Delivery Details

- Source visual truth: `docs/ui-audit/menu-select/implementation-desktop.png` (the approved compact ordering UI and Feast Factory visual language)
- Implementation target: `http://localhost:3000/cart`
- Desktop screenshots: `docs/ui-audit/cart/themed-calendar-desktop.png` and `docs/ui-audit/cart/themed-time-menu-desktop.png`
- Mobile screenshot: `docs/ui-audit/cart/themed-calendar-mobile.png`
- Viewports: `1440 × 1024` desktop and `390 × 844` mobile
- State: active meal-box cart with no saved address in the current test account
- Full-view comparison: `docs/ui-audit/cart/themed-picker-comparison.png`
- Focused comparison: `docs/ui-audit/cart/themed-picker-focus.png`

## Findings

- No actionable P0, P1, or P2 issues remain.
- The source and implementation are different workflow states, so the comparison evaluates the approved typography, palette, density, control treatment, borders, radii, and hierarchy rather than requiring identical content geometry.
- Typography retains the approved Playfair display hierarchy and compact sans-serif interface copy.
- Spacing and layout follow the established centered two-column checkout composition with a clearly dominant delivery panel and sticky quote.
- Maroon, gold, cream, and muted semantic states map consistently to the existing design tokens and maintain readable contrast.
- No new image assets are required for this form-focused change; existing brand and menu assets remain unchanged.
- Copy is customer-oriented and removes the unnecessary event-name concept from the visible flow.
- Mobile reflows to one column without horizontal overflow (`390px` viewport, `385px` document width).

## Behaviour Verified

- Event name is no longer collected from the customer; the selected package name is supplied internally for API compatibility.
- Existing cart date, time, guest count, and selected address hydrate automatically.
- The default saved address is automatically selected when no cart venue exists.
- Delivery date and time are separate, clearly labelled controls.
- The time selector exposes 36 predictable half-hour slots from 6:00 AM through 11:30 PM; arbitrary minute entry is unavailable.
- A previously saved non-standard time remains visible for backward compatibility.
- Calendar and time popovers use the existing maroon, cream, serif-display, border, radius, shadow, hover, focus, selected, and disabled tokens rather than importing a second UI framework.
- Both popovers dismiss with Escape and outside clicks; calendar navigation and all time slots are keyboard-reachable buttons.
- Guest/box count uses accessible increment and decrement controls and respects package limits.
- Saved addresses render as keyboard-accessible radio cards; the empty state links directly to address creation.
- No current-location button or geolocation request remains on the cart page.
- Guest stepper interaction was verified and restored to its original value after testing.
- Payment remains disabled until date, time, venue, valid count, and the latest quote are available.

## Patches Made

- Removed the event-name field and state from the cart UI.
- Replaced the browser-dependent combined date/time control with a dedicated date picker and a human-readable 30-minute time selector.
- Replaced the remaining native date and select popups with themed calendar and grouped time-slot popovers.
- Replaced the native venue select with interactive saved-address cards and explicit selected/default states.
- Added a compact guest/box stepper and package-limit guidance.
- Added automatic default-address selection copy and a first-address empty state.
- Removed current-location logic and its venue mutation request from the cart flow.
- Guarded invalid quote responses that omit an `errors` array, preventing the reported `undefined.join` runtime failure.
- Updated cart and pending-order summary copy to use delivery language instead of event-name language.

final result: passed
