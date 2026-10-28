# Architecture and replacement analysis

Baseline reviewed: `067359313e6db3837a1996b9af9d201f90c5a4f3`.

## Existing application

The repository contained three applications: `Frontend/` (React 18, Create React App, Redux Toolkit, Formik), `Admin/` (a separate CRA/Ant Design application), and `Backend/` (Express 4, Mongoose 7, bcrypt, JWT, Cloudinary, Nodemailer, Razorpay). There was no root workspace manifest. The backend committed 8,782 dependency files. Both frontends duplicated authentication and request logic.

Existing implemented concepts: catalogue, category/colour/brand management, cart, wishlist, reviews, coupons, addresses, orders, account recovery and admin CRUD. These are code-level findings, not a claim that the original deployment worked. The original application was not booted against production data or credentials.

Confirmed defects from source inspection:

- Registration passed the full request body to User.create, allowing role assignment and exposing stored fields in responses.
- User listing and deletion routes had no authentication; analytics were not consistently admin-only.
- Cart and order controllers trusted client prices/totals. Payment verification merely echoed IDs.
- Payment provider credentials were hardcoded in a public source file. Revoke them; deleting code does not remove Git history.
- Password reset returned/logged the reset token. Saving an unchanged password could rehash it because the pre-save hook did not return after next().
- Logout used a token string as a Mongo filter. Admin login dereferenced a missing user. Blocked accounts were not consistently denied.
- Access tokens lived in localStorage, API origins were hardcoded, CORS was unrestricted, and there was no CSRF strategy or meaningful backend test suite.
- No custom-model request/quote/payment workflow existed. Generic electronics images and policies did not describe a print studio.

Preserved: the Voxel identity, original logo and printer photograph under `client/public/images`, and domain concepts for products, users, orders, coupons and reviews. Legacy executable code and tracked node_modules are removed from the replacement. Git history preserves the original source. New schemas deliberately use a fresh Mongo database; production data has not been read, migrated, or deleted.

## Structure

- `client/src/pages`: lazy route modules, customer and admin screens.
- `client/src/components`: accessible fields, cards, layout, addresses, lazy Three.js viewer.
- `client/src/lib`: fetch/CSRF/refresh client, resource hook, session context.
- `client/src/stores`: Zustand persisted cart and wishlist. These store selections, never auth tokens or authoritative prices.
- `server/src/routes`: endpoint wiring and Zod schemas.
- `server/src/controllers`: HTTP adaptation and straightforward CRUD/query operations.
- `server/src/services`: transactional checkout, auth, quotes, provider boundary, scanned storage, email delivery.
- `server/src/models`: Mongoose schemas, constraints and indexes.
- `server/src/middleware`: auth, role and ownership checks, CSRF, validation, error responses.
- `server/tests`, `client/src/components/*.test.jsx`, `e2e`: integration, UI and browser flow tests.

Zustand keeps the browser-side selection state small. Account identity is loaded from server cookies; server records are fetched on demand. Redux would add more ceremony than this state model needs. CSS tokens and reusable components provide styling without a framework dependency.

## Records and relationships

| Record                  | Relationships / purpose                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| User                    | Owns addresses, wishlist, sessions, carts, orders, reviews, custom requests; bcrypt password, role, block flag, token version   |
| Session                 | Hashed opaque refresh secret, user, family, expiry, replay revocation                                                           |
| Product                 | Category, images, optional public model URL, embedded material/colour/size/SKU variants with integer prices and available stock |
| Cart                    | Unique per user; product/variant IDs and quantities only                                                                        |
| Order                   | User, optional custom request, immutable line/address/price snapshots, currency, payment state, fulfilment history, Stripe IDs  |
| PrintRequest            | User, private Upload, dimensions, quantity, deadline, versioned currency-bearing quote, messages, order and history             |
| Review                  | Unique user/product pair, verified purchase gate, moderation flag                                                               |
| Coupon / Settings       | Discount terms; shipping rates, tax basis points, currency and contacts                                                         |
| Upload                  | Owner, random private object key, format/name/size and scan result                                                              |
| PaymentEvent / EmailJob | Webhook idempotency and durable retryable email outbox                                                                          |

Stock is reserved transactionally at checkout. A confirmed expired session returns stock once. Unknown provider outcomes retain the reservation for reconciliation instead of risking overselling. Paid order transitions are explicit. Refunds are full refunds and do not automatically restock potentially printed/shipped goods.

