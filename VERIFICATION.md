# Verification

This version replaces the production Django runtime with a Cloudflare Worker and D1 schema. Legacy source is retained separately.

Completed checks:

- TypeScript check and Vite production build passed; prebuilt assets are included.
- Wrangler deployment dry run passed with D1, R2 and static asset bindings.
- All three SQL migrations applied using Wrangler's local D1 engine.
- Four automated tests passed: decimal arithmetic; scheduling buffers; password hashing; an integrated API workflow.
- The API workflow exercises admin setup/login, Arabic client creation and tags, invalid mobile rejection, orders, payment creation/edit/delete, derived balances, client/order mismatch rejection, booking conflicts on create/update, resource blocks, reports, full client details, R2 report metadata and public viewer, credential-free backup export, import refusal over existing business records, rollback on a broken imported relation, successful import including staff/time logs, and logout revocation.

The integration workflow runs the actual Worker request handler against a SQLite adapter using the production migrations; R2 storage is simulated. Wrangler's development HTTP server could not start because the execution environment blocks network-interface enumeration. Live Cloudflare HTTP behavior, CPU/plan quotas, actual R2 upload delivery and the scheduled R2 backup must be checked after deploying to the user's account. No live Cloudflare deployment was performed.

Run the checks from the extracted project root:

```
npm run build
npm test
npm run check --prefix cloudflare
```

Cloud deployment:

```
npm run deploy
```

This applies D1 migrations with `--remote` and deploys the Worker. It does not start a local server. Configure the real D1 UUID and Cloudflare authorization first, as described in README.md.
