# Nyruthi UI Branch Rebuild Notes

Generated from branch `nyruthi-UI` for later implementation on `main`.

## Summary Recommendation

The `main` branch UI is better as a stable product app foundation: it is cleaner, more consistent with the existing checkout/order flows, and already has legal/footer/config work in progress. The `nyruthi-UI` branch is better for customer-facing sales conversion: it explains bulk catering faster, uses real food/event imagery, adds a Meal Boxes entry point, and gives customers clearer reasons to trust the service.

Recommended direction: keep `main` as the base UI system, then selectively port the `nyruthi-UI` landing-page content, About page structure, Meal Boxes page concept, logo/image assets, and maroon/gold/cream visual language. Do not wholesale replace main until the branch UI is refactored out of inline styles, made responsive, and connected to reliable package data.

## Local Comparison Evidence

- `nyruthi-UI` ran locally at `http://127.0.0.1:3002`.
- `main` ran locally at `http://127.0.0.1:3003` from a temporary worktree at `/private/tmp/aranyam-main-ui`.
- Screenshots captured locally:
  - `/private/tmp/aranyam-ui-shots/nyruthi-home.png`
  - `/private/tmp/aranyam-ui-shots/main-home.png`
  - `/private/tmp/aranyam-ui-shots/nyruthi-about.png`
  - `/private/tmp/aranyam-ui-shots/nyruthi-meal-boxes.png`
- Meal Boxes rendered its shell and skeleton/order sidebar during capture; its cards depend on `/packages` returning three non-custom active packages.

## Fonts And Visual System

Source: `apps/customer-web/app/layout.tsx`, `apps/customer-web/app/globals.css`.

- Body font: `Inter` from `next/font/google`.
- Heading font: `Playfair_Display` from `next/font/google`.
- CSS variables:
  - `--font-sans`: Inter.
  - `--font-heading`: Playfair Display.
- Palette:
  - Primary maroon: `--primary: 352 59% 30%` (`#7A1F2B` comment in CSS).
  - Accent gold: `--accent: 41 56% 51%` (`#C89B3C` comment in CSS).
  - Warm cream background: `--background: 39 44% 97%` (`#FAF7F2` comment in CSS).
  - Card white: `--card: 0 0% 100%`.
  - Muted warm beige: `--muted: 37 28% 93%`.
  - Border: `--border: 35 22% 87%`.
  - Veg marker: `--veg: 142 45% 38%`.
  - Non-veg marker: `--nonveg: 0 55% 42%`.
- Core shared classes:
  - `.page-shell`: max width `7xl`, responsive padding.
  - `.surface-card`: rounded `2xl`, border, card background, subtle shadow.
  - `.food-card`, `.pkg-card`, `.journey-card`: card styles for menu/package UI.
- Assets to port:
  - `apps/customer-web/public/logo.png`
  - `apps/customer-web/public/hero.jpg`

## Navigation / Shell Content

Source: `apps/customer-web/components/customer-shell.tsx`, `apps/customer-web/components/home/footer.tsx`.

Header:
- Logo image: `/logo.png`.
- Brand text: `The Feast Factory`.
- Tagline under logo: `Bulk Catering`.
- Desktop nav links:
  - Home: `/`
  - Packages: `/packages`
  - Meal Boxes: `/packages/meal-boxes`
  - Menu: `/menu`
  - Orders: `/orders`
  - About Us: `/about`
- Actions:
  - Notifications, only when logged in.
  - Cart button label: `Your cart`.
  - Login/Profile icon.

Footer:
- Brand: `The Feast Factory`.
- Tagline: `Bulk Catering`.
- Description: `Premium bulk catering for corporate offices, communities, and celebrations. Serving 20 to 1,000 guests with transparent pricing and on-time delivery.`
- Quick Links:
  - Home
  - Browse Menu
  - Packages
  - My Orders
