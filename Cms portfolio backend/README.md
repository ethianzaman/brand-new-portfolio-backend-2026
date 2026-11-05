# Portfolio CMS API

REST API behind a portfolio site and its admin dashboard. It stores the site's content, handles sign-in and role-based permissions, runs the contact inbox, and tells the frontend when content changes.

**Stack:** Node.js 22, Express, TypeScript, MongoDB (Mongoose), Cloudinary, Resend or Gmail, Vitest.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:5000
```

On first start, the account in `ADMIN_EMAIL` and `ADMIN_PASSWORD` is created as the Super Admin.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start with reload |
| `npm run build` / `npm start` | Compile to `dist/`, then run it |
| `npm test` | API tests on an in-memory MongoDB |
| `npm run lint` / `npm run typecheck` | Static checks |
| `npm run reset-password` | Recover a locked-out Super Admin from the server |
| `npm run migrate:*` / `npm run backfill:*` | One-time data migrations |

## How the code is organised

```
src/
  index.ts        Starts the server: database, first admin, shutdown
  app.ts          The Express app: middleware and routes, no side effects
  routes/         URL, then who may call it, then which controller
  controllers/    Reads the request, calls a service, sends the response
  services/       Business rules and database work. Knows nothing about HTTP
  models/         Mongoose schemas
  middleware/     Auth, permissions, uploads, rate limits, caching
  lib/            Outside systems and shared infrastructure
  utils/          Small pure helpers
  scripts/        Run by hand: password reset and migrations/
tests/
  api/            Tests that call the real routes
  support/        In-memory database, fake Cloudinary, helpers
```

A request moves in one direction: **route → controller → service → model**.

- **Controllers stay thin.** Each one is wrapped in `handle()` from `lib/http.ts`, so it only describes success.
- **Services report failure by throwing.** `throw notFound("Project not found")` becomes a 404. Unexpected errors are logged and never reach the client.
- **Every write ends with `publishChange(tag)`.** It clears the cache, revalidates the frontend's page and notifies open tabs over SSE.

## Adding a resource

1. `models/Thing.ts`: the schema.
2. `services/thing.service.ts`: the rules, throwing `badRequest` or `notFound`.
3. `controllers/thing.controller.ts`: one `handle()` per endpoint.
4. `routes/thing.routes.ts`: paths, with `protect` and `requirePermission("thing.edit")`.
5. Mount it in `app.ts`, and add the permission section in `lib/permissions.ts`.
6. Add the calls to `tests/api/contract.test.ts`.

## Testing

`tests/api/contract.test.ts` sends real requests to nearly every endpoint and pins the status and body in a snapshot, because that is what the frontend depends on. A snapshot diff means the API changed: fix the code, or if the change is intended, run `npx vitest -u` and update the frontend too.

Tests never read `.env`, so they cannot reach the real database, Cloudinary, mail provider or frontend.

## Security

- Sessions are JWTs in `httpOnly`, `sameSite=strict` cookies, and a token version revokes them on logout or password change.
- Roles run from Super Admin down to Editor, with per-section permissions a Super Admin can edit.
- Login, password change and the contact form are rate limited.
- Helmet and a CORS allow-list are on, MongoDB operators are rejected in input, and file uploads are checked by type and size.
- Uploaded files are deleted from Cloudinary only after the replacement is saved, and only if nothing else uses them.

## Deployment

Set the variables from `.env.example`, then run `npm ci && npm run build && npm start`. `dist/` is not committed, so the host must build.

- `JWT_SECRET` is required in production; the server refuses to start without it.
- `FRONTEND_URL` lists the allowed origins. `REVALIDATE_SECRET` must match the frontend's.
- Set `TRUST_PROXY` to the number of proxies in front of the server, so rate limits see the real client IP.
- Deploy together with the frontend when the API changes.
