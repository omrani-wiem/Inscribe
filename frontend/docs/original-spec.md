# Build prompt: Handwritten Feedback Analyzer Dashboard

Use this as a spec/prompt for a developer or AI coding agent. It describes a full
dashboard application for digitizing and analyzing handwritten customer feedback,
laid out like a typical analytics dashboard (sidebar nav, top bar, KPI row, charts,
data table) — built exclusively from Material Web components and Material 3 tokens.

**Layout reference:** follow the structure of a standard SaaS analytics dashboard —
collapsible grouped sidebar on the left, breadcrumb + page header + date-range/segment
controls on top, a KPI card row, a two-column chart row (trend chart + breakdown
panel), and a filterable data table below. Everything below describes that structure
adapted to feedback data, rebuilt with Material Web instead of any other component kit.

---

## 1. What to build

A web dashboard with persistent grouped navigation and four destinations:

1. **Overview** — KPIs and charts summarizing all analyzed feedback.
2. **Analytics** — deeper theme/sentiment breakdowns (optional second page; can be
   merged into Overview for a first version).
3. **Analyzer** — where new handwritten feedback photos are uploaded, transcribed, and scored.
4. **Feedback Table** — a full sortable/filterable/searchable table of every feedback record, with row detail and export.

This is a data-dense internal tool, not a marketing page. Prioritize legibility,
density control, and fast scanning over decoration.

## 2. Tech constraints