- Services:
  - Meal Boxes
  - Occasion Packages
  - Build Your Own Menu
  - Corporate Catering
- Contact:
  - `+91 98765 43210`
  - `orders@thefeastfactory.in`
  - `Bengaluru, Karnataka, India`
- Legal links shown but placeholder hrefs:
  - Privacy Policy
  - Terms of Service
  - Refund Policy

Implementation note: port footer labels into the central constants/copy file on `main`, not hardcoded component arrays.

## Home Page Content To Rebuild

Source: `apps/customer-web/app/page.tsx`.

### Hero

Eyebrow:
- `Trusted by 2,000+ events across the city`

Headline:
- `Premium food, catered in bulk — without the chaos.`

Supporting copy:
- `From a 20-person team lunch to a 1,000-guest wedding — build your menu online, see per-head pricing live, and book in minutes.`

Chips:
- `From ₹349 / head`
- `20-guest minimum`
- `48-hour notice`

Primary CTA:
- Text: `Browse the menu →`
- Target: `/menu`

Secondary CTA:
- Text: `Talk to an event specialist`
- Target: `#contact`

Proof points:
- `4.8★` / `1,200+ reviews`
- `2,000+` / `events catered`
- `FSSAI` / `licensed kitchen`
- `98%` / `on-time delivery`

Hero image:
- Source: `/hero.jpg`
- Alt: `Buffet spread — chafing dishes with hot food at a catered event`

Floating quote card:
- `Live quote · 150 guests`
- `₹52,350 incl. taxes`

### Paths Section

Eyebrow:
- `Two ways to order`

Heading:
- `Pick the path that fits your event`

Copy:
- `Not sure? Packages are the fastest. Build Custom gives you full control.`

Cards:
- Packages
  - Tag: `Most popular`
  - Who: `Full-event menus`
  - Description: `Curated multi-course spreads priced per head. Pick Silver, Gold or Platinum and we handle the rest.`
  - CTA: `See packages →`
  - Target: `/packages`
- Meal Boxes
  - Who: `Individually packed`
  - Description: `Sealed single-serve boxes for offices, travel and events that need contactless, no-fuss serving.`
  - CTA: `Browse meal boxes →`
  - Target: `/packages/meal-boxes`
- Build Custom
  - Who: `Dish by dish`
  - Description: `Compose your own menu from 120+ dishes with live per-guest pricing as you add.`
  - CTA: `Start building →`
  - Target: `/menu`

### How It Works

Steps:
- `01` / `Pick a package` / `Choose a spread or start from scratch.`
- `02` / `Build your menu` / `Add dishes; see per-head pricing live.`
- `03` / `Schedule & pay` / `Set date, address and a secure deposit.`
- `04` / `We cater it` / `Freshly cooked, delivered & set up on time.`

### Packages Section

Eyebrow:
- `Curated packages`

Heading:
- `Transparent per-head pricing`

Copy:
- `All prices per guest. No hidden charges — GST shown at checkout.`

Cards:
- Silver
  - Price: `₹349 / guest`
  - Meta: `Min 20 guests · 48-hr notice`
  - Includes: `2 starters`, `3 mains + breads`, `1 dessert`, `Live counter optional`
  - CTA: `Customise Silver →`
- Gold
  - Tag: `Most chosen`
  - Price: `₹549 / guest`
  - Meta: `Min 20 guests · 48-hr notice`
  - Includes: `4 starters`, `5 mains + breads`, `2 desserts + beverage`, `1 live counter included`
  - CTA: `Customise Gold →`
- Platinum
  - Price: `₹849 / guest`
  - Meta: `Min 20 guests · 48-hr notice`
  - Includes: `6 starters`, `7 mains + breads`, `3 desserts + mocktails`, `2 live counters + service staff`
  - CTA: `Customise Platinum →`

Large-order copy:
- `Planning 500+ guests? Get a custom quote →`

### Popular Dishes

Eyebrow:
- `Crowd favourites`

