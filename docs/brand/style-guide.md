# Renawi Motors brand style guide

Version 0.1 (November 2026). Source files live in `packages/brand`; open
`packages/brand/brand-preview.html` in a browser to see everything in this guide rendered,
in light and dark, left-to-right and right-to-left.

> **Decided (November 2026):** the logo is concept **B (Roof sign)**. Concept **A (Road R)**
> stays in the package as an alternative and for illustration. Everything else in this guide
> (colour, type, UI rules) is the same for both. See [The chosen concept](#11-the-chosen-concept).

## 1. Brand story

Renawi Motors runs two businesses from one yard: a taxi station that owns taxi licences, the
"green numbers", and leases them to drivers, alone or with a car, and a used-car dealership
that buys, sells, trades in and consigns cars. Drivers and buyers deal with the same family and
the same office, in Hebrew, Arabic or English. The brand has to feel like one dependable local
business that knows cars and paperwork, not like a marketplace or an importer.

The look comes straight from the street. An Israeli taxi is a white car with a yellow roof sign
and a yellow plate with black digits, so the brand is white, taxi yellow and black: flat,
geometric, no gradients or effects. Green appears only where taxi licences do, after the green
plates that gave the "green number" its name. Rubik carries the name in all three scripts with
the same shapes and weight, so a Hebrew contract, an Arabic receipt and the English app header
look like they come from the same place.

## 2. Logo

### 2.1 Parts

- **Icon mark**: script-neutral, never mirrored, works on its own (app icon, favicon, stamp).
- **Wordmark**: Renawi Motors / רינאוי מוטורס / ريناوي موتورز, set in Rubik at weight 650 and
  converted to vector outlines (no live text, no font needed). Latin is uppercase with +45/1000
  letter-spacing; Hebrew +20/1000; **Arabic is never letter-spaced** (it breaks the joins).
- **Spelling**: the owner's spelling is **רינאוי** in Hebrew (yod after the resh) and
  **ريناوي** in Arabic (ya after the ra), in the logo, the app, documents and signage alike; not
  the older רנאוי / رناوي. "Motors" is מוטורס / موتورز.
- **Lockups**: icon + wordmark in English, Hebrew and Arabic. The icon always sits on the
  **leading side**: left of English, right of Hebrew and Arabic. The wordmark's cap height lines
  up with the icon: concept A centres the cap band on the tile; concept B aligns it with the R
  inside the roof sign. Hebrew and Arabic are sized to the same optical size as the Latin.

### 2.2 Concepts

|             | B. Roof sign (**the logo**)                                                                                                                      | A. Road R (alternative)                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Mark        | The yellow taxi roof sign on its roof line, with the R where the sign's lettering would be.                                                      | Rounded black tile, yellow geometric R. A dashed centre line runs up the stem and round the bowl: the R is a road. |
| On dark     | Yellow sign, R cut out, white roof (the white taxi body).                                                                                        | Inverse: yellow tile, black R.                                                                                     |
| Small sizes | The R is small inside the full sign, so app icons put the sign on a black tile and `favicon.svg` is a simplified sign with a larger R (see 2.3). | Strong; at favicon size keep the R and drop the road line.                                                         |
| Says        | "Taxi": strongest for the taxi side.                                                                                                             | "Motors": covers both businesses.                                                                                  |

### 2.3 Files

All in `packages/brand/logo/`. `x` is `b` (the logo) everywhere; the `a-` files are kept as
an alternative and for illustration. Do not mix the two concepts on one page or document.

| File                          | Use it for                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `x-icon.svg`                  | The mark on light backgrounds; avatar, app header when space is tight.               |
| `x-icon-inverse.svg`          | The mark on dark backgrounds.                                                        |
| `x-icon-mono.svg`             | One colour (`currentColor`): stamps, fax, embossing, watermark, single-colour print. |
| `x-horizontal-{en,he,ar}.svg` | Default lockup on light backgrounds: documents, PDFs, emails, website.               |
| `x-on-dark-{en,he,ar}.svg`    | Lockup on dark backgrounds: the app's side navigation, dark mode, signage on black.  |
| `x-stacked-{en,he,ar}.svg`    | Narrow or square spaces: login screen, splash, social avatar card, vehicle sticker.  |
| `favicon.svg`                 | Browser tab icon: concept B simplified for 16 px (see below).                        |
| `../icons/*.png`              | PWA and home-screen icons (192, 512, Apple touch 180, maskable 512): B on the tile.  |

`favicon.svg` is not the full mark scaled down: the roof sign is taller and narrower so it fills
the square, it sits directly on a bold black roof line (no feet, no thin strokes), and the R is
about twice as tall as in the full mark scaled to the same width, with its top and bottom on the
16 px pixel grid. It reads at 16 px on light and dark browser tabs.

Pick the lockup that matches the **language of the page or document**, not the user's name or
the customer: a Hebrew contract gets `x-horizontal-he.svg`, an Arabic one `x-horizontal-ar.svg`.

The lockup SVGs set `color` on the root and paint the wordmark with `currentColor`, so when you
inline one you can recolour the wordmark with CSS `color` (ink or white only). The icon colours
are fixed.

### 2.4 Clear space and minimum size

- **Clear space**: keep a margin of **¼ of the icon height** free on every side of any lockup
  (16 px around a 64 px-high lockup). Nothing else (text, edges, other logos) enters it.
- **Minimum sizes (screen)**: horizontal lockup 28 px high (B; 24 px for A); stacked lockup
  64 px high; `b-icon.svg` 28 px high (about 50 px wide). Below that, and in browser tabs, use
  `favicon.svg` (16 px and up).
- **Minimum sizes (print)**: horizontal lockup 25 mm wide; icon 6 mm.

### 2.5 Do not

- Put white text, or a white R, on yellow (1.6:1, unreadable).
- Recolour the mark, add outlines, shadows, gradients or glows.
- Stretch, rotate, or re-set the wordmark in another font or weight.
- **Mirror the icon in right-to-left layouts.** The R is a letter; only its position changes.
- Letter-space, justify or stretch the Arabic wordmark with tatweel (ـ).
- Put the lockup on a busy photo without the tile or a solid panel behind it.
- Use the yellow-on-white B sign smaller than 28 px high without the black tile.

## 3. Colour

### 3.1 Brand colours

| Name           | Hex                              | Role                                                                                                               |
| -------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Taxi yellow    | `#F5C518`                        | Primary fills: primary button, selected navigation item, active page, checkbox, the logo. **Never text on white.** |
| Yellow on dark | `#E8BD30`                        | The primary colour in the dark theme (slightly desaturated so it doesn't glare on near-black).                     |
| Ink            | `#0F0F10`                        | Text, the logo tile, the navigation chrome, text on yellow.                                                        |
| Graphite       | `#2A2A2E`                        | Secondary chrome, tooltips, dark panels.                                                                           |
| White          | `#FFFFFF`                        | Surfaces; the taxi body.                                                                                           |
| Licence green  | `#0B6E4F` (dark theme `#3CCB94`) | **Taxi licences only**: the licence tag, licence column, licence page header.                                      |

Scales (same in both themes): yellow 50 to 900 (`--rm-yellow-*`) and neutral grey 0 to 950
(`--rm-grey-*`, cool greys that end in graphite and ink). See `tokens.css`.

### 3.2 Semantic roles

Use roles, not raw hex values: `var(--rm-color-…)` in CSS, `colors[mode].…` in TypeScript,
AntD tokens via `antdTheme(mode)`.

| Role                           | Light                 | Dark                  | Use                                                                        |
| ------------------------------ | --------------------- | --------------------- | -------------------------------------------------------------------------- |
| `bg-layout`                    | `#F7F7F8`             | `#0F0F10`             | Page background.                                                           |
| `bg-container`                 | `#FFFFFF`             | `#17171A`             | Cards, tables, inputs.                                                     |
| `bg-elevated`                  | `#FFFFFF`             | `#1F1F23`             | Popovers, menus, modals.                                                   |
| `bg-sunken`                    | `#F0F0F2`             | `#0A0A0B`             | Table headers, read-only fields.                                           |
| `text`                         | `#0F0F10`             | `#EDEDEF`             | Body text and headings.                                                    |
| `text-secondary`               | `#52525B`             | `#A6A6AE`             | Labels, table headers, help text.                                          |
| `text-tertiary`                | `#71717A`             | `#8E8E96`             | Placeholders, timestamps.                                                  |
| `text-disabled`                | `#A1A1AA`             | `#5E5E66`             | Disabled controls only.                                                    |
| `border` / `divider`           | `#D4D4D8` / `#E4E4E7` | `#2E2E33` / `#26262B` | Control borders / hairlines between rows and sections.                     |
| `primary`                      | `#F5C518`             | `#E8BD30`             | Primary fills.                                                             |
| `on-primary`                   | `#0F0F10`             | `#0F0F10`             | Text and icons on yellow. Always ink.                                      |
| `primary-soft`                 | `#FEF3C8`             | yellow at 14%         | Selected rows and menu items.                                              |
| `primary-text`                 | `#8A6500`             | `#E8BD30`             | The rare case where text must be "yellow" (AntD `colorPrimaryText`).       |
| `link` / `info`                | `#1D5FD1`             | `#6EA8FE`             | Links and informational status.                                            |
| `success`                      | `#2E7D32`             | `#52C48C`             | Paid, active, done.                                                        |
| `warning`                      | `#B54708`             | `#F2994A`             | Expiring soon, partial. Orange, so it never competes with brand yellow.    |
| `error`                        | `#C8281C`             | `#F47067`             | Overdue, failed, destructive actions.                                      |
| `license`                      | `#0B6E4F`             | `#3CCB94`             | Taxi-licence entities only.                                                |
| `on-status`                    | `#FFFFFF`             | `#0F0F10`             | Text on solid success/warning/error/licence fills (danger button, badges). |
| `chrome-bg`                    | `#0F0F10`             | `#0A0A0B`             | Side navigation (and the mobile top bar).                                  |
| `chrome-selected-bg` / `-text` | `#F5C518` / `#0F0F10` | `#E8BD30` / `#0F0F10` | Selected navigation item.                                                  |

Each status colour also has `-bg` and `-border` roles for soft tags and alerts.

### 3.3 Rules

- **Yellow is a fill, not a text colour.** On white it is 1.63:1; text on it is always ink
  (11.75:1).
- **One yellow action per view.** The primary button is the thing to do next. Everything else
  is default (white with a border), text or link.
- **Yellow never carries a state on its own** in the light theme: focus is an ink border plus a
  yellow glow; the selected tab is marked with an ink bar; the active page number is bold.
- **Green means licence.** Status "OK/paid/active" uses `success`, a different green with an
  explicit label. Never use licence green for money or status.
- Status is never colour alone: tags carry a word, alerts carry an icon and a sentence.

### 3.4 Contrast (WCAG 2.2)

Computed from the tokens by `npm run build:tokens -- --contrast`; the build **fails** if any
required pair drops below its threshold (4.5:1 for text, 3:1 for focus indicators). Translucent
backgrounds are composited over the card colour before measuring.

| Pair                                          | Light                | Dark                 |
| --------------------------------------------- | -------------------- | -------------------- |
| Body text on card                             | 19.16:1 AAA          | 15.30:1 AAA          |
| Body text on page background                  | 17.89:1 AAA          | 16.39:1 AAA          |
| Secondary text on card                        | 7.73:1 AAA           | 7.40:1 AAA           |
| Secondary text on table header                | 6.79:1 AA            | 8.19:1 AAA           |
| Placeholder / tertiary text on card           | 4.83:1 AA            | 5.50:1 AA            |
| **Ink text on yellow (primary button)**       | **11.75:1 AAA**      | **10.72:1 AAA**      |
| Text on selected row / menu item              | 17.21:1 AAA          | 11.52:1 AAA          |
| Primary-coloured text on card                 | 5.33:1 AA            | 10.01:1 AAA          |
| Link on card                                  | 5.82:1 AA            | 7.41:1 AAA           |
| Success text on card / on success tag         | 5.13 / 4.67:1 AA     | 8.21 / 6.41:1        |
| Warning text on card / on warning tag         | 5.43 / 4.86:1 AA     | 8.03 / 6.30:1        |
| Error text on card / on error tag             | 5.56 / 4.86:1 AA     | 6.27 / 5.15:1        |
| Licence green on card / on licence tag        | 6.25 / 5.52:1 AA     | 8.66 / 6.73:1        |
| Text on danger button (white light, ink dark) | 5.56:1 AA            | 6.71:1 AA            |
| Text on success / warning / licence fill      | 5.13 / 5.43 / 6.25:1 | 8.79 / 8.60 / 9.27:1 |
| Navigation text / secondary on chrome         | 16.39 / 7.93:1       | 16.93 / 8.19:1       |
| Selected navigation item (ink on yellow)      | 11.75:1 AAA          | 10.72:1 AAA          |
| Focus border vs card (ink light, yellow dark) | 19.16:1              | 10.01:1              |
| Yellow fill vs white card (decorative only)   | 1.63:1               | 10.01:1              |
| **White on yellow: never**                    | **1.63:1**           |                      |

Known gap: control borders (`#D4D4D8`, 1.5:1 on white) are lighter than the 3:1 that WCAG
1.4.11 asks for when the border alone identifies a field. Fields always have a visible label
above them; if the owner finds fields hard to spot, raise `colorBorder` for `Input`/`Select` to
`#8E8E96` (3.25:1).

## 4. Typography

### 4.1 Typeface

**Rubik** (SIL Open Font License 1.1), variable weight 300 to 900. It is the only free family
with native Latin, Hebrew and Arabic in one design, so all three languages share proportions,
weight and rhythm. It has tabular figures (`tnum`), used for every number in a column.

```
'Rubik Variable', 'Rubik', 'Noto Sans Hebrew', 'Noto Sans Arabic', 'Noto Sans',
system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif
```

- **Web app**: self-host with `@fontsource-variable/rubik` (family name `Rubik Variable`); no
  Google Fonts request at runtime.
- **PDFs**: embed `packages/brand/fonts/Rubik[wght].ttf` (licence in `fonts/OFL.txt`).
- `brand-preview.html` loads Rubik from Google Fonts only because it has no build step.

### 4.2 Scale

| Token     | Size / line height | Weight | Use                                               |
| --------- | ------------------ | ------ | ------------------------------------------------- |
| `display` | 40 / 48            | 700    | Login and splash only.                            |
| `h1`      | 32 / 40            | 700    | Page title (one per page).                        |
| `h2`      | 24 / 32            | 600    | Section titles, KPI values.                       |
| `h3`      | 20 / 28            | 600    | Card titles, drawer titles.                       |
| `h4`      | 16 / 24            | 600    | Sub-sections, table group headers.                |
| `body-lg` | 16 / 26            | 400    | Long text, contracts on screen, phone forms.      |
| `body`    | 14 / 22            | 400    | Default UI text (AntD `fontSize`).                |
| `small`   | 12 / 18            | 400    | Help text, timestamps, table meta.                |
| `caption` | 11 / 16            | 500    | Overlines and tiny labels (Latin uppercase only). |

Weights in the UI: 400 text, 500 buttons and labels, 600 headings and emphasis, 700 page titles.
CSS variables: `--rm-text-{name}-size`, `--rm-text-{name}-line-height`, `--rm-text-{name}-weight`.

### 4.3 Script notes

- Hebrew and Arabic have no capitals: never `text-transform: uppercase` on them; use weight.
- No italics for Hebrew or Arabic; emphasise with weight 600.
- Arabic letters sit smaller on the body than Latin at the same size; keep line height at 1.5
  or more for Arabic text, and use `body-lg` for Arabic paragraphs longer than a few lines.
- Numbers: `font-variant-numeric: tabular-nums` (`.rm-tabular`) for amounts, plates, dates,
  counters and anything in a table column.

## 5. Right-to-left and mixed-script rules

1. **Set direction at the root.** `<html lang="he|ar|en" dir="rtl|ltr">` changes with the
   language; AntD `ConfigProvider direction` follows. Never hard-code `left`/`right`: use logical
   properties (`margin-inline-start`, `padding-inline`, `inset-inline-end`, `text-align: start`,
   `border-inline-start`).
2. **Latin digits everywhere**, in all three languages: format with `he-IL`, `ar-IL-u-nu-latn`
   and `en-IL` (never Arabic-Indic digits).
3. **Isolate left-to-right tokens** inside Hebrew/Arabic text: plates (`12-345-67`), VINs,
   phones, ID numbers, amounts, numeric dates, emails. In HTML wrap them in
   `<bdi dir="ltr">` or use `.rm-ltr` (`direction: ltr; unicode-bidi: isolate; white-space:
nowrap`). They never wrap and never reorder. In PDFs and CSV use LRI (U+2066) … PDI
   (U+2069).
4. **Strip U+200E / U+200F** from `Intl` output before exporting or comparing: Node/ICU returns
   `"‏1,234.50 ‏₪"` for `he-IL`. Keep the locale's symbol position: `₪1,234.50` in
   English, `1,234.50 ₪` in Hebrew and Arabic, always inside an LTR isolate. A minus sign stays
   with the number.
5. **Free text**: `dir="auto"` on inputs, textareas and blocks of user-written text (notes,
   addresses). In **table cells** wrap names and notes in `<bdi>` instead, so the cell keeps the
   UI's alignment while the text gets its own direction.
6. **Mirror only directional icons**: back/forward arrows, chevrons, "next/previous",
   breadcrumb separators, send, list indent, progress bars and steppers. Do **not**
   mirror the logo, check marks, plus/minus, search, phone, clock, media play, the car or taxi
   icons, or anything that depicts a real object.
7. **Logos follow the language**, not the direction alone: `x-horizontal-he.svg` in Hebrew,
   `x-horizontal-ar.svg` in Arabic, icon on the right; the icon itself is never flipped.
8. Charts keep Latin digits and LTR-isolated amounts; pick one time-axis direction for all
   charts and keep it.

## 6. Components and tone

The interface is calm and dense enough for office work, but every control is usable with a
thumb on a phone. Flat surfaces, hairline dividers, 8 px corners, shadows only on things that
float.

- **Buttons**
  - Primary: yellow fill, ink text, weight 500, no shadow. One per view.
  - Default: white (dark: card colour) with a border; hover darkens the border to ink.
  - Danger: red fill; white text in light, ink text in dark. Destructive actions in money
    (void, delete draft) also ask for confirmation.
  - Link: blue text, for navigation only.
  - Heights 28 / 36 / 44 px; use 44 px for the main action on phone screens.
  - Do **not** use AntD `color="primary"` with the `outlined`, `dashed`, `text` or `link`
    variants in the light theme: they would paint yellow text on white.
- **Tags and tones**: soft background, coloured text, 1 px border, 6 px corners, always a word
  (alerts add a warning icon). The colour comes from a **tone**, never from the feature code:
  `apps/web/src/shared/lib/statusTones.ts` maps every value of every coloured enum to one of
  eight tones (a missing value is a type error), painted by the `.rm-tone-<tone>` classes.
  Enum values use `StatusTag` (`enumName` + value, so `CANCELLED` can differ per enum), other
  labels `ToneTag`, alert codes `AlertTags`. Plain AntD `Tag` colours (`color="green"`) and hex
  values are not used in feature code.

  | Tone      | Tokens (text / bg / border)                        | Meaning                                 |
  | --------- | -------------------------------------------------- | --------------------------------------- |
  | `success` | `success` / `-bg` / `-border`                      | Done, active, paid                      |
  | `info`    | `info` / `-bg` / `-border`                         | In progress, informational              |
  | `warning` | `warning` / `-bg` / `-border`                      | Needs attention soon, partial           |
  | `error`   | `error` / `-bg` / `-border`                        | Overdue, blocked, terminated            |
  | `neutral` | `neutral` / `-bg` / `-border` (grey tag)           | Ended, sold, cancelled, archived, other |
  | `accent`  | `primary-text` / `primary-soft` / `primary-border` | Ours: leased cars, owned cycles         |
  | `license` | `license` / `-bg` / `-border`                      | Taxi-licence entities only              |
  | `purple`  | `purple` / `-bg` / `-border`                       | Consignment, returned cars, paid by us  |

  Purple is `#6B3FA0` on `#F4EEFB` (6.49:1) in light and `#B79CF2` on its 14 % tint (6.05:1)
  in dark; never for money. Status mapping (owner-confirmed): vehicles IN_STOCK info,
  RESERVED warning, LEASED accent, RETURNED purple, SOLD / SCRAPPED / EXTERNAL neutral; leases
  and deals DRAFT neutral, ACTIVE / COMPLETED success, PENDING warning, TERMINATED error,
  ENDED / CANCELLED neutral; fines NEW warning, REASSIGN_SUBMITTED info, REASSIGNED success,
  PAID_BY_US purple; cycles OWNED accent, CONSIGNED purple; payments IN success, OUT warning.

- **Tables**: header on `bg-sunken`, `text-secondary` at weight 500, no vertical split lines;
  hairline row dividers; hover `grey-50`; selected row `yellow-50` (hover `yellow-100`).
  Numbers end-aligned and tabular; plates and amounts in LTR isolates; actions at the end of the
  row. On phones, tables become cards (one card per row) below the `md` breakpoint.
- **Forms**: label above the field, help text below in `small`. Field border `border`, hover
  `grey-500`; **focus: ink border plus a 3 px yellow glow** (dark: yellow border plus glow).
  Errors: red border and a sentence under the field.
- **Navigation**: ink side navigation (`chrome-bg`), items in `chrome-text-secondary`, the
  current item a yellow pill with ink text, the on-dark lockup at the top. Top bar is
  `bg-container`. On phones the side navigation becomes a drawer from the leading side.
- **Tabs**: ink underline in light, yellow underline in dark; selected label in `text`.
- **Elevation**: cards use a hairline border and at most `--rm-shadow-sm`; dropdowns
  `--rm-shadow-md`; modals and drawers `--rm-shadow-lg`.
- **Radius**: 4 (xs), 6 (tags, small controls), **8 (default)**, 12 (cards, modals), 16, pill.
- **Spacing**: 4 px grid (`--rm-space-1` = 4 px … `--rm-space-16` = 64 px). Card padding 20 to
  24 px; gaps between cards 16 px.
- **Detail pages** (`DetailPageLayout`): breadcrumbs, then the title row (record name as
  `<h2>`, status / type / alert tags at its end, header actions on the trailing side), an
  optional read-only banner, the lifecycle stepper, the key facts, then tabs synced with
  `?tab=` (hidden tabs unmount). Loading shows the one `DetailSkeleton`; errors show
  `LoadError`; both keep the breadcrumbs so the way back is always there.
- **Breadcrumbs** (`PageBreadcrumbs`): Home icon (with a hidden label), section list, record or
  "New …"; the current page is plain text with `aria-current="page"`. They replace every "back
  to the list" link, also on `/new` pages.
- **Header actions** (`ActionBar`): buttons from `md` up, one "More" menu on phones; at most one
  primary action (the thing to do next), destructive ones red.
- **Key facts** (`FactChips`): a definition list under the title, each fact an icon tile on
  `primary-soft`, a `text-secondary` label and the value; two per row on phones.
- **Label / value grids** (AntD `Descriptions`): columns from `descriptionColumns.ts` only:
  `DESCRIPTION_COLUMNS` (1 / 2 / 3 at xs / sm / lg), `_NARROW` (1 / 2, half-width cards and
  dialogs), `_SINGLE` (money breakdowns and drawers).
- **Unsaved changes**: full-page forms use `useUnsavedChangesGuard` (in-app navigation, tab
  close or reload, and the form's own Cancel ask "Discard unsaved changes?"); dialogs pass
  `dirty` to `FormDialog`, which asks before closing. The prompt is `ConfirmDialog` with a red
  "Discard" and a default "Keep editing". A successful save never asks.
- **Dates**: pickers show `DD/MM/YYYY` (date-time `DD/MM/YYYY HH:mm`, 24 h) and accept typed or
  pasted `D/M/YYYY`, `DD.MM.YYYY`, `D.M.YYYY`, `DD-MM-YYYY`, `DDMMYYYY` and `YYYY-MM-DD`
  (`DATE_INPUT_FORMATS` in `shared/lib/dates.ts`). Digits stay Latin in every language.
- **Theme switch**: one control, the sun / moon button in the top bar.
- **Words**: short and concrete ("Record payment", "Driver balance"), numbers first, the same
  term for the same thing in all three languages.

## 7. Light and dark

- The app **follows the system** by default; the user's choice (light / dark / system) is saved.
  Apply it as `<html data-theme="light|dark">`; `tokens.css` handles all three cases, and AntD
  gets `antdTheme(mode)` plus `theme.darkAlgorithm` or `theme.defaultAlgorithm`.
- Dark theme: near-black layers (`#0F0F10` page, `#17171A` cards, `#1F1F23` popovers),
  desaturated yellow `#E8BD30`, lightened status colours, ink text on every yellow or status
  fill, slightly stronger shadows with a faint light edge.
- Logos in dark mode: `x-on-dark-*.svg` and `x-icon-inverse.svg`. The side navigation is dark
  in both themes, so it always uses the on-dark lockup.
- Printed documents and PDFs are always light.
- `<meta name="theme-color" content="#0F0F10">` (also `pwa.themeColor` in `tokens.ts`).

## 8. Using the tokens

CSS (variables are prefixed `--rm-`):

```css
@import '@renawi/brand/tokens.css';

.amount {
  font-variant-numeric: var(--rm-font-numeric);
  color: var(--rm-color-text);
}
```

Ant Design v6:

```tsx
import { ConfigProvider, theme } from 'antd';
import { antdTheme } from '@renawi/brand/tokens';

<ConfigProvider
  direction={dir}
  theme={{
    ...antdTheme(mode), // { token, components }
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
  }}
>
  {children}
</ConfigProvider>;
```

`tokens.ts` also exports `brand`, `palette`, `colors`, `licenseAccent`, `typography`,
`fontFamily`, `space`, `radius`, `shadows`, `motion`, `control`, `pwa`, `lightTokens`,
`darkTokens` and `antdComponents`. It has no runtime dependency; the AntD objects type-check
against AntD 6.7 `ThemeConfig`.

PWA manifest icons:

```json
[
  { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
  {
    "src": "/icons/maskable-512.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "maskable"
  }
]
```

## 9. Files in `packages/brand`

| Path                                                                                 | Made by        | What                                                                                       |
| ------------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------ |
| `package.json`                                                                       | hand           | `@renawi/brand`; exports `./tokens.css`, `./tokens`, `./logo/*`, `./icons/*`, `./fonts/*`. |
| `logo/a-icon.svg`, `a-icon-inverse.svg`, `a-icon-mono.svg`                           | hand           | Concept A mark.                                                                            |
| `logo/b-icon.svg`, `b-icon-inverse.svg`, `b-icon-mono.svg`                           | hand           | Concept B mark.                                                                            |
| `logo/favicon.svg`                                                                   | hand           | Small-size concept B mark (simplified roof sign, larger R).                                |
| `logo/{a,b}-{horizontal,stacked,on-dark}-{en,he,ar}.svg`                             | `build:logos`  | 18 lockups; wordmarks as outlines.                                                         |
| `icons/icon-192.png`, `icon-512.png`, `apple-touch-icon-180.png`, `maskable-512.png` | `build:icons`  | App icons (concept B by default; `--concept a` for A).                                     |
| `fonts/Rubik[wght].ttf`, `fonts/OFL.txt`                                             | downloaded     | Rubik variable font from google/fonts and its licence.                                     |
| `tokens.ts`                                                                          | hand           | Source of truth for all tokens and the AntD theme.                                         |
| `tokens.css`, `tokens.js`                                                            | `build:tokens` | CSS variables; JS build of `tokens.ts`.                                                    |
| `brand-preview.html`                                                                 | hand           | Preview page (concept switch, light/dark, LTR/RTL).                                        |
| `scripts/build-logos.mjs`                                                            | hand           | Shapes the wordmarks (HarfBuzz) and outlines them (opentype.js).                           |
| `scripts/build-icons.mjs`                                                            | hand           | Renders the PNG icons with sharp.                                                          |
| `scripts/build-tokens.mjs`                                                           | hand           | Writes `tokens.css`/`tokens.js` and checks contrast.                                       |
| `scripts/verify.mjs`                                                                 | hand           | Checks SVGs, icons, preview references, theme parity, exports.                             |

## 10. Regenerating

From `packages/brand` (or with `-w packages/brand` from the repo root):

```sh
npm run build:logos    # lockups from the hand-written marks + Rubik
npm run build:icons    # PNG icons, concept B (add -- --concept a for concept A)
npm run build:tokens   # tokens.css + tokens.js; add -- --contrast for the contrast table
npm run verify         # sanity checks
```

To change a colour, edit `tokens.ts` and run `build:tokens`; never edit `tokens.css` or
`tokens.js` by hand. To change a mark, edit its hand-written SVG and run `build:logos` and
`build:icons`.

## 11. The chosen concept

**The owner chose B (Roof sign)** as the logo for the whole business: the app (side navigation,
login, top bar, PWA icons, favicon), documents, signage and vehicles. The yellow roof sign is what
every customer and driver already associates with the taxi station, and it is a distinctive
silhouette on cars and on the office door.

How its weak points are handled:

- **Small sizes**: the PNG app icons put the sign on the black tile (`npm run build:icons`, B
  by default), and `favicon.svg` is a simplified sign with a larger R for 16 px (see 2.3).
- **Yellow on white** (1.6:1): the black R and roof line carry the mark on light backgrounds;
  never use the sign below 28 px high on white without the tile.
- **Wide lockups**: the horizontal lockups are wider than A's for the same height, so narrow
  containers (the app's 248 px side navigation, the login card on a phone) scale them down to
  the available width instead of letting them overflow.

**A (Road R)** stays in `packages/brand/logo/a-*` as an alternative and for illustration (for
example, as a secondary motif on dealership material). Do not use A and B together as logos.