## API map

All successful JSON responses are `{success:true,data}`. Errors are `{success:false,error:{message,fields?}}`.

| Prefix                                 | Methods / paths                                                                                                       | Access                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `/api/auth`                            | GET csrf, me; POST register, login, refresh, logout, forgot-password, reset-password, password; PUT profile, wishlist | Session required for profile/password; CSRF on writes |
| `/api/products`                        | GET `/`, `/:slug`                                                                                                     | Public                                                |
| `/api/categories`, `/api/settings`     | GET                                                                                                                   | Public                                                |
| `/api/cart`                            | GET, PUT                                                                                                              | Customer                                              |
| `/api/orders`                          | POST estimate, POST `/`, GET `/`, GET `/:id`                                                                          | Owner/admin; server pricing                           |
| `/api/requests`                        | GET/POST `/`, GET `/:id`, POST `/:id/messages`, `/:id/decision`, `/:id/pay`                                           | Owner/admin                                           |
| `/api/uploads`                         | POST `/image` or `/model`, GET `/:id/download`                                                                        | Images admin-only; private files owner/admin          |
| `/api/images/:id`                      | GET redirect to short-lived signed image URL                                                                          | Public product images only                            |
| `/api/reviews`                         | POST                                                                                                                  | Verified buyer                                        |
| `/api/admin`                           | GET dashboard, products, users, reviews, coupons                                                                      | Admin with changed password                           |
| `/api/admin/products`                  | POST `/`, PUT/DELETE `/:id` (delete archives)                                                                         | Admin                                                 |
| `/api/admin/categories`                | POST                                                                                                                  | Admin                                                 |
| `/api/admin/orders/:id`                | PUT; POST `/refund`                                                                                                   | Admin                                                 |
| `/api/admin/requests/:id/quote`        | POST                                                                                                                  | Admin                                                 |
| `/api/admin/users/:id`, `/reviews/:id` | PUT                                                                                                                   | Admin                                                 |
| `/api/admin/coupons`, `/settings`      | PUT                                                                                                                   | Admin                                                 |
| `/api/webhooks/stripe`                 | POST raw signed payload                                                                                               | Stripe signature; exempt from browser CSRF            |
| `/health`                              | GET                                                                                                                   | Readiness                                             |

## Page map and design

Public: `/`, `/products`, `/products/:slug`, `/cart`, `/wishlist`, `/materials`, `/login`, `/register`, `/forgot-password`, `/reset-password/:token`.
Authenticated: `/checkout`, `/checkout/custom/:requestId`, `/custom`, `/account`, `/account/security`, `/orders`, `/orders/:id`, `/requests`, `/requests/:id`.
Admin: `/admin`, `/admin/{dashboard,products,orders,requests,users,reviews,coupons,settings}`.

Charcoal/olive surfaces, off-white typography, acid-lime controls, layered geometric objects, floating ribbon, Space Grotesk/DM Sans. Mobile breakpoints, semantic controls, visible keyboard focus, status/error announcements and reduced-motion styles are included. Full WCAG AA certification is not claimed. The model viewer is a separate dynamic bundle with demand rendering, bounded pixel ratio and an error boundary. Seed product illustrations are conceptual CSS artwork, not photographs of actual inventory.

## Phase reviews

1. Foundation/models: strict schemas, integer money, unique indexes, request limits, environment validation.
2. Auth: no password/token disclosure; field allowlists; reset single-use; refresh rotation; forced seed password change; role checked from database.
3. Commerce: server prices, transactions, concurrent last-unit test, immutable snapshots, signed raw webhook, event replay test, pending/paid separation.
4. Custom prints: ownership checks, scanned private files, quote versions/expiry/currency, explicit acceptance, paid-order-driven production states.
5. Admin: backend RBAC for every admin route, own-account block prevention, archived products preserve order history, refund idempotency.
6. Frontend: responsive CSS, keyboard labels/focus, semantic errors, route splitting; corrected eager model-viewer preload during review.
7. Tests: actual results are recorded in TESTING.md. External provider operation is a separate deployment smoke test.
8. Seed/docs: idempotency test, secrets only in environment, no automatic migration of live data, deployment/runbook and limitations included.
