# The Feast Factory — Go-Live Readiness Analysis

> Generated: June 21, 2026

---

## 1. External Integrations & Keys

| Integration | Status | What's Needed |
|---|---|---|
| **MSG91 OTP** | Falls back to console log | `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `MSG91_SENDER_ID` in `apps/api/.env` |
| **Razorpay** | Falls back to local-mode | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` + `NEXT_PUBLIC_RAZORPAY_KEY_ID` in both frontend `.env.local` files. Webhook URL + domain whitelist in Razorpay dashboard |
| **Google Maps** | Skips map if blank | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `apps/customer-web/.env.local` |
| **GCP Storage** | Falls back to local disk | `GCP_PROJECT_ID`, `GCP_STORAGE_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS` in `apps/api/.env` |
| **JWT secrets** | Validated but need production values | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (min 32-char random strings for prod) |
| **Resend (email)** | ❌ Never implemented | No email sending exists anywhere — confirmed/cancelled order emails are silent |
| **Sentry** | ❌ Never integrated | Listed in spec but zero code present |
| **Google Cloud Logging** | ❌ Never integrated | Listed in spec, only console logging exists |

---

## 2. Hardcoded Values That Should Be Config / Constants

These are scattered in TSX/TS files and should move to a constants file or environment variable before going live.

| Hardcoded Value | File | Fix |
|---|---|---|
| `"The Feast Factory"` | `customer-shell.tsx`, `admin-shell.tsx`, `checkout/page.tsx`, `layout.tsx` | Move to `NEXT_PUBLIC_BRAND_NAME` env or a shared `constants.ts` |
| `"Celebrations, served"` | `components/customer-shell.tsx` | Move to constants |
| `theme: { color: '#1b513a' }` | `app/checkout/page.tsx` | Should come from env or brand config |
| `+91` India phone prefix | `app/login/page.tsx` | Move to constants (country config) |
| `"10 to 500+"` guest range | `app/page.tsx` | Should come from `min_guest_count` / `max_guest_count` platform settings |
| `http://localhost:4000` default | `lib/api.ts`, `storage.service.ts`, `env.validation.ts` | Fine as fallback but make sure prod envs override |
| `'15m'` / `'30d'` JWT expiry | `config/env.validation.ts` | Reasonable defaults, but document clearly |
| 48-hour lead time | `app/events/new/page.tsx` | Hardcoded as `date + 2 days` but `min_booking_lead_hours` is a DB platform setting — frontend doesn't read it |

---

## 3. Missing Pages / Screens

These are completely absent and some are mentioned explicitly in `Next_steps.md`.

| Missing Screen | Impact | Notes |
|---|---|---|
| **About Us** | Medium | Customers have no context about the kitchen, story, or team |
| **Help & FAQ** | High | No support channel, no "how does this work?" page for first-time customers |
| **Contact Us** | High | Zero way for a customer to reach you in case of an issue |
| **Terms of Service** | Critical | Required legally before taking payments |
| **Privacy Policy** | Critical | Required legally, especially for mobile OTP collection |
| **Cancellation Policy** | High | Currently shown nowhere — customers don't know the policy before paying |
| **Custom 404 page** | Low | Default Next.js 404 is shown |
| **Admin password reset** | Medium | Admin users have no self-service password recovery flow |

---

## 4. Missing Footer

The customer web has **no footer at all**. `components/customer-shell.tsx` ends after the mobile nav — there is no `<footer>` element. A live product needs:

- Brand name + tagline
- Navigation links (About, FAQ, Contact, T&C, Privacy)
- Social media links
- Copyright year
- GST / business registration number (legally required for billing)

---

## 5. Functional Gaps — Customer Side

| Gap | Impact |
|---|---|
| **Customer cannot cancel an order** | No self-service cancel button on the order detail page — only admins can cancel. High-friction for customers |
| **Customer cannot see refund status** | Refund records exist in DB but the order detail page shows nothing about refunds or credit notes |
| **Order status labels show raw enum** | `order.orderStatus.replaceAll('_', ' ')` — "PENDING_PAYMENT" appears instead of "Awaiting Payment" |
| **No estimated delivery time shown** | Operations know the date but customers see no ETA on the tracking page |
| **48-hour lead time hardcoded in frontend** | `app/events/new/page.tsx` uses `date + 2 days` — should read `min_booking_lead_hours` from platform settings |
| **Menu item images not displayed** | `imageUrl` exists on `MenuItem`, upload exists in admin, but the public menu and menu-select pages don't render images — only a placeholder icon |
| **No "re-order" option** | Good UX for repeat customers — one-click re-book from order history |
| **Cart is device-local only** | Zustand cart in `localStorage`. Switching device or browser loses the cart |

