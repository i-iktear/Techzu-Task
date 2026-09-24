# POS System — HQ & Outlets

**Live**: frontend at https://frontend-production-1038.up.railway.app,
backend at https://backend-production-d680.up.railway.app (deployed on
Railway, seeded with the same demo data as `npm run seed` — two outlets,
four menu items).

A single-company, multi-outlet POS backend + a small admin/POS frontend.
HQ manages a master menu and assigns it (with optional per-outlet price
overrides) to individual outlets. Each outlet tracks its own stock and
records sales against it; HQ can pull revenue and top-seller reports across
outlets.

Architecture and scaling discussion (10 outlets / 100k tx per month,
microservices path, offline POS strategy) is in
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). The schema and ERD are in
[`docs/ERD.md`](./docs/ERD.md).

## Stack

- **Backend**: Node.js, Express, `pg` (no ORM), PostgreSQL
- **Frontend**: React (Vite), no state library, plain `fetch`
- **Infra**: Docker + docker-compose

## Project layout

```
backend/
  db/
    migrations/       plain SQL, run in order by db/migrate.js
    migrate.js
    seed.js
  src/
    routes/            express routers, one per resource
    controllers/        thin — parse req, call service, shape response
    services/           business rules (stock checks, transactions, etc.)
    repositories/        all SQL lives here
    middleware/          validate.js, errorHandler.js
    validators/          zod schemas
    db/pool.js           pg Pool + withTransaction helper
frontend/
  src/
    pages/              PosView.jsx (outlet sale screen), HqView.jsx (HQ admin)
    api.js              fetch wrapper
docs/
  ERD.md
  ARCHITECTURE.md
```

The layering is deliberately boring: routes → controllers → services →
repositories, one direction. Controllers don't touch the database directly
and services don't build SQL — repositories are the only place `pg` gets
imported outside of `db/pool.js`.

## Running locally without Docker

You need Postgres running somewhere reachable. Then:

```bash
cd backend
cp .env.example .env      # adjust if your Postgres isn't on localhost:5432
npm install
npm run migrate
npm run seed               # optional — two outlets, four menu items, some stock
npm run dev                 # http://localhost:4000
```

```bash
cd frontend
cp .env.example .env       # VITE_API_URL, defaults to http://localhost:4000/api
npm install
npm run dev                 # http://localhost:5173
```

## Running with Docker

```bash
docker compose up --build
```

This brings up Postgres, runs migrations (and seeds, since
`SEED_ON_START=true` in `docker-compose.yml`) automatically before the
backend starts serving, then starts the frontend on nginx.

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Postgres: localhost:5432 (`pos_user` / `pos_password` / `pos_db`)

> Note: this sandbox doesn't have the Docker CLI, so I couldn't run
> `docker compose up` directly. Both Dockerfiles are validated, though —
> Railway builds each service straight from these Dockerfiles for the live
> deployment above (see "Deploying to Railway" below), so the images
> themselves are confirmed to build and run correctly. What's untested is the
> `docker-compose.yml` networking/env wiring specifically, since Railway's
> deploy path doesn't go through compose. Worth a first local run before
> treating that file as load-bearing.

## Deploying to Railway

The live instance was deployed with the Railway CLI, one service per piece
(Postgres plugin, `backend`, `frontend`), each built from this repo's
existing Dockerfiles — no Railway-specific files needed:

```bash
railway login                       # opens a browser; --browserless for headless
railway init --name your-project
railway add --database postgres
railway add --service backend
railway add --service frontend

# wire backend to the Postgres plugin's own vars
railway variable set PGHOST='${{Postgres.PGHOST}}' --service backend --skip-deploys
railway variable set PGPORT='${{Postgres.PGPORT}}' --service backend --skip-deploys
railway variable set PGUSER='${{Postgres.PGUSER}}' --service backend --skip-deploys
railway variable set PGPASSWORD='${{Postgres.PGPASSWORD}}' --service backend --skip-deploys
railway variable set PGDATABASE='${{Postgres.PGDATABASE}}' --service backend --skip-deploys
railway variable set PORT=4000 --service backend --skip-deploys
railway variable set SEED_ON_START=true --service backend --skip-deploys

railway up ./backend --path-as-root --service backend --ci
railway domain --service backend      # note the URL this prints

railway variable set VITE_API_URL='https://<backend-domain>/api' --service frontend
railway up ./frontend --path-as-root --service frontend --ci
railway domain --service frontend
railway variable set PORT=80 --service frontend   # see note below
```

