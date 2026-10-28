# Feature checklist and consultant recommendations

## Implemented

- [x] Vite storefront; dark voxel design, ribbon, subtle motion, mobile layouts, reduced motion, keyboard focus, lazy pages.
- [x] Featured catalogue, categories, custom-print process and FAQ. Honest review section instead of invented testimonials.
- [x] Search, category/material/colour/minimum and maximum price filters, sorting, pagination;
- [x] Product image gallery, variants/stock, optional STL/OBJ/3MF viewer, verified-purchase review submission and moderation.
- [x] Persistent local cart/wishlist, shipping address/method, coupon, server total estimate, Stripe redirect and order tracking.
- [x] Registration/login/logout, cookie JWT, hashed rotating refresh sessions, password reset/change, profile/address book and histories.
- [x] Custom ideas or private model uploads, dimensions/material/colour/quantity/deadline, browser preview, quote version/expiry/currency, accept/decline/pay, conversation and status history.
- [x] Admin analytics, top products, sales chart, low stock, product create/edit/archive, multiple image uploads, SKU variants, category creation.
- [x] Admin order fulfilment/tracking, full refunds, custom quotes/messages/print queue, account blocking, review moderation, coupon enable/disable, store settings.
- [x] CSRF, allowlisted CORS, Helmet, rate limits, NoSQL sanitization, field validation, ownership checks, private file access, no raw HTML rendering.
- [x] Payment signatures, replay protection, transactional stock reservation, server prices, durable email jobs, idempotent seed, CI, setup/deployment/runbook.

## Explicit limitations / launch dependencies

- Real Stripe, S3/ClamAV, SMTP, Atlas and hosting credentials are not supplied or provisioned. Provider calls are tested using test doubles except real signature cryptography. Complete external test-mode smoke tests before accepting money.
- Currency formatting/calculation assumes two-decimal currencies. Changing currency is not an exchange conversion. Monthly reports label and separate historical currencies.
- Seed artwork is stylised CSS illustration, not actual product photography. Retained logo/printer assets are available. Replace sample items with real sizes, photographs and prices before sales.
- No invented testimonials are displayed. Approved customer reviews supply genuine social proof.
- No automatic old-database migration; deploy against a fresh database. Legacy credentials must be revoked separately.
- Cart/wishlist persist on the current browser. Server cart/wishlist APIs exist, but automatic multi-device synchronisation is not wired into the UI.
- Full refunds only. Returns, partial refunds, disputes, externally initiated refunds, courier API tracking and invoice PDFs are not included. Tracking uses the admin-entered number and status timeline.
- Admin lists are capped at 200 records, dashboard queue at 50. Add cursor pagination and date-range reporting before volume exceeds these bounds.
- Category creation is implemented; renaming/deleting categories and arbitrary role promotion are intentionally not exposed. User management supports viewing/blocking; no irreversible account deletion UI.
- Email uses an outbox with retries; delivery can be at-least-once after a crash. No marketing/abandoned-cart automation or email verification is included.
- The 3D viewer is lazy and bounded. STL parsing runs in a timeout-limited Web Worker; OBJ/3MF previews use stricter size limits but parse on the main thread. Very complex models can still stress low-memory devices. Files need studio printability review, and 3MF support is conservative.
- Malware scanning is a defence, not a guarantee. No model is executed. Orphan uploads after an abandoned form need a lifecycle cleanup policy.
- Unknown Stripe session-creation outcomes retain stock pending manual reconciliation. This prioritises avoiding overselling. Add automated reconciliation for higher throughput.
- Single-instance in-memory rate limiting; distributed limiter and separate worker needed before scaling. No claim of a completed WCAG audit, penetration test, or live-payment certification.

## Ranked improvements (impact versus effort)

| Priority | Improvement                                                     | Impact      | Effort     | Status                                                                                                                     |
| -------- | --------------------------------------------------------------- | ----------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1        | Stock reservations, replay-safe payments, low-stock visibility  | High        | Medium     | Included                                                                                                                   |
| 2        | Material/colour guidance and explicit intended use              | High        | Low        | Material guide included; physical colour samples next                                                                      |
| 3        | Print queue and customer/admin conversation                     | High        | Medium     | Included                                                                                                                   |
| 4        | CI tests/build and durable email retries                        | High        | Medium     | Included; connect deployment gates                                                                                         |
| 5        | Atlas backups + S3 versioning/retention + restore drills        | High        | Low–Medium | Runbook included; infrastructure configuration required                                                                    |
| 6        | Real catalogue photography and dimension/spec sheets            | High        | Medium     | Owner-supplied content needed                                                                                              |
| 7        | Instant STL volume/weight estimate                              | High        | High       | Next: watertight-mesh checks, unit confirmation, density, infill/support and calibration; show estimate, not binding quote |
| 8        | Slicer-based print time and printer-capacity scheduling         | High        | High       | Next: isolated queued slicer workers, machine/material profiles, human approval                                            |
| 9        | Bulk pricing and margin floors                                  | Medium–High | Medium     | Quantity-aware custom quotes and coupons included; automatic tiers next                                                    |
| 10       | WhatsApp customer contact                                       | Medium      | Low        | Configurable click-to-chat and email links included; live chat next                                                        |
| 11       | Product SEO/structured data and share images                    | Medium      | Medium     | Basic site metadata included; per-product prerender/JSON-LD next                                                           |
| 12       | Privacy-aware funnel analytics and abandoned checkout reminders | Medium      | Medium     | Sales analytics included; consent/unsubscribe-aware marketing next                                                         |
| 13       | Gift cards and loyalty credits                                  | Medium      | High       | Later: append-only credit ledger, expiry rules and fraud controls                                                          |
| 14       | Worker-isolated model preview and multi-device saved carts      | Medium      | Medium     | STL worker included; other formats and cart sync next                                                                      |

Do not treat volume alone as price: supports, orientation, infill, failed-print allowance, finishing, machine time and design labour all matter. Keep human-reviewed quotes as the source of truth until estimation has been calibrated against real jobs.
