-- Hand-written migration: constraints and read models that Prisma's schema language cannot express.
-- Prisma does not model partial indexes or views. Verified with Prisma 6.19: a later
-- `prisma migrate dev` does not try to drop them. If a future Prisma version proposes
-- `DROP INDEX "ls_open_license"` / `"ls_open_vehicle"`, remove those statements from that migration.

-- ---------------------------------------------------------------------------------------------
-- Lease segments: at most one open segment (endDate IS NULL) per taxi licence and per vehicle.
-- ---------------------------------------------------------------------------------------------
CREATE UNIQUE INDEX "ls_open_license" ON "LeaseSegment"("taxiLicenseId") WHERE "endDate" IS NULL;
CREATE UNIQUE INDEX "ls_open_vehicle" ON "LeaseSegment"("vehicleId") WHERE "endDate" IS NULL AND "vehicleId" IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- driver_balance_v: one row per driver from non-voided ledger entries.
--   balance      = charged - paid - credited   (positive = the driver owes us)
--   deposit_held = DEPOSIT_IN - DEPOSIT_OUT - DEPOSIT_APPLIED (kept outside the balance)
-- ---------------------------------------------------------------------------------------------
CREATE VIEW "driver_balance_v" AS
WITH sums AS (
  SELECT
    d."id" AS "driverId",
    COALESCE(SUM(le."amount") FILTER (WHERE le."type" = 'CHARGE'), 0)          AS charged,
    COALESCE(SUM(le."amount") FILTER (WHERE le."type" = 'PAYMENT'), 0)         AS paid,
    COALESCE(SUM(le."amount") FILTER (WHERE le."type" = 'CREDIT'), 0)          AS credited,
    COALESCE(SUM(le."amount") FILTER (WHERE le."type" = 'DEPOSIT_IN'), 0)      AS deposit_in,
    COALESCE(SUM(le."amount") FILTER (WHERE le."type" = 'DEPOSIT_OUT'), 0)     AS deposit_out,
    COALESCE(SUM(le."amount") FILTER (WHERE le."type" = 'DEPOSIT_APPLIED'), 0) AS deposit_applied
  FROM "Driver" d
  LEFT JOIN "LedgerEntry" le ON le."driverId" = d."id" AND le."voidedAt" IS NULL
  GROUP BY d."id"
)
SELECT
  "driverId",
  charged::numeric(14, 2)                                    AS "charged",
  paid::numeric(14, 2)                                       AS "paid",
  credited::numeric(14, 2)                                   AS "credited",
  (charged - paid - credited)::numeric(14, 2)                AS "balance",
  (deposit_in - deposit_out - deposit_applied)::numeric(14, 2) AS "deposit_held"
FROM sums;

-- ---------------------------------------------------------------------------------------------
-- driver_ageing_v: open receivables per driver, bucketed by days past due.
--   remaining per non-voided CHARGE = amount - SUM(PaymentAllocation.amount) of non-voided payments
--   days past due = CURRENT_DATE - COALESCE(dueDate, date)
--   current: not yet due (<= 0) | d1_30 | d31_60 | d61_90 | d90_plus (> 90)
-- PaymentAllocation is the FIFO cache rebuilt by the ledger service after every mutation.
-- ---------------------------------------------------------------------------------------------
CREATE VIEW "driver_ageing_v" AS
WITH open_charges AS (
  SELECT
    c."driverId",
    (c."amount" - COALESCE((
      SELECT SUM(pa."amount")
      FROM "PaymentAllocation" pa
      JOIN "LedgerEntry" p ON p."id" = pa."paymentId" AND p."voidedAt" IS NULL
      WHERE pa."chargeId" = c."id"
    ), 0)) AS remaining,
    (CURRENT_DATE - COALESCE(c."dueDate", c."date")) AS days_past_due
  FROM "LedgerEntry" c
  WHERE c."type" = 'CHARGE' AND c."voidedAt" IS NULL
)
SELECT
  "driverId",
  COALESCE(SUM(remaining) FILTER (WHERE days_past_due <= 0), 0)::numeric(14, 2)               AS "current",
  COALESCE(SUM(remaining) FILTER (WHERE days_past_due BETWEEN 1 AND 30), 0)::numeric(14, 2)   AS "d1_30",
  COALESCE(SUM(remaining) FILTER (WHERE days_past_due BETWEEN 31 AND 60), 0)::numeric(14, 2)  AS "d31_60",
  COALESCE(SUM(remaining) FILTER (WHERE days_past_due BETWEEN 61 AND 90), 0)::numeric(14, 2)  AS "d61_90",
  COALESCE(SUM(remaining) FILTER (WHERE days_past_due > 90), 0)::numeric(14, 2)               AS "d90_plus",
  SUM(remaining)::numeric(14, 2)                                                              AS "total"
FROM open_charges
WHERE remaining > 0
GROUP BY "driverId";
