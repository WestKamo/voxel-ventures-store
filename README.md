# Voxel Ventures Store

A rebuilt MERN storefront and custom 3D-print studio. React/Vite + Zustand + React Hook Form + Framer Motion + Three.js on the client; Express + Mongoose + Zod + bcrypt + cookie JWT authentication on the server.

**This is source code, not a claim of a live deployment.** Use a fresh MongoDB database. The legacy app is preserved in Git history. See [architecture and original-code audit](docs/ARCHITECTURE.md), [test evidence](docs/TESTING.md), and [feature checklist / limitations](docs/FEATURES.md).

## Local setup

Requirements: Node 24 LTS, npm, MongoDB replica set (Atlas works), and optional external credentials for payments, email, and uploads.

```bash
npm ci
cp .env.example .env
# Edit .env locally. Generate two independent secrets with: openssl rand -hex 32
npm run seed
npm run dev
```

Open `http://localhost:5173`. The API listens on port 5000 and Vite proxies `/api` to it. The server loads the repository-root `.env`; the browser requires no secrets. To use a direct API origin, set `VITE_API_URL` in Vercel or `client/.env.local`.

A standalone Mongo process is insufficient: checkout, quotes, payment updates, and password reset use transactions. For local Mongo, start `mongod --replSet rs0`, initiate the replica set with `mongosh`, and use the example URI. Atlas already supports transactions on replica-set clusters.

The seed creates the administrator from **ADMIN_EMAIL and ADMIN_PASSWORD only**, six conceptual sample products, three categories, three coupons, and store settings. The user-requested initial account values are present **only in `.env.example`**. Copy or override them in your private environment. Existing passwords, stock and settings are never reset by reseeding. The administrator must change the initial password on first login. Remove the seed password from the runtime environment afterward.

Sample codes: WELCOME10 (10%), STUDIO15 (15%, minimum 1000 currency units), LAYER20 (20%, minimum 2000). Seed prices are integer minor units in storage. Default tax is zero; configure your actual tax treatment before sales.

## Scripts

| Command            | Purpose                                 |
| ------------------ | --------------------------------------- |
| `npm run dev`      | API watch mode + Vite                   |
| `npm run build`    | Production client output in client/dist |
| `npm start`        | Production API                          |
| `npm run seed`     | Idempotent initial data                 |
| `npm test`         | Jest/Supertest integration + Vitest/RTL |
| `npm run test:e2e` | Playwright customer/admin/mobile flows  |
| `npm run lint`     | ESLint                                  |
| `npm run format`   | Prettier                                |

Run `npx playwright install --with-deps chromium` once before browser tests. Tests use an ephemeral replica set and test-only injected payment provider. They never require production database or payment credentials.

## Environment reference

| Variables                                              | Usage                                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| NODE_ENV, PORT, MONGODB_URI                            | Runtime and fresh database URI                                                    |
| CLIENT_URL                                             | Canonical storefront URL used in reset/payment redirects                          |
| CORS_ORIGINS                                           | Exact comma-separated allowed origins; no wildcard or trailing slash              |
| JWT_SECRET, CSRF_SECRET                                | Independent random secrets, at least 32 characters                                |
| COOKIE_SAME_SITE                                       | lax for same-site domains/proxy; none requires production HTTPS                   |
| TRUST_PROXY                                            | Trusted proxy hop count, 0 local; configure for actual hosting topology           |
| CURRENCY                                               | Initial three-letter currency; default ZAR; settings own it after seeding         |
| ADMIN_EMAIL, ADMIN_PASSWORD                            | Seed only; never sent to client                                                   |
| STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET               | Provider API key and endpoint signing secret                                      |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM | Nodemailer transport; port 465 enables implicit TLS                               |
| S3_REGION, S3_ENDPOINT, S3_BUCKET                      | Private S3-compatible storage; endpoint optional for AWS                          |
| S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY                 | Scoped server-only credentials; AWS role credentials can be used instead          |
| CLAMAV_HOST, CLAMAV_PORT                               | Private clamd TCP INSTREAM endpoint; required for model uploads                   |
| UPLOAD_MAX_MB                                          | Server upload ceiling, default 20, maximum 50; browser preview ceiling remains 20 |
| VITE_API_URL                                           | Public API base; default /api; never place secrets in VITE_ variables             |

## Payments and money

`server/src/services/payments.js` defines the provider boundary: configuration readiness, checkout, event verification, retrieve and refund. Swap the adapter to implement PayFast, Yoco, or Paystack while retaining order-service rules. Stripe Checkout is implemented; the other providers are not.