Heading:
- `Dishes events keep ordering`

CTA:
- `See full menu →`
- Target: `/menu`

Dishes:
- Butter Chicken
  - Price: `₹210 / serves 1`
  - Veg: false
  - Tag: `Bestseller`
- Paneer Butter Masala
  - Price: `₹170 / serves 1`
  - Veg: true
  - Tag: `Corporate fave`
- Chicken Biryani
  - Price: `₹190 / serves 1`
  - Veg: false
- Veg Biryani
  - Price: `₹150 / serves 1`
  - Veg: true
  - Tag: `Most ordered`

### Guarantees

- `FSSAI-licensed kitchen`: `Every batch cooked in a hygiene-audited central facility.`
- `On-time, guaranteed`: `98% on-time record. Late delivery? Your service fee is on us.`
- `Free tasting`: `Sample your menu free on confirmed orders above ₹25,000.`
- `Easy changes`: `Adjust headcount or menu up to 48 hours before the event.`

### Testimonial

Quote:
- `We fed 600 guests at our annual conference and not one plate ran late. The live per-head pricing made approvals painless.`

Attribution:
- `Priya Nair`
- `Admin Lead, Orion Labs`

Stats:
- `4.8★` / `Average rating`
- `600` / `Largest single order`
- `12 yrs` / `Catering experience`

### Contact Band

Eyebrow:
- `Large or complex event?`

Heading:
- `Talk to an event specialist`

Copy:
- `For 500+ guests, multi-day events, or bespoke menus, a human will scope it with you and send a same-day quote.`

CTAs:
- `Request a callback` -> `/menu`
- `1800-FEAST` -> `tel:18003329278`

Info rows:
- `Response time`: `Within 2 working hours`
- `Book ahead`: `As early as 48 hours`
- `Service area`: `City-wide + 40 km radius`

Implementation notes:
- Replace inline styles with Tailwind/components before porting.
- Move all above content into the shared constants/copy system on `main`.
- Replace emoji icons with lucide icons or consistent branded icon treatment.
- Use `main` branch legal/footer constants where they already exist.

## Meal Boxes Page Content To Rebuild

Source: `apps/customer-web/app/packages/meal-boxes/page.tsx`.

Route:
- `/packages/meal-boxes`

Page title:
- `Meal Boxes`

Subtitle:
- `Delicious, balanced meals. Perfectly portioned.`

Top info chips:
- `Perfect for`
- `Minimum Order`
- `Hygienic & Fresh`
- `On-time Delivery`

Display box names:
- `3 Item Box`
- `5 Item Box`
- `8 Item Box`

Box metadata:
- 3 Item Box
  - Image: `https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=800&q=80`
  - Chips: `1 Main Course`, `1 Rice / Bread`, `1 Dessert`
- 5 Item Box
  - Image: `https://images.unsplash.com/photo-1484980972926-edee96e0960d?auto=format&fit=crop&w=800&q=80`
  - Chips: `1 Starter`, `1 Main Course`, `1 Rice`, `1 Beverage`, `1 Dessert`
  - Tag: `Most Popular`
- 8 Item Box
  - Image: `https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80`
  - Chips: `2 Starters`, `1 Main Course`, `1 Rice`, `1 Bread`, `1 Beverage`, `1 Dessert`, `1 Premium`

Comparison rows:
- Starter: 3 Item false, 5 Item true, 8 Item true
- Main Course: all true
- Rice / Breads: all true
- Beverage: 3 Item false, 5 Item true, 8 Item true
- Dessert: all true
- Premium Item: 3 Item false, 5 Item false, 8 Item true

Sample dishes:
- 3 Item Box:
  - Main Course: Paneer Butter Masala
  - Rice: Steamed Basmati Rice
  - Dessert: Gulab Jamun
- 5 Item Box:
  - Starter: Veg Manchurian
  - Main Course: Paneer Butter Masala
  - Rice: Steamed Rice
  - Beverage: Fresh Lime Juice
  - Dessert: Gulab Jamun
