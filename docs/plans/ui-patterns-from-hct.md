# UI patterns from HCT — port plan

_Status: proposed, 2026-11-10. Nothing here is implemented yet._

## Context

We reviewed the HCT dashboard frontend (`C:\Users\elias.renawi\Documents\namal\hct\hctfe`: React 19,
MUI v7, Emotion, MUI X DataGrid, exceljs) for design patterns we could reuse in `apps/web`
(React + Vite + **Ant Design v6**, he/ar/en with RTL, light/dark).

HCT is a different stack and brand (yellow `#FBC847`, Heebo, dense 12px desktop-only UI), so we **do not**
take its tokens, theme, font or components. We take **UX patterns** and re-build them with AntD and our
`--rm-*` brand tokens. Several of them fill known gaps in our app, and several fit the unfinished
Milestone 5 (reminders, dashboard, reports, export).

Decisions made by Elias:
- Order: **foundation pass on existing pages first, then finish Milestone 5** with the HCT patterns in
  its briefs.
- Include all four extras: status summary cards on lists, lifecycle stepper on detail pages, remembered
  list filters, reminders bell in the top bar.

## Ground rules for every phase

- AntD v6 components + `--rm-*` tokens only. No MUI, Emotion or new styling libraries.
- Colours come from `packages/brand/tokens.ts` (regenerate `tokens.css` with `npm run build:tokens`);
  never hard-code hex values or AntD preset colour names in feature code.
- Every new string gets keys in `packages/shared/src/locales/{he,ar,en}/common.json` (the key-parity
  test must pass). No hard-coded English.
- Works in RTL and LTR, light and dark, and at phone width (switch at `Grid.useBreakpoint().md`, like the
  existing shared components).