---

## 6. Functional Gaps — Admin Side

| Gap | Impact |
|---|---|
| **Reports page is extremely basic** | Shows 3 summary numbers and a popular dishes list. No date filter, no chart, no export |
| **No CSV / Excel export** | Admin cannot export order lists, payment records, or reports |
| **No admin user management screen** | No UI to create, edit, or deactivate admin users or assign regions |
| **No customer search / lookup** | Admin cannot look up a customer by mobile number to view their profile and orders |
| **Menu image upload only** | No bulk import or CDN URL option for menu item images |

---

## 7. API / Backend Gaps

| Gap | File | Impact |
|---|---|---|
| **Global exception filter not wired** | `PLAN.md` marks Phase 3 incomplete | Unhandled errors return raw NestJS 500 responses to the browser |
| **OTP rate limiting missing** | `PLAN.md` marks Phase 3 incomplete | `POST /auth/customer/request-otp` is wide open for abuse and MSG91 cost overruns |
| **No email service** | Spec lists Resend | No order confirmation, payment receipt, or cancellation email is sent |
| **`NEXT_PUBLIC_RAZORPAY_KEY_ID` not in env validation** | `config/env.validation.ts` | Documented in `docs/integrations.md` but never validated on startup |
| **Webhook endpoint needs real domain** | — | Razorpay cannot reach `localhost` — must deploy API first, then register the webhook URL |
| **No API versioning** | `app.module.ts` | Risky for future breaking changes — consider a `/v1/` prefix |
| **Soft-deleted users still receive OTPs** | `auth.service.ts` | `deletedAt` field exists on `User` but `requestOtp` does not check it |

---

## 8. Suggested Feature Add-ons

These are out of current scope but would significantly improve the product post-launch.

| Feature | Why It Matters |
|---|---|
| **WhatsApp order notifications** | Indian market heavily uses WhatsApp; MSG91 supports it. Customers expect WhatsApp confirmations for food orders |
| **Pre-tasting / menu inquiry form** | Allow customers to request a call or tasting before committing — converts high-value events |
| **Promo / discount code at checkout** | Simple percentage or flat discount — essential for launch marketing |
| **Repeat order / re-book** | One-click re-order from order history for regular customers |
| **Admin bulk status update** | Select multiple orders → mark as In Progress at once. Useful on busy catering days |
| **Customer review after delivery** | Post-delivery rating and comment — builds trust and gives operations feedback |
| **Package comparison page** | Side-by-side Silver / Gold / Premium table — aids conversion |
| **Kitchen gallery / About page with photos** | Social proof is critical for catering; a photo gallery of real events converts undecided customers |
| **Downloadable menu PDF** | Customers often want to share the menu with family before booking |
| **Waitlist / inquiry for fully-booked dates** | Capture interest when a date is at capacity |

---

## 9. Pre-Launch Checklist

### Must-haves before going live

- [ ] Wire real MSG91 keys and test OTP delivery end-to-end
- [ ] Wire real Razorpay keys, whitelist your domain, register the webhook URL
- [ ] Add **Terms of Service** page (legal requirement before payments)
- [ ] Add **Privacy Policy** page (legal requirement for OTP / mobile data collection)
- [ ] Add **Cancellation Policy** visible to customers before payment
- [ ] Add **Help / Contact** page with a phone number or support email
- [ ] Add a **footer** with legal info, navigation links, and copyright
- [ ] Implement OTP rate limiting (Phase 3 gap in `PLAN.md`)
- [ ] Wire global exception filter in `main.ts` (Phase 3 gap)
- [ ] Implement Resend (or equivalent) email for order confirmation and cancellation
- [ ] Move brand name, tagline, and brand colour to a shared constants file
- [ ] Fix order status display — readable labels instead of raw enum strings
- [ ] Read `min_booking_lead_hours` from platform settings in the frontend
- [ ] Display menu item images on the public menu and menu-select pages

### Should-haves before going live

- [ ] Admin password reset flow
- [ ] Customer self-service order cancellation (within a configurable time window)
- [ ] Refund status visible to customers on the order detail page
- [ ] Date-range filtered reports for admin
- [ ] Custom 404 and error pages
- [ ] Validate `NEXT_PUBLIC_RAZORPAY_KEY_ID` in env validation
- [ ] Guard `requestOtp` against soft-deleted users
