# SMART SHOOTS — Cloudflare only

The React app and API are served by one Cloudflare Worker. D1 stores business data; a private R2 bucket stores files and daily JSON backups. No Django server, PC, tunnel, Docker, or local database is required to run this version. Use the same HTTPS URL on your computer and phone. The supplied `frontend/dist` is also prebuilt.

## Deploy entirely in the cloud (no local process)

1. Upload this package's contents to a GitHub repository. Keep `frontend`, `cloudflare`, `package.json`, and `.github` at the repository root.
2. In Cloudflare, create a D1 database named **smartshoots**. Copy its database UUID. Create a **private** R2 bucket named **smartshoots-files**. Enable R2 in your account if needed.
3. In Workers & Pages, create/import a **Worker** named **smartshoots** from that Git repository. Choose the repository root as the build directory. Use Node 22 or newer.
4. Set the build command to **`npm run build`** and the deploy command to **`npm run deploy`**. In build variables set **`D1_DATABASE_ID`** to the actual UUID. Optional: `R2_BUCKET_NAME` if you used a different bucket name. Cloudflare's build integration must have permission to deploy Workers, apply D1 migrations, and use the R2 bucket. Migrations are applied to the remote D1 database before deployment.
5. After deployment, in the Worker's Settings → Variables and Secrets, add **`BOOTSTRAP_TOKEN`** as a secret. Use a random secret of at least 32 characters. Apply the updated settings/deployment.
6. Open **`https://YOUR-WORKER.workers.dev/setup.html`**. Enter that setup secret and choose your admin username and password (at least 12 characters). Then open `/login` and sign in. Remove `BOOTSTRAP_TOKEN` from Worker secrets after successful setup. Setup also remains locked in D1.
7. Open `/api/health/` to verify the live database connection. Save a test client, order, and payment; reopen the app on another device and verify those records.

Do not use Cloudflare Pages for this package: the deploy target is **Workers with Static Assets**. Do not deploy the old fix package's frontend-only Wrangler file. This package uses `cloudflare/wrangler.jsonc` for the frontend, API, D1, R2 and daily backup schedule together.

If the Cloudflare dashboard offers only a Wrangler deploy command, use **`npm run deploy`**, not `wrangler deploy` at the repository root.

## Alternative: GitHub Actions

The included workflow builds, tests, migrates remote D1 and deploys whenever you push `main`, or via Run workflow. Set repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; set repository variable `D1_DATABASE_ID`. Optional variable: `R2_BUCKET_NAME`. Scope the API token to your account with Workers Scripts edit, Workers assets deployment, D1 edit and R2 edit permissions required by the current Wrangler deployment. Create D1 and R2 first. Set the bootstrap secret in Cloudflare after deployment, then use `/setup.html`.

## Move your existing data

- The uploaded project contains source code, not your live PC database. Existing records do not automatically appear in D1.
- Use a **previously exported** SMART SHOOTS JSON backup, then Settings → Restore in the cloud app. If you have no backup, exporting it from the old app is a one-time migration task; the new app does not need the old app afterward.
- Import is atomic and accepts only an empty business database. It never overwrites the cloud admin account. All records in an invalid import are rolled back.
- Staff records are mapped to disabled cloud login accounts; an administrator must set their names, new passwords and activation through `/api/accounts/users/`. Old passwords are never imported.
- Legacy backup commands exclude toolkit reports/scripts and file bytes. Reupload local attachments/report drafts to R2. The import response lists skipped file metadata. Other business records retain their IDs and relations.
- Atomic imports are limited to 500 SQL statements and 10 MB; larger backups need a reviewed migration in batches. Do not split related data through repeated UI restores: restores require an empty database.
- Daily JSON snapshots are saved in R2 at `backups/YYYY-MM-DD.json`. Files remain in `uploads/`. JSON snapshots do not contain binary files or login credentials. Keep the bucket and database; deleting cloud resources destroys access to their data.

## What changed

- Same-origin `/api` replaces saved LAN/localhost addresses. Browser Settings shows the cloud URL and QR code.
- Token login, salted PBKDF2 password hashes, expiring hashed sessions, logout revocation and login rate limiting.
- Clients/tags/staff/evaluations, packages/orders/assignments/deliveries/time logs, appointments/resources/blocks, payments/expenses/categories/settings, attachments, report drafts/scripts/service profiles, notifications and reports use D1-backed endpoints.
- Payments derive order balances. Payment edits, moves and deletions update the ledger atomically. Client/order mismatch and payments above the order total are rejected. Creating an order does not turn a manually entered paid amount into a payment; record a real payment separately.
- Scheduling checks shared resources and buffers in database triggers. Appointments without selected resources reserve the default Studio resource. Independent explicitly selected resources may run in parallel.
- R2 uploads are private by default. Report draft token links are public intentionally. Shareable attachments use their token; other attachments require login. HTML uploads run inside a sandbox rather than having access to your app session.
- Arabic/English UI remains. The assistant provides a live business summary; it is not a general AI chat model. No external AI provider is required.
- Network failures do not silently queue orders or payments as if saved. Cached reads remain available; saving requires a confirmed response from Cloudflare. Legacy pending local queues are not automatically submitted to the new cloud database.
- Starter packages and expense categories are created at setup. Verify your package prices before using them: Learning 250 EGP/hour; Reels and Outdoor start at 0 so you must enter your actual rates before an order can be saved. Packages are editable through `/api/production/packages/`.

## Verification and practical limits

`npm run build` builds the frontend and installs the Worker tooling; `npm test` runs decimal/password tests and end-to-end API workflows with the production SQL migrations against SQLite. `npm run check --prefix cloudflare` checks the Worker bundle and static assets without publishing. No emulator or local server is started by the cloud deployment scripts.

D1 request limits and Worker CPU budgets depend on your Cloudflare plan. The implementation batches relation reads, but large imports/backups can exceed Free invocation limits; a paid Workers plan may be necessary. Check deployed logs and the live cross-device workflow before relying on production data. Scheduled snapshots must also be verified in your own R2 bucket. The Wrangler development HTTP server could not start in this restricted environment; production HTTP execution and account-specific limits still need live verification. SQL migrations did apply successfully through Wrangler’s local D1 engine.

This archive has been built and tested in the editing environment. It has **not** been deployed to your Cloudflare account: no account credentials or database UUID were supplied.

The old Django and desktop/Android launch files are under `legacy-reference/` for reference only. They are not used by this cloud build. Existing desktop/Android executables do not automatically acquire this rewrite; use the cloud website/PWA on all devices.

## Official Cloudflare references

- Workers Git builds: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Static asset routing: https://developers.cloudflare.com/workers/static-assets/binding/
- D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
