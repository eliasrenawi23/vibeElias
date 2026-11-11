# Milestone 5 — status and API contract (as of 2026-11-11)

_Handoff note for the next working session. Source: the API agent's final report._

## Backend status

Done and smoke-tested (`apps/api/test/milestone5.e2e-spec.ts`, 10 tests):

- `GET /api/reminders/feed`, manual reminders (create, done, undone, list, delete, get)
- `GET /api/dashboard/kpis` (new fields), `/activity`, `/charts`
- All 7 reports in json, csv and xlsx

Written but not tested: `PATCH /api/reminders/:id`; in exports the "n/a" cell, numeric money cells, Hebrew
text, context-sheet content, totals row, "no data" row; trade-book rows for a completed sale; feed kinds
other than `vehicleRegistration` and `manual`.

Not started: `GET /api/settings/backup-status` (`BACKUP_STATUS_FILE` and `BackupStatusSchema` exist), seed
examples per severity, unit specs for the pure functions in `reminders/feed-rules.ts`,
`reports/report-export.ts`, `reports/report-rules.ts`, `dashboard/activity.ts`. The full e2e suite has not
been run with the new spec included (expected 170).

## Response shapes (follow the shared schemas)

- **Feed**: `{ items, total, page, pageSize, counts: { overdue, due, upcoming } }`. Severity values are
  `overdue | due | upcoming` (shared `FeedSeverity`; not "soon"). Item:
  `{ id: "<kind>:<entityId>", kind, entityType, entityId, title, subtitle, dueAt, daysLeft, severity, link }`.
  Query: `days`, `kinds=a,b`, `severity`, `page`, `pageSize`. 16 kinds in shared `FeedKind`.
- **Manual reminder**: shared `ReminderSchema`
  `{ id, title, dueAt, entityType ('VEHICLE'…), entityId, notes, doneAt, createdAt, link }`; paginated list.
- **KPIs**: previous fields plus `expiring: { overdue, due }`, `finesOpen`, `receivablesOverdue`.
- **Activity**: array of shared `ActivityItem`
  `{ id, at, userName, entity, entityId, action, summary, label, changes, link }` (summary is English).
- **Charts**: shared `DashboardChartsSchema`.
- **Reports**: shared `ReportResult`
  `{ report, params, columns: [{ key, label, type, enum? }], rows, totals?, summary? }`. Column types:
  `text | money | int | date | datetime | bool | enum | plate`. Names: `profit`, `inventory-ageing`,
  `receivables`, `expenses`, `lease-income`, `trade-book`, `fines`; `?format=json|csv|xlsx&lang=he|ar|en`.
  Inventory ageing returns `summary.buckets`. Exports are attachments named `renawi-<report>-YYYY-MM-DD.*`.

## Locale keys the exports read (web agent must add to he/ar/en)

`reports.names.{profit,inventoryAgeing,receivables,expenses,leaseIncome,tradeBook,fines}`,
`reports.context.{sheetName,report,exportedAt,period,asOf,language,rows,column,type}`,
`reports.params.{groupBy,status}`, `reports.groupBy.{month,quarter,year,category,vehicle,license,driver}`,
`reports.columnTypes.{text,money,int,date,datetime,bool,enum,plate}`, `reports.na`, `reports.noData`,
`reports.total`, `reports.bool.{true,false}`, and `reports.columns.*` for: period, salesRevenue,
purchaseCost, expenses, vatOnMargin, commission, leaseIncome, profit, plateNo, vehicle, ownership, status,
purchaseDate, purchasePrice, totalCost, listingPrice, daysInStock, ageBucket, driver, phone, contractNo,
balance, depositHeld, current, d1_30, d31_60, d61_90, d90_plus, overdue, category, count, amount, paidByUs,
vatReclaimable, netCost, licenseNo, rentCharged, otherCharges, credits, net, paymentsReceived, consignment,
sellerName, sellerIdNumber, repairsTotal, saleDate, buyerName, buyerIdNumber, salePrice, fineNo, offenceAt,
receivedAt, authority, reassignDeadline, rebilled. Web-only: `reminders.kinds.<16 FeedKind values>`,
`reminders.severity.{overdue,due,upcoming}`.

## Remaining work, in order

1. API: backup-status endpoint, seed examples, missing unit and e2e tests, full e2e run.
2. Web Phase B (`docs/plans/ui-patterns-from-hct.md`): lifecycle stepper, status summary cards (API ready;
   deals route is `deals/summary`; list `status` filters are multi-select `status=A,B`), remembered list
   filters, timeline restyle.
3. Web milestone 5 with Phase C: dashboard rework (KPI grammar, charts per the dataviz skill), reminders
   bell in the top bar, reminders page, report pages with period presets and export buttons, settings pages
   (lead days, default lease terms, backup status), and the locale keys above.
4. Milestone 6 (PDFs), then milestone 7 (production).
