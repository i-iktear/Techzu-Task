# Architecture Notes

See [ERD.md](./ERD.md) for the schema. This document covers the parts of the
assessment that aren't really about the current implementation — scaling,
microservices, and offline POS — since the code as it stands is a single
Postgres-backed monolith and doesn't need to pretend otherwise.

## 1. Scaling to 10 outlets / 100k transactions per month

First, some perspective: 100k transactions/month across 10 outlets is
roughly 330 sales/day/outlet, or about 14/hour if it were spread evenly. It
isn't spread evenly — lunch and dinner windows will carry most of it, so the
real number to design for is closer to 60-100 sales/hour/outlet during peak,
maybe 2-3 per minute per outlet with occasional bursts. That's a modest load.
A single, properly indexed Postgres instance on decent hardware handles this
without strain — the current schema and query patterns wouldn't need to
change for correctness. What *would* need attention is a handful of specific
pressure points:

**Reporting queries competing with the sales path.** `revenueByOutlet()` and
`topSellingItems()` both aggregate over `sales`/`sale_items` directly. At low
volume this is fine; once `sale_items` has a few million rows and someone
refreshes the HQ dashboard during lunch rush, that aggregation query can
start contending with the row locks the sale-transaction path takes on
`inventory` and `outlet_receipt_counters`. The fix isn't a bigger database,
it's not running analytical queries against the OLTP tables at all:
- Add a rollup table (`outlet_daily_sales(outlet_id, sale_date, item_id,
  quantity, revenue)`) updated as part of the same transaction that inserts a
  sale, or on a short lag via a queue. Reports read from the rollup, which is
  orders of magnitude smaller than the raw line-item table.
- Alternatively, point reporting at a read replica. Simpler to introduce,
  but only fixes contention, not the fact that a full aggregate scan over a
  growing `sale_items` table gets slower every month regardless of which
  replica runs it.
- I'd do both eventually — replica for isolation, rollup table because raw
  aggregation doesn't scale linearly with retention.

**Table growth and retention.** At 100k/month, `sale_items` is on the order
of 200-400k rows/month depending on basket size. That's not large in
absolute terms, but if the assessment window extends to multi-year
retention, partitioning `sales`/`sale_items` by month (native Postgres
declarative partitioning) keeps indexes small and lets old partitions be
archived or dropped cheaply instead of doing `DELETE` sweeps against a live
table.

**Database connections.** Once there's more than one backend instance (see
below), each with its own `pg.Pool`, connection count to Postgres adds up
fast. `pgbouncer` in transaction-pooling mode in front of Postgres is the
standard fix and is cheap to add — it doesn't change how the app talks to
the database, just what's sitting between them.

**Infrastructure.** The backend is already stateless — all state is in
Postgres — so horizontal scaling is just running more copies behind a load
balancer; no session affinity or sticky routing needed. A managed Postgres
(RDS / Cloud SQL / similar) buys automated backups and point-in-time
recovery, which matters a lot more once there's real transaction history to
lose. A cache (Redis) in front of the outlet-menu endpoint is worth adding
early since menu reads vastly outnumber menu writes and the data changes
rarely — that's a cheap win independent of scale.

**Where I would *not* start:** sharding the database, or splitting into
microservices, purely because of this transaction volume. 100k/month is not
a volume that stresses a single Postgres instance. The architectural changes
below are worth doing for reasons other than raw throughput — team
boundaries, independent deploy cadence, different read/write shapes — and
I'd wait until one of those reasons actually shows up rather than building
for it speculatively.

## 2. Path to microservices

If this system did grow past a single team/single deploy cadence, the
natural seams are the ones that already show up as separate concerns in the
current codebase's service layer:

- **Catalog service** — master menu items and outlet-menu assignment
  (`menu_items`, `outlet_menu_items`). Read-heavy, low write volume, easy to
  cache, safe to be eventually consistent from the outlet's point of view
  (an outlet doesn't need the millisecond-fresh version of a price change).
  Good first candidate to split off because getting it wrong is low-stakes.

- **Outlet operations service** (sales + inventory together). This is the
  one place I'd deliberately *not* split further, even though "inventory"
  and "sales" sound like two services on paper. The whole point of the
  current transaction — lock stock, check quantity, decrement, generate the
  receipt number — is that it's one atomic unit. Split sales and inventory
  into separate services and that atomicity becomes a distributed
  transaction or a saga with compensating actions, which is a lot of
  complexity to take on for a boundary that doesn't correspond to how the
  business actually uses these two things. Keep them together, owned by one
  service, one database.

- **Reporting/analytics service** — consumes sale data rather than owning
  it. This is the clearest case for event-driven decoupling: outlet
  operations emits a `SaleCompleted` event (transactional outbox table +
  a relay, or a broker like RabbitMQ/Kafka if the volume justifies it) after
  a sale commits, and reporting builds its own read-optimized store off that
  stream. This also solves the reporting-vs-OLTP contention problem from
  section 1 as a side effect, and it means reporting can be down or slow
  without touching the sales path at all.

- **HQ/outlet identity and assignment** could live inside Catalog rather than
  as its own service — outlets themselves don't generate enough operations to
  justify a separate service, they're mostly reference data that Catalog and
  Outlet Operations both need to look up.

The order I'd actually do this in: pull Reporting out first (lowest risk,
clearest win, doesn't touch the transactional core), then Catalog, and leave
Outlet Operations as the monolith's core for as long as possible.

## 3. Offline POS mode

Two different problems get bundled under "offline mode" and they need
different answers:

**POS talking to KDS at the outlet.** This should never depend on the
internet connection at all. POS and KDS sit on the same local network at the
outlet; routing that link through HQ's cloud backend just because "that's
where the sales API lives" would make a kitchen printer's uptime depend on
an ISP three buildings away, which is a bad trade for no benefit. The fix is
architectural, not a fallback: POS pushes new orders to KDS over the LAN
directly — a small local broker/queue, or the POS terminal exposing a local
endpoint the KDS app subscribes to — completely independent of whatever the
POS-to-HQ sync state is. An outlet should be able to run POS + KDS
indefinitely with the WAN link unplugged; syncing to HQ is a background
concern layered on top, not a dependency of taking and firing orders.

**POS talking to HQ when the outlet itself loses internet.** Here the POS
terminal needs a local store (SQLite is the obvious choice for an embedded
POS app) holding: the outlet's assigned menu with current prices, the last
known stock snapshot, and an outbox of sales that happened locally but
haven't reached HQ yet. Sales get created against this local store exactly
like the online path — check stock, decrement, record the line items — the
only thing that changes is *where* that transaction runs.

The part that actually needs a real decision, not just "cache it locally":
**receipt numbering**. The current design generates a strictly sequential
per-outlet number by locking a counter row in Postgres — that requires
talking to the central database, which is exactly what's unavailable
offline. Two honest options:

1. Give each terminal a pre-leased block of numbers while it's still online
   ("terminal 2 owns 500-599"), and it draws from that block offline. Stays
   strictly sequential and centrally coordinated, but a terminal that
   exhausts its block while still offline is stuck — needs a large enough
   lease to make that rare, which just moves the problem rather than solving
   it.
2. Number offline sales locally as `outlet_id-terminal_id-local_seq`
   (something like `OUT2-T1-00042`) and let that be the receipt the customer
   sees. On reconnect, these sync to HQ and get folded into the outlet's
   canonical sequence for reporting, but the customer-facing number was
   never blocked on connectivity.

I'd pick option 2. A perfectly gap-free global sequence and offline
availability are in tension — you can't have a centrally-coordinated counter
keep working when the center is unreachable — and for a retail receipt
number, "unique and traceable" matters more than "no visible gaps," so I'd
give up strict sequencing during outages rather than give up the ability to
sell.

**Sync itself**: background worker on the terminal retries the outbox with
backoff once connectivity returns. Each locally-created sale carries a
client-generated UUID, and the HQ endpoint upserts on that UUID
(`ON CONFLICT (client_sale_id) DO NOTHING`) so a retried sync after a
half-completed request doesn't double-count the sale.

**Stock going negative across terminals during an outage**: if two offline
terminals at the same outlet both sell the last unit of something because
neither could see the other's decrement, that's a real oversell, and there's
no way to prevent it without a live shared lock — which is the thing that's
unavailable. The practical answer is to let it happen and reconcile after the
fact: HQ recomputes stock from all synced sales as authoritative, and
surfaces oversells as a flag for the outlet manager rather than rejecting a
sale that already happened at the counter. You can't un-sell a sandwich
after the fact just because the database says you should have run out five
minutes earlier.