- Colour is never the only signal: tags and cards always carry text (and an icon where useful).
- Keep focus outlines (HCT removes them globally; we don't).
- `docs/brand/style-guide.md` stays the source of truth: update §6 (components) when a pattern lands.
- Existing conventions stay: lists `{ items, total, page, pageSize }`, i18n error keys, API agent owns
  `apps/api` + additive `packages/shared/src/schemas`, web agent owns `apps/web` + locales, no commits by
  agents.

## What we already have (reuse, do not rebuild)

| Area | Ours | HCT equivalent we skip |
|---|---|---|
| Tokens, dark mode | `packages/brand/tokens.ts`, `apps/web/src/app/providers/UiProvider.tsx` | `src/styles/theme.ts`, `colors.ts` values |
| RTL / bidi | ConfigProvider `direction`, `apps/web/src/shared/lib/bidi.tsx` | Emotion RTL cache, `ltr()` helper |
| Lists | `shared/ui/DataTable.tsx`, `shared/ui/FilterBar.tsx`, `shared/lib/listParams.ts` | DataGrid wrapper |
| Errors / toasts | router `errorElement` → `app/pages/RouteErrorPage.tsx`, AntD `App.useApp()` | ErrorBoundary, Redux snackbar queue |
| Phones | mobile drawer, card lists, `ActionBar` | (HCT has no mobile support) |
| PDFs | Milestone 6: server-side Playwright | html2canvas + jsPDF screenshots |

---

## Phase A — Foundation pass (existing pages)

### A1. One status-colour registry
_HCT source: `src/styles/colors.ts` lines 44–56 (light-bg / dark-text families), `src/styles/statusColors.ts`._

Problem today: `apps/web/src/shared/ui/StatusTag.tsx` maps colours by value only (so `PENDING` or
`CANCELLED` get one colour whatever the enum), and 8+ feature maps / inline presets disagree.

Build:
- `apps/web/src/shared/lib/statusTones.ts`: tones `success | info | warning | error | neutral | accent |
  license | purple`, and a registry typed as `Record<EnumValue, Tone>` **per enum**, so a missing value
  is a type error.
- Tokens: `accent` uses the existing primary-soft roles, `license` the existing license roles, `neutral`
  the grey Tag roles; add one new `purple` family (text/bg/border, light + dark) in `tokens.ts`.
- CSS classes `.rm-tone-<tone>` in `apps/web/src/styles/global.css`.
- `StatusTag` reads the registry by `enumName` + value; new `ToneTag` for non-enum labels.
- Replace the scattered colours: `VehicleDetailPage.tsx:313`, `VehicleInventoryTab.tsx:137`,
  `DealPaymentsTab.tsx:62`, `CyclesTimeline.tsx:51`, `VehiclePnlTab.tsx:99`, `steps.tsx:185,277`,
  `VehicleExpensesTab.tsx:26`; merge `vehicles/components/AlertBadges.tsx` into `shared/ui/AlertTags.tsx`.

Proposed mapping (Elias to confirm before build):

| Enum | Mapping |
|---|---|
| DriverStatus | ACTIVE success · INACTIVE neutral · BLACKLISTED error |
| VehicleStatus | IN_STOCK info · RESERVED warning · LEASED accent · SOLD neutral · RETURNED purple · SCRAPPED neutral · EXTERNAL neutral |
| TaxiLicenseStatus | ACTIVE success · SUSPENDED error · TRANSFER_PENDING warning · SOLD neutral |
| LeaseStatus | DRAFT neutral · ACTIVE success · ENDED neutral · TERMINATED error |
| DealStatus | DRAFT neutral · PENDING warning · COMPLETED success · CANCELLED neutral |
| TransferStatus | NOT_STARTED neutral · IN_PROGRESS info · DONE success |
| FineStatus | NEW warning · REASSIGN_SUBMITTED info · REASSIGNED success · PAID_BY_US purple · CANCELLED neutral |
| CycleKind | OWNED accent · CONSIGNED purple (ends the magenta/purple clash) |
| Direction (payments) | IN success · OUT warning |
| ReminderSeverity | overdue error · soon warning · upcoming info |

### A2. Shared detail-page layout + breadcrumbs
_HCT source: `src/pages/VisitPage/VisitPage.tsx` + `styles.ts`, `src/components/Breadcrumbs/Breadcrumbs.tsx`._

Problem today: "back to list" link copied 7 times, header actions done 3 ways (`ActionBar`,
`vehicles/components/VehicleActions.tsx` own copy, raw buttons), skeleton copy-pasted ~10 times,
`Descriptions` column settings vary.

Build in `apps/web/src/shared/ui/`:
- `PageBreadcrumbs.tsx`: AntD `Breadcrumb`, Home → section list (uses remembered filters, see B3) →
  record. Replaces every back link, including on `/new` pages.
- `DetailPageLayout.tsx`: props `breadcrumbs`, `title`, `subtitle`, `tags` (status tags at the end of the
  title row), `actions` (always through `ActionBar`, so they collapse on phones), `lifecycle` slot (B1),
  `facts` slot, `tabs` (keeps the existing `?tab=` sync and `destroyOnHidden`), `loading`, `error`
  (`LoadError`), optional `readOnlyReason` banner (only where the page already disables editing; no new
  business rules).
- `FactChips.tsx`: row of key facts (icon tile on primary-soft + label + value), e.g. plate, driver,
  monthly rent, balance.
- `DetailSkeleton.tsx`: the one loading skeleton.
- `DESCRIPTION_COLUMNS = { xs: 1, sm: 2, lg: 3 }` constant used by every `Descriptions`.
- Fold `VehicleActions` phone dropdown into `ActionBar`.

Migrate: `features/{vehicles,taxi-licenses,drivers,leases,deals,contacts}/pages/*DetailPage.tsx`, and the
matching `*NewPage.tsx` back links.

### A3. Unsaved-changes guard
_HCT source: `src/components/common/UnsavedChangesPrompt/UnsavedChangesPrompt.tsx`, `Drawer.tsx`
`checkDirty`._

- `apps/web/src/shared/form/useUnsavedChangesGuard.ts`: react-router `useBlocker` (we use
  `createBrowserRouter`, `app/router.tsx:152`, so it works) + `beforeunload`; prompt through
  `ConfirmDialog`. Off after a successful submit.
- `shared/ui/FormDialog.tsx`: closing with `isDirty` asks to discard.
- Use the guard on full-page forms: vehicle/driver/licence/contact new + detail edit forms, lease wizard,
  deal new page, settings/business.

### A4. Date fields accept several typed/pasted formats
_HCT source: `src/components/common/DatePicker/DatePicker.tsx` (paste-parses 6 formats)._

- `apps/web/src/shared/lib/dates.ts`: `DATE_INPUT_FORMATS = ['DD/MM/YYYY', 'D/M/YYYY', 'DD.MM.YYYY',
  'D.M.YYYY', 'DD-MM-YYYY', 'DDMMYYYY', 'YYYY-MM-DD']` (first one is the display format).
- Pass the array as AntD `format` in `FormDateField.tsx`, the `FilterBar` date range, and the matching
  date-time list in `FormDateTimeField.tsx`.

---

## Phase B — Extras on existing pages

### B1. Lifecycle stepper on detail pages
_HCT source: `src/components/common/StatusFlow/StatusFlow.tsx`._

- `apps/web/src/shared/ui/LifecycleSteps.tsx` on top of AntD `Steps` (`size="small"`): done / current /
  pending; a terminal "off-path" status (TERMINATED, CANCELLED) shows as an error step that replaces the
  remaining steps. Current step gets a soft pulse via CSS, disabled under `prefers-reduced-motion`.
  Vertical or inline layout below `md`.
- `apps/web/src/shared/lib/lifecycles.ts`:
  - Lease: DRAFT → ACTIVE → ENDED (off-path TERMINATED)
  - Deal: DRAFT → PENDING → COMPLETED (off-path CANCELLED)
  - Deal transfer: NOT_STARTED → IN_PROGRESS → DONE
  - Fine (in `FineDrawer`): NEW → REASSIGN_SUBMITTED → REASSIGNED, or NEW → PAID_BY_US (off-path CANCELLED)
- Not for vehicles or licences: their statuses are not a linear lifecycle (leased cars return to stock),
  so they keep the status tag only.

### B2. Status summary cards on lists (quick filters)
_HCT source: `src/components/common/SummaryCard/SummaryCard.tsx`, used on `VesselVisitsPage`._

- API (additive): `GET /api/{vehicles,leases,deals,fines}/summary` → `{ counts: Record<Status, number> }`,
  honouring the list's current filters **except** status (so each card shows what clicking it gives).
  Shared `StatusSummarySchema` in `packages/shared/src/schemas`. e2e test per endpoint.
- Web: `apps/web/src/shared/ui/StatusSummaryCards.tsx`: row of cards (tone bar on the inline-start edge,
  count, label) above the `FilterBar`. Click toggles the `status` URL param; active card is highlighted.
  Cards are buttons with `aria-pressed`; horizontal scroll on phones.

### B3. Remember list filters within a section
_HCT source: `src/hooks/useListState.ts`, `src/utils/listState.ts`._

- `apps/web/src/shared/lib/listMemory.ts`: each list page saves its `location.search` per section in
  `sessionStorage` (wrapped in try/catch). Only non-default values are saved.
- Restored when returning to the list through the breadcrumb or the sidebar item. Browser back already
  works through the URL.
- Cleared when the user moves to a different top-level section (HCT behaviour) or presses "Clear
  filters", so stale filters never surprise.
- `FilterBar` "Clear filters" shows only when something differs from defaults.

### B4. Timeline styling (small)
_HCT source: `src/pages/TruckVisitPage/pages/TruckVisitTimeline/styles.ts`._

- Restyle `CyclesTimeline` with AntD `Timeline` + tone dots from A1: time/date column, event and
  "by whom" line, done / current / pending states.

---

## Phase C — Milestone 5 with HCT patterns

These go into the M5 agent briefs (reminders feed, dashboard, reports, settings) on top of the existing
M5 scope in the main plan.

### C1. Reminders bell in the top bar
_HCT source: `src/components/Notifications/Notifications.tsx`._

- `apps/web/src/features/reminders/components/RemindersBell.tsx` in `app/layout/TopBar.tsx` (before
  `LangMenu`). Badge = overdue + soon count from the reminders feed.
- Popover on desktop, Drawer on phones: per-item icon + tone by `FeedKind` / `ReminderSeverity`, title,
  due date, link to the record (`FeedEntityType` → route), and only the actions the M5 API supports
  (e.g. mark a manual reminder done). "See all" → `/reminders`.
- React Query polling (e.g. every 5 minutes) + refetch on window focus.

### C2. Dashboard grammar
_HCT source: `src/pages/DashboardPage/components/KpiCard.tsx`, `SectionCard.tsx`, `WaterSideTab.tsx`
header._

- `features/dashboard/components/KpiCard.tsx` gains `info` (tooltip saying what the number means),
  `trend` (up/down/flat in tones), `sub` (why a value is missing; show "—", never a fake 0).
- KPI grid `repeat(auto-fit, minmax(200px, 1fr))`.
- Section cards = existing `shared/charts/ChartCard` (icon + title + `extra` slot).
- Dashboard header: "Last updated HH:mm" + refresh button.
- Also closes the known gaps: wire `DashboardChartsSchema` and the missing KPI fields, fix the
  "expiring soon" card that renders nothing when it has data, add the missing `charts.*` locale keys and
  `.rm-chart-*` CSS. Charts follow the `dataviz` skill.

### C3. Period filter with presets
_HCT source: `src/pages/DashboardPage/components/PeriodFilter.tsx`, `DashboardFiltersBar.tsx`._

- `FilterBar` `dateRange` gets a `presets` option (AntD `RangePicker presets`): this month, last month,
  year to date, last year, last 30 days. Computed in the business time zone (Asia/Jerusalem).
- Active preset is derived from the dates (a hand-edited range just loses the highlight).
- Selections that drop out of the options are cleared; the filter bar stays visible in empty and error
  states. Used by reports and the dashboard.

### C4. Report export rules (API, exceljs — already in `apps/api/package.json`)
_HCT source: `src/utils/excel.ts`, `src/pages/DashboardPage/utils/exportToExcel.ts`._

- Shared helper under `apps/api/src/reports/` for XLSX + CSV:
  - First sheet "Report context": report name, exported at (Asia/Jerusalem), period, every active filter,
    column definitions, all in the user's language.
  - Data sheet: right-to-left sheet view for he/ar; translated headers; types from shared
    `ReportColumnType` (money as `₪ #,##0.00` numbers, dates as real dates, enums translated).
  - Missing values written as translated "n/a", never 0.
  - Sheet names sanitised (≤ 31 chars, no `[]*?/\:`); empty sheets get a "no data" note row.
  - Filename `renawi-<report>-YYYY-MM-DD.xlsx`; CSV with UTF-8 BOM so Excel shows Hebrew/Arabic.
- e2e test parses the exported file with exceljs (context sheet present, RTL view for he, "n/a" cells).

---

## Not taking from HCT

- Its theme values, Heebo font and 10–12px density (too small for phone use).
- Button variant names with swapped meaning; global focus-outline removal; hard-coded English strings;
  yellow text/icons on white.
- `MasterDataTable` (we have little master data; revisit if settings grows lookup lists).
- OPS TV screen, html2canvas/jsPDF PDFs, Redux list state (we keep state in the URL).
- Note: the docs in `hctfe\claude\` describe a different app (QuayCrew) and were ignored.

## Follow-ups found during the scan (not HCT patterns)

- `FinesTable` has no sort and a different prop shape from `DealsTable`.
- `taxi-licenses/components/LicensePnlTab.tsx:76` uses a raw AntD `Table` (no phone card view).
- `theme-color` in `apps/web/index.html:6` and `vite.config.ts:79` is yellow; tokens and the style guide
  say ink `#0F0F10`.
- Style guide vs code: table header background (grey-100 vs grey-50), card borders, Arabic line-height.
- Two theme switchers (`ThemeToggle` and the `UserMenu` sub-menu).

## Execution order and delegation

1. **Phase A**: one web agent (Opus). A1 first (other pieces use the tones), then A2–A4.
2. **Phase B**: API agent (Opus) builds the B2 summary endpoints while the web agent does B1, B3, B4,
   then the B2 cards.
3. **Phase C**: re-spawn the two M5 agents (API + web) with their existing briefs plus C1–C4; they finish
   the M5 work-in-progress that is already committed.
4. Fable reviews each phase, does integration, and runs the checks below. Commit and push only when Elias
   asks.

## Verification (each phase)

- `npm run typecheck`, `npm run lint`, `npm test` (shared, API unit, web unit), `npm run test:e2e`, the
  web Playwright specs, and `npm run build`.
- New unit tests: tone registry covers every enum value; every `DATE_INPUT_FORMATS` entry parses to the
  same ISO date; `listMemory` save/restore/clear; `LifecycleSteps` state mapping incl. off-path;
  `StatusSummaryCards` toggles the URL param; unsaved-changes guard blocks and releases.
- API e2e: summary endpoints honour filters except status; XLSX export structure.
- Locale key-parity test passes.
- Live browser check (API on 3002, web on 5174): he, ar, en × light, dark × desktop and 375px wide, on
  each migrated detail page, breadcrumbs, summary cards, bell popover, dirty-form prompt, date typing.