One gotcha that cost some time: the frontend's Dockerfile ends on
`nginx:1.27-alpine`, which listens on port 80 — but Railway's proxy didn't
know that until a `PORT=80` variable was set on the service. Railway reads
`EXPOSE` from Dockerfiles for some things, but routing to the right
container port apparently isn't one of them; without `PORT` set explicitly
the domain returned a 502 even though nginx was up and logging normally.
`VITE_API_URL` is a build-time value (baked into the JS bundle by
`vite build`, not read at runtime), so it has to be set on the frontend
service *before* `railway up` runs — setting it after just means the next
rebuild gets it right, not the running one.

## API endpoints

All under `/api`. Request/response bodies are JSON.

| Method | Path | Purpose |
|---|---|---|
| GET | `/outlets` | list outlets |
| POST | `/outlets` | create an outlet — `{ name }` |
| GET | `/menu` | HQ master menu |
| POST | `/menu` | create a master menu item — `{ name, basePrice }` |
| GET | `/outlets/:outletId/menu` | menu items assigned to this outlet, with effective price |
| POST | `/outlets/:outletId/menu` | assign a master item to this outlet — `{ menuItemId, priceOverride? }` |
| GET | `/outlets/:outletId/inventory` | current stock per item at this outlet |
| PUT | `/outlets/:outletId/inventory` | set stock for one item — `{ menuItemId, quantity }` |
| POST | `/outlets/:outletId/sales` | create a sale — `{ items: [{ menuItemId, quantity }] }` |
| GET | `/reports/revenue-by-outlet` | total revenue per outlet |
| GET | `/reports/outlets/:outletId/top-items` | top 5 selling items at an outlet |

Errors come back as `{ error: "<type>", message?, details? }` with an
appropriate status code (`400` validation/business rule violations, `404`
missing resource, `409` conflicts like insufficient stock or a duplicate
receipt number, `500` unexpected).

## How a sale actually gets processed

This is the part of the assessment with the sharpest correctness
requirements (sequential receipts, no negative stock, safe under
concurrency), so it's worth spelling out. See
[`backend/src/services/salesService.js`](./backend/src/services/salesService.js).

1. Everything runs inside one Postgres transaction (`withTransaction`).
2. Requested items are sorted by `menu_item_id` before anything is locked,
   so two sales touching overlapping items always acquire row locks in the
   same order — avoids lock-order deadlocks.
3. For each item: confirm it's actually assigned to this outlet, then
   `SELECT ... FOR UPDATE` the inventory row (blocks concurrent sales on the
   same row until this transaction commits or rolls back), check quantity,
   and only then decrement.
4. The receipt number comes from `UPDATE outlet_receipt_counters SET
   last_receipt_number = last_receipt_number + 1 ... RETURNING`, which takes
   its own row lock — concurrent sales for the same outlet serialize on that
   one row rather than both computing the same "next" number. There's also
   a `UNIQUE (outlet_id, receipt_number)` constraint on `sales` as a backstop.
5. Sale + line items are inserted, transaction commits.

I load-tested this by hand by firing 15 concurrent `POST .../sales` requests
at one outlet for the same item — receipt numbers came back 1 through 15
with no gaps or duplicates, and stock decremented by exactly 15. That's not
a substitute for a proper load test at higher concurrency, but it confirms
the locking approach does what it's supposed to at this scale.

## Things I intentionally left out

- **Auth.** Not in the requirements list, and bolting on a token scheme just
  to have one felt like scope creep for what this assessment is actually
  checking. `docs/ARCHITECTURE.md` doesn't cover it either since it wasn't
  asked for, but any real deployment needs it before outlet staff or HQ
  users touch this directly.
- **Delete / deactivate** for menu items, outlets, or assignments. Not
  specified, so no delete endpoints and no soft-delete flags in the schema.
- **Pagination** on list endpoints. At the data volumes this assessment
  targets it doesn't matter yet; see the scaling doc for where it would
  start to.
