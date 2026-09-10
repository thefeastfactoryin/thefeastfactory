# Home Page Design QA

## Comparison target

- Source visual truth: user-provided chat attachment showing the intended Feast Factory home page.
- Source dimensions: 1536 × 1024 px.
- Desktop implementation evidence: `tmp/home-redesign-qa/home-desktop-1536x1024.png`.
- Mobile implementation evidence: `tmp/home-redesign-qa/home-mobile-390x844.png`.
- Mobile full-page evidence: `tmp/home-redesign-qa/home-mobile-390x844-full.png`.
- Mobile expanded-header evidence: `tmp/home-redesign-qa/home-mobile-menu-open-390x844.png`.
- Mobile footer evidence: `tmp/home-redesign-qa/home-mobile-footer-collapsed-390x844.png` and `tmp/home-redesign-qa/home-mobile-footer-expanded-390x844.png`.
- CSS viewport and implementation pixels: desktop 1536 × 1024 at deviceScaleFactor 1; mobile 390 × 844 at deviceScaleFactor 1. No density normalization was required.
- State: anonymous customer on the home route. The source shows a signed-in/cart-count state, so the cart fill and Orders navigation item are treated as expected state differences rather than layout mismatches.

## Full-view comparison evidence

The supplied reference and the 1536 × 1024 Chrome implementation capture were visually compared at the same viewport. The implementation matches the source's primary composition: 78px white navigation, 400px maroon split hero, left-aligned display copy, gold CTA, single-row assurance chips, 90px four-column trust band, compact bordered kitchen strip, and the opening of the three-card ordering section in the first viewport.

The 390 × 844 and full mobile captures were also inspected for responsive behavior. The mobile layout preserves the source hierarchy, uses horizontal disclosure for chips/kitchens/ordering cards, and keeps fixed actions clear of the bottom navigation.

## Focused comparison evidence

- Header and hero: logo scale, type hierarchy, hero image subject/crop, 28px image radius, maroon/gold palette, CTA sizing and line wrapping match the source closely.
- Mobile header: the logo, “The Feast Factory” wordmark, location control and menu remain aligned in a 60px row at 390px. Cart/login remain accessible from the expanded menu and fixed bottom navigation.
- Mobile footer: Quick Links, Our Services and Contact default to closed native disclosure controls and expand independently with 48px summary targets.
- Trust and kitchen bands: section heights, dividers, icon treatment, city/license hierarchy and CTA placement match the source structure.
- Ordering section: centered eyebrow/display heading, right-aligned desktop link, three equal image cards and source-matched imagery align with the supplied design.

## Required fidelity surfaces

- Fonts and typography: Playfair Display/brand serif and Inter are retained. Display sizes, weights, line heights and wrapping match the reference at desktop; mobile uses a deliberate 42px responsive scale.
- Spacing and layout rhythm: 1536px composition, hero track proportions, section heights, card radii and first-viewport density match. No document-level horizontal overflow exists at either tested viewport.
- Colors and tokens: existing maroon, warm gold, ivory, border and muted tokens match the source palette and maintain readable contrast.
- Image quality and asset fidelity: existing high-resolution Feast Factory assets are used for the office buffet, meal box, occasion catering and custom-menu cards. No placeholder or synthetic substitute is present.
- Copy and content: source headline, supporting copy, trust labels, kitchen/license data and ordering labels are preserved. Dynamic operational values remain API-backed.

## Findings

- No actionable P0, P1 or P2 differences remain.

## Open questions

- The source shows an active cart with a count of one; the verification capture is anonymous with an empty cart. The cart is now visible in both states, and the existing active/count styling remains wired to cart state.

## Comparison history

1. Initial pass found a P1 mobile intrinsic-width expansion caused by the horizontally scrollable hero chips, plus a P2 collision between WhatsApp and the bottom navigation.
   - Fixes: added explicit `min-w-0` constraints to the hero grid and tracks; moved the WhatsApp launcher and sheet above the mobile nav.
   - Post-fix evidence: `tmp/home-redesign-qa/home-mobile-390x844.png`; document scroll width equals 390px.
2. Second pass found P2 desktop proportion and rhythm drift: the hero image began too far left, chips wrapped, and the kitchen block was too tall.
   - Fixes: adjusted the hero grid to 0.96fr/1.18fr, kept chips on one row, tightened kitchen vertical padding, and moved desktop delivery selection into a compact header action.
   - Post-fix evidence: `tmp/home-redesign-qa/home-desktop-1536x1024.png`.
3. Final pass found no remaining P0/P1/P2 issues.

## Primary interaction and runtime checks

- Verified Order Now, Packages, Meal Boxes, Menu, View All Kitchens and ordering-option destinations.
- Verified the mobile delivery-location dialog opens from its trigger.
- Verified the mobile header expands and exposes navigation, cart and login destinations.
- Verified all three mobile footer groups default closed and the first group toggles open.
- Verified no browser console errors during desktop and mobile captures.
- Verified desktop and mobile document widths equal their viewports.
- `npm run lint` passed.
- `npm run build:customer` passed.

## Follow-up polish

- P3: the reference uses distinct city landmark illustrations and subtle botanical/cloche decoration; the implementation intentionally uses the project's existing Lucide icon language because no matching source artwork is available.
- P3: capture an authenticated cart-count state if pixel comparison of the active maroon cart treatment is needed.

final result: passed
