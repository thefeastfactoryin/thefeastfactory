# External Integrations

The active provider scope is Razorpay, MSG91, Cloudflare R2 image storage, and Google Maps. Local development remains usable with provider fallbacks.

## MSG91 OTP

Needed variables:

- `MSG91_AUTH_KEY`
- `MSG91_TEMPLATE_ID`
- `MSG91_SENDER_ID`
- `MSG91_OTP_EXPIRY_SECONDS`

Steps:

1. Create or log in to a MSG91 account.
2. Complete required sender ID and template approvals.
3. Create an OTP template for login verification.
4. Copy the auth key, template ID, and sender ID into `apps/api/.env`.
5. Keep OTP expiry aligned with `PlatformSetting.otp_expiry_seconds`.

## Razorpay

Needed variables:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_CURRENCY`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`

Webhook URL:

```text
${API_PUBLIC_URL}/payments/razorpay/webhook
```

Examples:

```text
Local development through a tunnel:
https://<your-ngrok-or-cloudflare-tunnel-domain>/payments/razorpay/webhook

Production:
https://<your-api-domain>/payments/razorpay/webhook
```

Use the backend/API domain for this URL. Do not use the customer web domain or admin web domain unless that same host is reverse-proxying API traffic to `apps/api`.

Steps:

1. Create or log in to a Razorpay merchant account.
2. Use test mode while developing.
3. Copy key ID and key secret from the Razorpay dashboard into `apps/api/.env`.
4. Add the key ID to both frontend `.env.local` files as `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
5. Create a webhook endpoint using the full URL above.
6. Subscribe to these events used by the API:
   - `payment.captured`
   - `payment.failed`
   - `refund.processed`
   - `refund.failed`
7. Copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET`.
8. Restart the API after changing `apps/api/.env`.

## Cloudflare R2 image storage

Needed variables:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`

Steps:

1. Create a Cloudflare R2 bucket for customer-facing images.
2. Create an R2 API token scoped to object writes for that bucket.
3. Configure a public custom domain or R2 public-development URL.
4. Set all five variables together; partial R2 configuration is rejected at API startup.
5. Configure public reads for the `images/` prefix and CORS for approved app origins.

The API accepts JPEG, PNG, and WebP images up to 5 MB through `POST /admin/uploads/images`. When R2 credentials are blank, development uploads use `.local-uploads/images/`; production rejects uploads rather than relying on ephemeral local disk. The older menu-specific route remains as a compatibility alias.

## Google Maps Address Picker

Needed variable:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

Steps:

1. Enable Maps JavaScript API, Places API (New), and Geocoding API in Google Cloud.
2. Create a browser API key.
3. Restrict the key to the customer application's local and deployed HTTP referrers, including `http://localhost:3000/*`, `https://thefeastfactory.in/*`, and `https://www.thefeastfactory.in/*`.
4. Restrict API access to the three enabled Maps APIs. The customer app uses `PlaceAutocompleteElement`; the legacy Places API is not required.
5. Add the key to `apps/customer-web/.env.local`.
6. Keep the key blank when testing manual address entry without Google Maps.

Chrome requests location permission only after the customer selects **Use my location**. Deployed environments must use HTTPS for browser geolocation.

## Deferred Providers

- Resend is not active. Receipts and invoices are authenticated downloads, and order milestones use in-app notifications.
- Sentry is not active or required for the current release.

## Invoice Configuration

GST invoices require platform settings for legal business name, registered address, GSTIN, state code, tax rates, SAC code, document prefixes, support contacts, and legal footer. Until the required identity fields are complete, only non-tax payment receipts are generated.
