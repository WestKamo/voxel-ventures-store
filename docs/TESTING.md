# Verification evidence

Executed 28 October 2026. These results distinguish local application tests from external service verification.

| Check                                                                         | Result                                                      |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Jest + Supertest with real temporary MongoDB replica set                      | 19 passed                                                   |
| Vitest + React Testing Library / API client                                   | 7 passed                                                    |
| Playwright against production Vite build and real Express/MongoDB test server | 5 passed                                                    |
| ESLint                                                                        | Passed                                                      |
| Vite production build                                                         | Passed; optional 3D viewer chunk exceeds 500 KB before gzip |
| `npm audit --omit=dev`                                                        | 0 reported vulnerabilities at verification time             |

## Backend coverage

1. Idempotent seed, bcrypt hash, first-login password-change flag.
2. Registration field allowlisting, role injection rejection, httpOnly cookies, safe user response.
3. CSRF/origin rejection and anonymous/non-admin protection.
4. Seed admin cannot access dashboard before changing password.
5. Refresh rotation/replay handling and logout.
6. Reset token is not disclosed by API, reset invalidates access, and token is single-use.
7. Catalogue filters/detail and admin product create/archive.
8. Cart persistence, ignored client prices, server totals, stock reservation.
9. Checkout idempotency and insufficient-stock rollback.
10. Concurrent customers cannot buy the same last unit.
11. Real Stripe signing/verification code, rejected signatures/amounts, duplicate event safety and one outbox job.
12. Expired reservation returns stock exactly once.
13. Order ownership, valid fulfilment transitions, tracking and full refund.
14. Custom request ownership/messages, quote version, acceptance and quote checkout.
15. Model format rejection and integer-money rounding.
16. Blocking a user revokes access and rejects new login.
17. Model upload fails closed without storage; reviews require paid purchase.
18. Analytics separates currencies; reserved-stock product edits are rejected.
19. Unconfigured payment provider cannot create an order or reserve stock.

## Frontend coverage

Cart add/quantity/remove; accessible wishlist toggle; empty wishlist navigation; registration payload/session update; login failure; short-password validation; deduplication of concurrent refresh calls.

## Browser coverage

- Register → select product → add to bag → shipping address → server estimate → create checkout → unpaid order page.
- Seed admin login → forced password change → order status/tracking update → tracking detail.
- 390-pixel mobile viewport: no horizontal overflow, expandable navigation, catalogue route.
- Desktop home: catalogue renders and no page script errors.
- Register → custom studio → real STL Web Worker/WebGL preview → remove file → submit text-only custom idea → request detail.

The payment redirect in browser tests uses a test-only injected adapter from `e2e/server.mjs`; it does **not** simulate payment success or claim a Stripe card charge. The paid admin-order fixture is test data. No test adapter is selectable from the production server configuration.

## Environment workarounds and scope

The environment's ordinary temporary filesystem could not host MongoDB. Tests ran with `TMPDIR=/dev/shm` and Mongo's Unix socket disabled; this preserves real replica-set transactions. Browser archive downloads failed, so tests used an extracted Chromium 153 binary via PLAYWRIGHT_EXECUTABLE_PATH. That override is optional; CI installs Playwright's matching browser normally. Visual tests use reduced motion and wait for fonts/rendering to settle. The alternate Chromium launcher disables GPU compositing to avoid screenshot rasterisation artifacts in this environment; WebGL STL preview still passed.

```bash
npm ci
npm run lint
npm test
npm run build
npx playwright install --with-deps chromium
E2E_PRODUCTION=1 npm run test:e2e
```

For this execution environment only, prefix the test commands with TMPDIR=/dev/shm and provide a usable PLAYWRIGHT_EXECUTABLE_PATH for browser tests.

## Not verified here

Live Stripe checkout/refunds/webhook delivery, actual SMTP delivery, a deployed S3/ClamAV pipeline, production Atlas/hosting/DNS/cookie topology, physical print accuracy, iOS Safari/Android hardware stress, assistive-technology testing, and a complete WCAG AA audit. These require configured services or physical devices. OBJ/3MF loaders have limits and error handling but were not covered by the successful browser STL test.

The heavy model viewer remains about 935 KB minified / 255 KB gzip, plus an approximately 91 KB STL worker. It is loaded only for a model preview; home/catalogue do not preload it. The main client bundle is about 280 KB minified / 90 KB gzip. The build warning is retained rather than suppressed.
