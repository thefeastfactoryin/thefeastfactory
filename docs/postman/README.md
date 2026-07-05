# Postman Collections

Import `the-feast-factory-api.postman_collection.json` into Postman to test the APIs currently implemented.

## Local Flow

1. Start the API:

```bash
npm run dev:api
```

2. Run `Health / GET Health`.

3. Run `Admin Auth / POST Admin Login`.

4. Run `Customer Auth / POST Request OTP`.

5. Copy the OTP printed in the API terminal:

```text
Local OTP for 9999999999: 123456
```

6. Paste the OTP into the `customerOtp` collection variable.

7. Run `Customer Auth / POST Verify OTP`.

8. Run requests under `Customer Profile And Addresses`.

The collection automatically stores access and refresh tokens after successful login/OTP verification.

## Menu And Package Flow

1. Run `GET /catalog/public-settings` to inspect the database-managed booking window, service times, and public business details.
2. Run `GET /catalog/ordering-offerings` to inspect the database-managed catalogue cards.
3. Run `Menu Catalog / GET Menu Categories`.
4. Run `Menu Catalog / GET Menu Items`.
5. Run `Packages / GET Packages`; this stores the first package and active version IDs.
6. Run `Packages / GET Package Configuration`.
7. Copy valid category and menu item IDs from the configuration into the collection variables or request body.
8. Run `POST /package-versions/:id/preview-quote` for the public server-authoritative estimate, then run authenticated cart quote requests for the final address-aware amount.

Admin menu and package requests require `POST Admin Login` first.

Swagger at `http://localhost:4000/docs` is the source of truth for request schemas when a newly generated endpoint is not yet saved in the collection.

## Event, Order, Payment, And Admin Flow

1. Complete customer OTP verification and create/select an address.
2. Run `Packages / GET Packages` and copy valid menu selections from package configuration.
3. Run `Events And Orders / POST Create Event`.
4. Run order quote, then create the order.
5. Run `Payments / POST Create Razorpay Order`.
6. When `localMode` is true, verify with signature `local_success`.
7. Run `Admin Auth / POST Admin Login`.
8. Use `Admin Operations And Reports` to update status, inspect payments, issue local refunds, and view reports.
