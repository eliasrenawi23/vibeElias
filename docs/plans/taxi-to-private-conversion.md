# Taxi → private conversion — design

_Status: designed 2026-11-26, not implemented. Owner request._

## What the owner needs

A taxi car can leave stock in two ways:

1. **Sold as a taxi** to a taxi driver, at the taxi price (example: ₪35,000). Nothing changes on the car.
2. **Converted to a private car**, then sold. The business pays the customs authority (example:
   ₪15,000), the car gets a **new plate number** (taxi plates usually end in 25/26), and it is priced at
   taxi price + customs (example: ₪50,000).

The system must keep **both plate numbers** (old taxi plate and new private plate), find the car by
either, and count the customs payment as a cost of the car.

Assumptions confirmed with the owner by silence (stated to him, not objected): the business pays
customs; conversion is one-way; customs is a cost of the car, and VAT on margin stays unchanged unless a
setting is switched on (accountant's call).

## Data model (one additive Prisma migration)

```prisma
enum PlateChangeReason { TAXI_TO_PRIVATE OTHER }

// ExpenseCategory gains: CONVERSION_TAX

model Vehicle {
  // new fields
  expectedConversionTax Decimal?  @db.Decimal(12, 2) // estimate while still a taxi
  convertedAt           DateTime? @db.Date           // set when converted to private
  plateChanges          VehiclePlateChange[]
}

model VehiclePlateChange {
  id            String            @id @default(cuid())
  vehicleId     String
  vehicle       Vehicle           @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  oldPlateNo    String
  newPlateNo    String
  changedAt     DateTime          @db.Date
  reason        PlateChangeReason
  conversionTax Decimal?          @db.Decimal(12, 2)
  expenseId     String?           @unique // the CONVERSION_TAX VehicleExpense, when tax > 0
  expense       VehicleExpense?   @relation(fields: [expenseId], references: [id], onDelete: SetNull)
  notes         String?
  createdById   String?
  createdAt     DateTime          @default(now())

  @@index([oldPlateNo])
  @@index([vehicleId, changedAt])
}

model Settings {
  vatMarginIncludesConversionTax Boolean @default(false)
}
```

- `Vehicle.plateNo` stays the single current plate (unique). `listingPrice` stays "asking price in the
  car's current state": for a taxi it is the **price as taxi**.
- **Price as private (estimate)** is never stored: `listingPrice + expectedConversionTax` while `isTaxi`.
- "Former taxi" is derived: `convertedAt != null`. The former taxi plate is the `oldPlateNo` of the
  `TAXI_TO_PRIVATE` change.
- Postgres: `ALTER TYPE "ExpenseCategory" ADD VALUE 'CONVERSION_TAX'` must be its own statement outside
  a transaction block that uses the value (Prisma generates this correctly; do not hand-merge it with
  statements that insert the new value).
- Shared package mirrors: `ExpenseCategory` (+ `CONVERSION_TAX`), new `PlateChangeReason`, and
  `EXPENSE_TO_CHARGE_KIND.CONVERSION_TAX = 'OTHER'`. The enum-mirror test must stay green.

## Rules

Conversion is allowed only when all hold; otherwise the listed error (i18n key):

| Rule | Error |
|---|---|
| Vehicle `isTaxi` | 409 `errors.vehicleNotTaxi` (exists) |
| `ownership = OWNED` | 409 `errors.vehicleNotAvailable` (exists) |
| Status `IN_STOCK` or `RESERVED` | `LEASED` → 409 `errors.vehicleLeased` (exists); others → 409 `errors.invalidTransition` |
| No open lease segment on the vehicle | 409 `errors.vehicleLeased` |
| No taxi licence registered on it (`registeredLicense` null) | 409 `errors.licenseStillRegistered` (new) |
| `newPlateNo` valid, different from the current plate | 400 field error `validation.samePlate` (new) |
| `newPlateNo` not used by any vehicle and not any vehicle's old plate | 409 field error on `newPlateNo`: `validation.duplicate` |
| `newPlateNo` is not a taxi plate (does not end in 25/26, shared `isTaxiPlate`) | 400 field error `validation.privatePlateExpected` (new) |
| `convertedAt` not in the future and not before the open cycle's start | 400 `validation.dateInFuture` (new) / `validation.outsideCycle` (new) |
| `conversionTax >= 0` | zod |

Also: creating or editing a vehicle with a `plateNo` that equals another vehicle's old plate → 409
`validation.duplicate` on `plateNo` (old plates are retired, never reused).

## API

All JSON, dates `YYYY-MM-DD`, money numbers, action endpoints return the full vehicle file (same shape
as `GET /api/vehicles/:id`).

### `POST /api/vehicles/:id/convert-to-private`

Body (shared `VehicleConvertSchema`):
`{ convertedAt, newPlateNo, conversionTax, listingPrice?, vendorId?, notes? }`

One transaction:

1. Validate the rules above.
2. Create `VehiclePlateChange { oldPlateNo: current plate, newPlateNo, changedAt: convertedAt, reason:
   TAXI_TO_PRIVATE, conversionTax, notes, createdById }`.
3. If `conversionTax > 0`: create `VehicleExpense { category: CONVERSION_TAX, amount: conversionTax,
   date: convertedAt, paidBy: US, vatIncluded: false, vatReclaimable: false, vendorId, cycleId: open
   cycle, description: "<i18n-free plain text: Taxi to private conversion, old plate → new plate>" }`
   and link it (`expenseId`).
4. Update the vehicle: `plateNo = newPlateNo`, `isTaxi = false`, `convertedAt`, `meterSerial = null`,
   `meterSealedAt = null`, `expectedConversionTax = null`, `listingPrice = body.listingPrice ??
   (listingPrice != null ? listingPrice + conversionTax : null)`.
5. Audit log entry (`action: UPDATE`, summary mentions both plates).

### `PATCH /api/vehicles/:id/conversion`

Corrects the latest `TAXI_TO_PRIVATE` change (typos happen): `{ convertedAt?, newPlateNo?,
conversionTax?, notes? }`. Re-validates plate rules; keeps the vehicle's `plateNo` and the linked
expense (amount, date; create or delete it when the tax moves from/to 0) in sync. 404 when the vehicle
was never converted. There is no revert endpoint (one-way).

### Changes to existing endpoints

- `GET /api/vehicles/:id` adds: `convertedAt`, `formerTaxi: boolean`, `formerTaxiPlateNo: string|null`,
  `expectedConversionTax`, `privatePriceEstimate: number|null` (only while `isTaxi` and both parts are
  set), `plateHistory: [{ id, oldPlateNo, newPlateNo, changedAt, reason, conversionTax, notes }]`
  (newest first), and `canConvert: { allowed: boolean, blockers: string[] }` where blockers are the
  error keys above that currently apply (so the UI can explain before the user tries).
- `GET /api/vehicles` items add: `formerTaxi`, `formerTaxiPlateNo`, `expectedConversionTax`,
  `privatePriceEstimate`. New filter `formerTaxi=true|false`. Search `q` also matches old plates
  (`plateChanges: { some: { oldPlateNo: { contains } } }`).
- Vehicle refs embedded elsewhere (deals, leases, fines: `{ id, plateNo, ... }`) add
  `formerTaxiPlateNo` where the ref is built from the vehicle row and it is cheap; deals list search `q`
  also matches old plates.
- `POST/PATCH /api/vehicles`: accept `expectedConversionTax` (only meaningful while `isTaxi`; ignore /
  null it otherwise). `isTaxi` cannot be set back to `true` on a vehicle with `convertedAt` (409
  `errors.invalidTransition`).
- `GET /api/vehicles/:id/pnl`: `costs` gains `conversionTax` (sum of the cycle's `CONVERSION_TAX`
  expenses paid by us); `costs.expenses` excludes it so `costs.total` is still the sum of its parts.
- VAT: when `Settings.vatMarginIncludesConversionTax` is true, the margin base of a MARGIN sale is
  `max(0, sale − purchase − conversionTax of the cycle)`; default false = today's behaviour. Applies in
  the deal `vat` view, deal list money, P&L and the trade book. `GET/PATCH /api/settings` expose the flag.
- Reports: trade book adds columns `formerTaxiPlateNo` (type plate) and `conversionTax` (money);
  inventory ageing `totalCost` already sums expenses (verify CONVERSION_TAX is included) and adds
  `formerTaxiPlateNo`; expenses report shows the new category automatically.
- Reminders feed and vehicle alerts: taxi-only kinds stop by themselves once `isTaxi` is false (verify
  with a test). Deal transfer checklist: `taxiLicenseDetached` no longer required after conversion.
- PDFs (`apps/api/src/pdf`): disclosure form — previous-use line says the car **was used as a taxi**
  when `isTaxi || formerTaxi`, and prints the former taxi plate; sale agreement vehicle table gains a
  "previous plate (taxi)" row when `formerTaxiPlateNo` is set. Wording in
  `apps/api/src/pdf/locales/{he,ar,en}.json` (he: `מספר רישוי קודם (מונית)`, `הרכב שימש כמונית`).
- Seed (idempotent, fix-in-place pattern): the idle taxi Skoda Octavia gets `listingPrice 35000` (only
  if null) and `expectedConversionTax 15000` (only if null); add one demo former taxi (new vehicle with
  a private plate, a `TAXI_TO_PRIVATE` plate change from a plate ending in 26, a `CONVERSION_TAX`
  expense, `convertedAt`).

## Web

- **Vehicle page**
  - Action "Convert to private" (ActionBar) on taxis; disabled with the translated blockers from
    `canConvert` (with a link to the licence page when the blocker is `licenseStillRegistered`).
  - `ConvertToPrivateDialog`: date (default today), new plate (`FormPlateField`; inline warning when it
    ends in 25/26), customs amount (prefilled from `expectedConversionTax`), new asking price
    (prefilled `listingPrice + customs`, editable), customs authority contact (optional
    `ContactPicker`), notes. Summary line: "Cost as private = taxi price + customs". After success the
    cache is updated from the response and a hint offers to upload the customs receipt (opens the
    expense's document upload).
  - Header: `ToneTag` (neutral) "Former taxi" and a fact chip "Taxi plate 84-731-26" (`PlateNo`).
  - Info tab: "Plate history" card (AntD `Timeline`: date, old → new plate, reason, customs amount,
    notes) with "Correct conversion details" (dialog → `PATCH …/conversion`).
  - P&L tab: separate "Customs (conversion)" cost line.
- **Vehicle form** (taxis only): `listingPrice` label becomes "Price as taxi"; new field "Expected
  customs if converted"; read-only "Price as private" = sum.
- **Inventory list**: under the plate, small muted "taxi: 84-731-26" for former taxis; price cell for
  taxis shows the taxi price and a second muted line "as private: ₪50,000" when an estimate exists; new
  filter "Former taxi".
- **Deal form (sale)**: when the picked vehicle is a taxi, an info alert shows both prices and says the
  car is sold **as a taxi**; a link opens the vehicle page to convert first.
- **Settings → Business**: switch "Include customs in the VAT margin base" with help text "Ask your
  accountant before turning this on".
- **Reports**: new columns get labels `reports.columns.formerTaxiPlateNo`, `reports.columns.conversionTax`.
- Locales he/ar/en (identical key sets): `enums.ExpenseCategory.CONVERSION_TAX` (he `מכס / מס הסבה
  לפרטי`, ar `جمارك / ضريبة التحويل لخصوصي`, en `Customs (taxi → private)`), `enums.PlateChangeReason.*`,
  `vehicles.convert.*`, `vehicles.plateHistory.*`, `vehicles.formerTaxi`, `vehicles.form.expectedConversionTax*`,
  `vehicles.priceAsTaxi`, `vehicles.priceAsPrivate`, the new `errors.*` / `validation.*` keys,
  `settings.business.vatMarginIncludesConversionTax*`, report column labels.
- User guides (en, he): a "Converting a taxi to a private car" section and the two selling paths.

## Tests

- API unit: conversion rule function (each blocker), listing-price default, P&L with a conversion tax
  (the owner's example: purchase 30,000 → cost as private +15,000), VAT margin with the setting off/on.
- API e2e `conversion.e2e-spec.ts`: happy path (plate swapped, `isTaxi` false, history row, expense
  linked to the open cycle, listing price 35,000 → 50,000); search by old and new plate; each rule's
  error; duplicate against another vehicle's old plate; correction endpoint keeps the expense in sync;
  P&L `conversionTax`; trade-book columns; taxi reminders gone after conversion; disclosure-form preview
  shows the former plate; cannot set `isTaxi` back.
- Web: Vitest for the dialog (prefills, sum, POST body with plate as digits, blockers shown), the plate
  history card, the taxi price cells; one Playwright flow (mocked API): open a taxi → convert → header
  shows the new plate and "Former taxi" chip → search list by the old plate.

## Implementation split

1. **API + shared schemas + migration + seed + PDFs** (Sonnet). Prisma client regeneration on Windows:
   the dev API holds the query-engine DLL — rename the locked `.dll.node` away first.
2. **Web + locales + user guides** (Haiku), against this contract with the API mocked in tests.
3. Review, integration run against the real API, full checks, one commit and push. No deploy.