- 8 Item Box:
  - Starter: Veg Manchurian
  - Starter: Paneer Tikka
  - Main Course: Dal Makhani
  - Rice: Steamed Rice
  - Bread: Butter Naan
  - Beverage: Fresh Lime Juice
  - Dessert: Gulab Jamun
  - Premium: Rasgulla

Sidebar content:
- Header: `Your Order`
- Empty state:
  - `No box selected`
  - `Select a meal box below to see your order summary.`
- Quantity:
  - `How many boxes?`
  - Default quantity: `100`
  - Minimum fallback: `20`
  - Step size: `10`
- Selected state:
  - `Edit Box`
  - `Minimum order: {minQty} boxes`
  - `What's included in your box`
  - `Subtotal ({qty} boxes)`
  - `Delivery`: `FREE`
  - `Estimated Total`
  - CTA: `Continue to Checkout`
  - Trust note: `Secure & Safe Payments`

Bottom features:
- `Freshly prepared`: `Made with premium ingredients and no preservatives`
- `Hygienic packaging`: `Food safe, tamper-proof containers`
- `On-time delivery`: `Punctual delivery for all corporate & event orders`

Data dependency:
- Fetches `/packages`.
- Filters `!p.isCustom && p.activeVersion`.
- Sorts by `activeVersion.basePricePerPlate`.
- Uses the first three packages as the 3/5/8 item boxes.
- On continue, writes package + quantity into `order-builder.store` and routes to `/events/new?packageVersionId={id}`.

Implementation notes:
- This page must not depend on arbitrary first-three package ordering in production. Add an explicit package type/category/slug or config mapping for `3 Item Box`, `5 Item Box`, and `8 Item Box`.
- Keep the sticky order sidebar; it is a strong pattern for meal-box conversion.
- Add a real loaded/empty/error state when active packages are missing.
- Unsplash URLs should be replaced with approved local/CDN images before launch.

## About Us Page Content To Rebuild

Source: `apps/customer-web/app/about/page.tsx`.

Route:
- `/about`

Hero eyebrow:
- `About Us`

Hero headline:
- `Making Bulk Food Ordering Simple`

Hero copy:
- `At The Feast Factory, we believe ordering food for a group should be as easy as ordering a single meal. Whether you're planning a family gathering, office lunch, birthday celebration, housewarming, festive occasion, or any event that brings people together, we help you order delicious food in bulk without the usual hassle.`
- `Backed by 10+ years of experience in food preparation and hospitality, The Feast Factory combines culinary expertise with technology to deliver a seamless bulk food ordering experience. Our focus is on quality, consistency, hygiene, and customer satisfaction in every order we serve.`

Hero values:
- `Fresh Ingredients`: `Sourced daily`
- `Hygienic Kitchens`: `Clean. Safe. Certified.`
- `On-time Delivery`: `Always on schedule`
- `Made with Care`: `By passionate chefs`

Hero image:
- `https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=900&q=80`

Experience badge:
- `10+`
- `Years of Experience`
- `Trusted by thousands of customers and organizations across the city.`

Stats bar:
- `10,000+` / `Happy Customers` / `Served across all occasions`
- `50,000+` / `Orders Delivered` / `With love and care`
- `10+` / `Years of Experience` / `In bulk food service`
- `50+` / `Cities Served` / `And growing`
- `100%` / `Hygiene Assured` / `Safety is our priority`

Mission card:
- Heading: `Our Mission`
- Copy: `To make bulk food ordering convenient, affordable, and dependable for every celebration, gathering, and business need.`

What We Offer:
- `Bulk Food Orders` / `for Groups of Any Size`
- `Birthday & House Party` / `Food Solutions`
- `Party Packs & Family Combos`
- `Customizable Menus`
- `Corporate Lunch & Dinner Orders`
- `Scheduled Deliveries`
- `Festival & Celebration Food Orders`
- `Hygienically Prepared & Professionally Packed Meals`