- **UI components and styling: Material Web only** (https://material-web.dev). Use
  its web components (`md-filled-button`, `md-outlined-button`, `md-text-button`,
  `md-outlined-text-field`, `md-select`, `md-tabs`, `md-primary-tab`, `md-dialog`,
  `md-list`, `md-list-item`, `md-icon-button`, `md-chip-set` / `md-filter-chip` /
  `md-assist-chip`, `md-linear-progress`, `md-circular-progress`, `md-divider`,
  `md-elevation`, `md-menu`, `md-switch`, `md-checkbox`) and its Material 3 design
  tokens (`--md-sys-color-*`, `--md-sys-typescale-*`) for every visual decision —
  color, type, spacing rhythm, elevation.
- **Material Web has no chart component, no nav-rail/sidebar component, and no
  data-table component.** Build all three yourself, constrained to M3 tokens so they
  read as one system rather than a different kit dropped in:
  - Charts: hand-rolled SVG or `<canvas>`, colored from the same CSS custom
    properties as the rest of the UI (see §8).
  - Sidebar: a plain `<nav>` built from `md-list` + `md-list-item` + `md-icon` +
    `md-divider`, with collapsible section headers (chevron icon-button toggles
    a group open/closed) — see §3.
  - Table: a plain `<table>` (or div-grid) styled with M3 surface/outline tokens,
    using `md-checkbox` for row selection, `md-icon-button` for row actions, and
    `md-menu`/`md-select` for column filters — see §9.
- Framework is up to the implementer (React, Vue, or plain web components all
  work fine with Material Web); state management and routing likewise.
- OCR/analysis is done by sending the feedback photo to a vision-capable LLM
  (see §7 for the exact prompt) rather than a traditional OCR library — this is
  what makes handwriting legible, not just printed text.

## 3. Navigation structure

**Left sidebar**, ~240px wide, collapsible to icon-only rail:

- **Header:** small app mark + product name + a collapse icon-button (`md-icon-button`
  with a chevron/panel icon) at the top, same as a typical dashboard sidebar.
- **Grouped sections**, each with an uppercase label + chevron to collapse/expand the
  group (matches the "Overview / Feedback Management / Users" grouping style):
  - **Overview**
    - Feedback overview (`dashboard` icon) — the Overview page, §4
    - Analytics (`bar_chart` icon) — the Analytics page, §5
  - **Feedback Management**
    - All Feedback (`table_rows` icon) — the Feedback Table page, §9
    - Analyzer (`document_scanner` icon) — the Analyzer page, §6
  - **Data** (in place of a "Users" group, since this tool has no multi-user accounts
    unless the implementer adds them)
    - Settings (`settings` icon) — data export/import, model config, §10
- Active item: pill-shaped active-indicator background
  (`--md-sys-color-secondary-container`) behind icon + label, per M3 nav-rail spec.
- Footer: small copyright/version line, same understated treatment as a typical
  dashboard sidebar footer.
- On mobile widths (<720px), collapse to a bottom navigation bar with the 4 primary
  destinations (Overview, Analytics, Analyzer, All Feedback), icon + label.

**Top bar**, above the page content, on every page:

- Breadcrumb row: "Dashboards / [current page]" in small, muted text
  (`--md-sys-color-on-surface-variant`), with a small `md-icon` at the start.
- Right side of the breadcrumb row: search icon-button, notification icon-button
  (with a small dot badge if there are items needing review, see §6), and an
  icon-button that opens quick settings.
- Page header row (below breadcrumb): large page title on the left; on the right,
  a date-range control (button showing the current range, e.g. "Oct 2025 – Mar 2026",
  opening a menu/dialog to change it) and a filled "All Segments"-style button that
  opens a filter menu (filter by theme, source, or confidence level — whatever
  cohort filters make sense for the page).

## 4. Page: Overview

Purpose: answer "how is feedback trending, and what's it mostly about?" in one glance.

**KPI card row** — 4 equal-width cards (wrap on narrow screens), each with: a small
circular icon badge top-left, an info icon-button top-right (tooltip explaining the
metric), the big number, and a small trend chip below/beside it showing a % change
vs. the previous period in green (up, when that's good) or red (down, or up when
that's bad — e.g. negative-feedback % rising should read as a red "up" chip):

- Total feedback analyzed (in range)
- Needs review (transcriptions the model flagged low-confidence)
- Response/analysis rate (% of uploaded photos successfully analyzed)
- Average rating (out of 5, only counting entries where a rating was legible)

**Two-column chart row:**

- **Left (wider card), "Sentiment History":** header row with the card title and a
  "Details" link on the right. Below it, a big score readout — e.g. "Net Sentiment
  Score" with the current value and a small trend arrow/percentage next to it — then
  a stacked bar chart, one bar per month/week, split into three segments (positive /
  neutral / negative), with a legend of colored dots + labels top-right of the chart
  (mirrors a promoters/passives/detractors NPS-history chart, but for sentiment).
- **Right (narrower card), "Responses":** header with a "View all" link. Below it,
  the total feedback count as a large number, then a single horizontal segmented bar
  (proportional widths for positive/neutral/negative, no gaps, rounded ends) as a
  compact visual summary, then a short list below it — one row per sentiment with a
  colored dot, the label, the count, the percentage, and a small trend arrow — and a
  full-width outlined button at the bottom ("All feedback →") linking to the table.

**Below the chart row**, a full-width feedback table card (same component as §9, just
capped to the most recent ~5 rows with the toolbar/filters hidden), so Overview ends
by grounding the KPIs/charts in actual recent entries, with a link to the full table.

**Empty state:** if there's no data yet, replace the whole page body with a
centered message + a "Go to Analyzer" button, rather than showing charts full of zeros.

## 5. Page: Analytics

A deeper-dive page for theme-level analysis (can ship after v1):

- **Top themes** — horizontal bar chart, top 10 extracted themes by frequency,
  longest bar on top. Clicking a bar jumps to the Feedback Table pre-filtered by
  that theme.
- **Rating distribution** — 5-bar histogram (1★–5★).
- **Sentiment by theme** — a small stacked-bar-per-theme grid, so it's visible
  whether a given theme skews positive or negative (e.g. "wait time" might be almost
  entirely negative, "staff friendliness" almost entirely positive).

## 6. Page: Analyzer

Purpose: get new handwritten feedback into the system.

1. **Upload zone** — drag-and-drop area + "Choose images" button (`md-filled-button`),
   accepts multiple images at once, also supports camera capture on mobile.
2. **Queue grid** — one card per queued image: thumbnail, filename, a status
   chip (Queued / Reading… / Done / Failed), and once done, a short preview
   of the transcribed text. Failed items show a retry icon-button.
3. **Batch actions bar** — "Analyze N items" primary button, "Clear queue"
   text button, and an `md-linear-progress` bar that fills as the batch
   processes (sequential or limited-concurrency processing, since vision
   calls are the bottleneck).
4. Each analyzed item is written into the shared feedback dataset (same store the
   Overview and Feedback Table read from) and removed from the queue — the Analyzer
   tab is a staging area, not a place items live permanently.
5. **Inline validation:** if the model can't produce a confident transcription
   (e.g. image too blurry, not actually handwriting), mark the item "Needs
   review" rather than silently guessing, and let the user open it in a dialog
   to manually correct the transcription and sentiment before it's saved. This
   is what feeds the sidebar notification badge (§3) and the "Needs review" KPI (§4).

## 7. The analysis prompt

Send each image to a vision-capable model with a prompt along these lines — do
not compress this to "read the handwriting," the structure matters for
consistent downstream analytics:

```
You are analyzing a photo of a single handwritten customer feedback note.

1. Transcribe the handwritten text as accurately as possible. If words are
   illegible, make your best guess but do not invent content that isn't there.
2. Decide the overall sentiment: "positive", "neutral", or "negative".
3. Extract up to 5 short themes/topics mentioned (e.g. "staff friendliness",
   "wait time", "pricing"), lowercase, 1-3 words each.
4. If a numeric rating out of 5 is visibly marked (stars, circled number,
   checkboxes), extract it as an integer 1-5, otherwise null.
5. Write a one-sentence summary in your own words.
6. Rate your transcription confidence as "high", "medium", or "low". Use
   "low" if the handwriting is genuinely illegible or the image quality is poor.

Respond with ONLY a raw JSON object, no markdown fences, no commentary:
{
  "transcription": "string",
  "sentiment": "positive|neutral|negative",
  "themes": ["string"],
  "rating": number|null,
  "summary": "string",
  "confidence": "high|medium|low"
}
```

The `confidence` field feeds the "Needs review" flag in the Analyzer (§6).

## 8. Data model & chart color tokens

Each feedback record:

```
{
  id: string,
  timestamp: ISO 8601 string,
  transcription: string,
  sentiment: "positive" | "neutral" | "negative",
  themes: string[],          // lowercase, deduplicated
  rating: number | null,     // 1-5
  summary: string,
  confidence: "high" | "medium" | "low",
  needsReview: boolean,
  source?: string            // optional: which store/location/channel it came from
}
```

If feedback needs to be attributed to a respondent, add an optional `respondent`
object (`{ name?, avatarUrl?, email? }`) so the Feedback Table can show a
"Created by" column with avatar + name, the way most dashboard tables do — but
don't invent an identity when handwriting alone doesn't carry one; leave it blank.

Sentiment colors are a separate semantic set from the M3 roles used for buttons/nav —
don't reuse `error`/`primary` directly for sentiment, define
`--sentiment-positive`, `--sentiment-neutral`, `--sentiment-negative` so charts,
pills, and the segmented bar on Overview all stay visually consistent even if the
M3 palette changes later.

## 9. Page: Feedback Table

Purpose: the record of truth — every entry, searchable and exportable.

- **Toolbar** (mirrors a typical dashboard table header): filter dropdowns on the
  left — Sentiment (`md-select` or menu), Confidence, Theme (multi-select) — a
  search field on the right side of the toolbar, and an outlined "Export CSV"
  button at the far right.
- **Columns:** checkbox (row select), Feedback ID, Created by (avatar + name, if a
  respondent was captured — otherwise omit this column), Theme (primary theme as a
  small chip, or the first of several), Message (the transcription, truncated,
  expand on click), Status (a pill: "Needs review" / "Reviewed" / "Reviewed & edited"),
  Rating (stars, or "–"), Date (sortable).
- Sortable by date, sentiment, rating.
- Pagination or virtualized scroll for large datasets.
- **Row click / "view" action** opens a dialog (`md-dialog`) with the full
  transcription, all themes, editable sentiment/rating (for manual correction),
  and a delete button.
- **Bulk selection:** checkboxes per row (header checkbox selects all), bulk
  delete and bulk export for the selected set, shown as a small action bar that
  replaces the toolbar filters while a selection is active.

## 10. Page: Settings

- Data management: clear all data (with confirmation dialog), export full
  dataset as JSON, import a previously exported JSON backup.
- Model/analysis settings: which model/endpoint the Analyzer calls, and an
  API key field if the implementer is wiring this to their own backend
  (this dashboard should never embed a real API key client-side in production —
  route it through a backend proxy).
- Display settings: default date range for Overview, theme (if dark mode is in scope).

## 11. Visual direction

Carry a consistent "ink & paper" identity through Material 3 tokens rather than
generic Material blue:

- Surface: warm paper cream (`#FBF8F2` family), not stark white.
- Primary: an ink blue (`#2B4570` family).
- Tertiary/accent: a sepia/warm-brown (`#7A5230` family) for ratings and highlights.
- Typography: Roboto throughout (Material's default), Roboto Mono for
  timestamps/data labels only.
- Cards use a subtle 1px outline (`--md-sys-color-outline-variant`) plus a small
  radius (16px) rather than heavy shadows, matching a clean SaaS-dashboard feel.

## 12. Non-functional requirements

- Fully responsive down to mobile (sidebar → bottom bar as in §3, table → stacked
  cards or horizontal scroll).
- Empty states everywhere data-driven content could be empty (Overview,
  Feedback Table, theme charts).
- Loading states for async work (analyzing images, loading the table).
- Visible keyboard focus on all interactive elements; charts have a
  text/table fallback or `aria-label` summary for screen readers.
- Respect `prefers-reduced-motion` (no spinning icons, disable chart entry animations).