Configure a webhook at `https://YOUR_API/api/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired` and `checkout.session.async_payment_failed`. Raw request bodies and Stripe signature verification are required. A success redirect never marks an order paid. Delayed payments remain pending until verified. Refunds requested through this app are idempotent full refunds; external-dashboard refunds require reconciliation.

Prices, discounts, shipping and tax are calculated on the server in **two-decimal minor units**. ZAR is the intended currency. Zero/three-decimal currencies need an exponent-aware money adapter before use. Confirm your business is eligible for the selected payment provider; a ZAR setting does not establish merchant eligibility.

## Uploads and email

Keep the S3 bucket private with public access blocked. Restrict the app credential to its bucket/prefixes. Files use random keys; customers can request five-minute signed download URLs only for their own files. Product images use a separate public endpoint with short-lived signed redirects. Image bytes are decoded, resized and re-encoded as WebP; models pass format/size checks and clamd before storage. Never publish customer models as product model URLs. No scanner can guarantee a file is harmless; the app never executes files or server-side slicers.

Run ClamAV on a private network with updated signatures and an INSTREAM limit above the configured upload size. Missing storage/scanner configuration returns a meaningful 503; text-only custom requests still work. Email jobs are persisted and retried by the API process every 30 seconds. With no SMTP_HOST, jobs remain queued rather than pretending delivery succeeded. An always-on API instance is needed for timely email and reservation reconciliation.

## Deploy: MongoDB Atlas + Render or Railway + Vercel

1. Create a **fresh** Atlas database and least-privilege application user; allow only your backend's network access. Store its connection string as MONGODB_URI. Configure backups and test restore before accepting real orders.
2. Backend on Render: connect this repository, repository root directory, Node runtime, build command `npm ci`, start command `npm start`, health path `/health`. Set NODE_ENV=production and all required server variables. The API binds to 0.0.0.0 and the assigned PORT. Prefer an always-on instance because background work must run even without visitors. Choose CI-gated deployment after the provided checks pass.
3. Alternatively on Railway: deploy the repository as a Node service; use `npm ci` and `npm start`, set the same environment, expose the assigned PORT, and use `/health` for readiness. Keep this service running continuously. Do not put the API on a static host.
4. Run `npm run seed` once from the backend environment. Sign in and change the seed password. Configure real shipping, tax, contacts and catalogue images.
5. Vercel: import the repo with **repository root** as Root Directory, build `npm run build`, output `client/dist`, install `npm ci`. `vercel.json` includes the SPA fallback so direct product/account links work. Set VITE_API_URL to the public API URL including `/api` before building.
6. Recommended domains: storefront `shop.your-domain` and API `api.your-domain` under the same registrable domain, with COOKIE_SAME_SITE=lax and credentials-enabled CORS. Unrelated vercel.app/onrender.com domains need SameSite=None/Secure and may still fail in browsers blocking third-party cookies. Use your shared custom domain or configure a same-origin `/api/:path*` reverse proxy to the backend before the SPA fallback; then keep VITE_API_URL=/api. Do not cache authenticated API responses.
7. Set CLIENT_URL and CORS_ORIGINS to the exact storefront origin(s), configure trusted proxy hops, add the Stripe webhook, and verify HTTPS cookies, CSRF, real test-mode checkout/webhooks, emails, uploads, refund and order tracking before launch.

No database, provider account, hosting service, DNS or paid plan is automatically provisioned by this repository. The GitHub workflow validates code; hosting integration supplies deployment. Use required checks/branch protection before production merges.

## Operations

- Revoke the Razorpay credential found in the original repository; it remains compromised in history.
- Monitor `/health`, failed payment webhooks, queued email jobs, low-stock dashboard, and orders where checkoutStarted=true but stripeSessionId is absent. Those uncertain provider calls deliberately retain stock. Reconcile them with Stripe using order metadata/idempotency keys before releasing stock.
- Back up Atlas and private object storage; define a retention policy for customer designs and messages. Do not log tokens or private signed URLs.
- Start with one API process: rate limits are in-memory. Add a shared Redis-backed limiter and a dedicated worker before horizontal scaling.
- Archive products instead of deleting historical references. Refunded inventory requires a physical stock review before restocking.
- Before replacing the old database, export and map users/products/orders into the new schema in a separate migration project. This rebuild does not perform destructive live-data conversion.

Official references: [Stripe fulfilment](https://docs.stripe.com/checkout/fulfillment), [S3 presigned access](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html), [Render deployments](https://render.com/docs/deploys), [Render health checks](https://render.com/docs/health-checks), [Railway Express](https://docs.railway.com/guides/express), [Vercel rewrites](https://vercel.com/docs/routing/rewrites).