Why Choose Us:
- `10+ Years of Food Expertise`: `Our team brings over a decade of experience in food preparation, menu planning, and serving thousands of customers.`
- `Built for Bulk Orders`: `Whether you're feeding 20 people or 500, our platform is designed specifically to handle large food orders efficiently.`
- `Consistent Quality`: `Every dish is prepared using standardized processes to ensure great taste and consistency every time.`
- `Transparent Pricing`: `Know exactly what you're paying for with clear pricing and flexible menu options.`
- `Reliable Delivery`: `From preparation to packaging and delivery, we ensure your order reaches you fresh and on time.`

Vision:
- Heading: `Our Vision`
- Copy: `To become India's most trusted bulk food ordering platform, enabling people and organizations to enjoy great food without the complexities of planning and coordination.`

Food image:
- `https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=700&q=80`

Food for Every Gathering:
- Copy: `From office meetings and team lunches to birthdays, family functions, festive celebrations, and community events, The Feast Factory makes bulk food ordering simple, reliable, and stress-free.`
- Badge: `Powered by 10+ Years of Food Preparation Excellence.`

Footer band:
- Brand: `The Feast Factory`
- Tagline: `Order More. Stress Less. Celebrate Better.`
- Pillars:
  - Great Food
  - Happy People
  - Memorable Moments
  - Every Time

Implementation notes:
- This is a stronger customer-trust page than main's placeholder legal-style About page.
- Move copy into constants.
- Replace broad/unverified claims such as `50+ Cities Served` and `50,000+ Orders Delivered` if the business cannot substantiate them.
- Remove emojis from production copy unless the brand intentionally wants a playful tone.

## Main vs Nyruthi UI Assessment

### What Main Does Better

- More cohesive with the existing app/product flows.
- Cleaner component style with fewer inline styles.
- Better legal/footer/config direction from the current go-live work.
- The homepage feels premium and less cluttered.
- Lower implementation risk because it already works with current routes and content model.

### What Nyruthi UI Does Better

- Much stronger first-time customer comprehension: it immediately says bulk catering, price, minimum order, lead time, and audience.
- Real food/event imagery makes the product easier to trust.
- Includes `Meal Boxes`, which appears to match customer feedback and a likely high-conversion use case.
- About page is far more persuasive and complete.
- Header navigation exposes more customer-intent routes.
- Landing page has better conversion sections: proof points, paths, packages, popular dishes, guarantees, testimonial, and contact CTA.

### Risks In Nyruthi UI

- Heavy inline styles on the home page make long-term maintenance harder.
- Several content claims need business validation.
- Some copy is hardcoded and should move into constants.
- Meal Boxes depends on the first three active non-custom packages, which is fragile.
- Remote Unsplash images should be replaced with owned/local/CDN assets.
- The captured Meal Boxes page stayed in skeleton state, likely due to local API/package data mismatch.
- Some accessibility checks still need browser-level verification: focus order, heading hierarchy after full scroll, contrast on gold text, keyboard navigation, and mobile layout.

## Decision

Best product direction: hybrid.

Use `main` for the application shell, component discipline, checkout/order consistency, and go-live-safe legal/config work. Port the `nyruthi-UI` customer-facing marketing content and visual direction into `main` as refactored, constants-driven components.

Priority order for implementation on `main`:
1. Port fonts, logo, hero image, and maroon/gold/cream tokens carefully into the existing design system.
2. Replace the main home page hero/content with the stronger branch landing content, but implement it with reusable components and responsive Tailwind.
3. Add the `/packages/meal-boxes` route, backed by explicit package configuration rather than first-three active packages.
4. Replace About Us with the branch About page content, after validating claims.
5. Add `Meal Boxes` and `About Us` to customer navigation/footer constants.
6. Move all text into the shared constants/copy file before merging.
