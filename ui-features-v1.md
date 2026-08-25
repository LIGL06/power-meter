# Implementation Plan: UI Features v1

## Overview
Five feature requests, gathered after `api-implementation-v2.md`'s Phase 5 closed out and its post-Phase-5 parity audit shipped. Each was researched against the actual `power-meter-api` source (not assumed) before this plan was written — three of the five have real, non-obvious mechanics worth understanding before touching code, and one (historical periods) needs a new API endpoint that doesn't exist yet.

Requested, in the user's order → where each lands below:

| # | Requested | Phase | Why this order |
|---|---|---|---|
| 5 | Can't set the real starting point of the current period (mid-period signup miscalculates kWh) | **Phase 1** | Smallest, and the anchor/opening-index decision is *immutable* — getting the guidance right first prevents bad data the other phases would then have to work around. |
| 1 | Can't add readings for past days to fill gaps | **Phase 2** | Independent, UI-only — the API already supports it. One real backend edge case to design around (below). |
| 3 | Admin can skip meter registration; hide tabs with no meter | **Phase 3** | Independent, mostly routing/nav. |
| 4 | Audit gaps: profile, reading history, period detail, contract detail | **Phase 4** | The largest chunk — four sub-features, all UI-only against endpoints that already exist. |
| 2 | Can't add historical periods to the graph | **Phase 5** | Needs a **new API endpoint** — no backend concept of a "period" exists that isn't derived from real readings. Scheduled last so it doesn't block the four UI-only phases. |
| — | *(added after review)* Solar panel sizing calculator | **Phase 6** | New ask, independent of the other five — a client-side planning tool, no API changes. |

Every phase below is UI-only except Phase 5, which is flagged explicitly.

**Status: Phases 1–5 confirmed, ready to build** (your answers below). Phase 6 is new this round — its design is below, with one thing to sanity-check before I hardcode it (the reference data table).

## Architecture decisions & design notes (read before starting)
Six real findings from reading the actual `power-meter-api` and `power-meter` source, each with a recommended resolution:

1. **Reading backfill must be append-only for v1.** `ReadingsService.create()` finds the chronologically-*previous* reading correctly (by `readAt`, not creation order) and prices the new reading against it — but it never calls `recomputeFollowing()`, the method that re-derives a *later* reading's delta after an edit. `update()` and `remove()` both call it; `create()` doesn't. Concretely: if a user already has readings for Monday and Thursday, and backfills Tuesday, Thursday's stored `deltaImportKwh` stays computed against Monday — silently wrong until Thursday's reading is itself edited (which *does* trigger a recompute). **Resolution:** restrict the UI to backfilling dates strictly after the last existing reading (and up to today) — i.e., filling the tail gap since you last logged, never inserting between two existing readings. This is also the actual use case ("fill some gaps... if available readings exist" reads as "I forgot the last few days," not "I want to insert a reading between two I already have"). If real demand shows up for true mid-sequence insertion, that needs a backend fix (`create()` calling `recomputeFollowing()` too) before the UI can safely allow it.
2. **The contract-bootstrap fetch doesn't filter to active contracts — a real bug, found reading the source, not yet hit live.** `GET /contracts` never filters on `isActive` (confirmed: no reference anywhere in `ContractsService.findAll`/`scope`). `AppDataProvider` picks `items[0]` (newest by `createdAt`) unconditionally. After Phase 4 ships a "Deactivate meter" action, a user who deactivates their only contract would still have it come back as `items[0]` — now `isActive: false` — and the app would keep operating against a dead meter instead of routing back to onboarding. **Resolution:** fix this in Phase 1 (before Phase 4 needs it): `contractRepository.list()` callers should select the first *active* contract, not just the first one — `res.items.find(c => c.isActive) ?? null` in `AppDataProvider`'s bootstrap effect.
3. **The onboarding anchor date and opening index are immutable — and the failure mode from getting them wrong is silent and severe.** `billingAnchorDate`/`initialImportIndex` are permanent (`serviceNumber`, `billingAnchorDate`, and both `initial*Index` fields can't be patched later — confirmed in `UpdateContractDto`). The server prices the period from `period.startDate` (== `billingAnchorDate`) to the latest reading's date for `daysElapsed`, and from `period.openingImportIndex` (== `initialImportIndex`) for `importedSoFar` (`ProjectionService.estimate`, confirmed directly in source). If a user backdates the anchor to match their real CFE cycle start but doesn't actually know the meter's real reading on that date — and guesses low, trying to "make room" for consumption that already happened before they started tracking — every kWh from the real gap gets attributed to the tiny window between signup and their first logged reading, wildly inflating the computed daily average and every projection built on it. This is exactly the bug the request describes. **Resolution:** no schema change — this is a guidance problem. Add an inline warning in `AddMeterPage` whenever the chosen anchor date isn't today, spelling out that the opening index must be the meter's *actual* reading on that exact date, not an estimate — and that if they don't know it, anchoring to today with today's real reading is the safe default (the period just won't line up with the real CFE cycle boundary, which is a lesser problem than a corrupted first data point).
4. **Historical periods need a new, separate API resource — not a synthetic `BillingPeriod`.** Real periods carry invariants a manually-entered record can't honestly satisfy: sequential `sequence` numbers starting at 1, a `tariffSnapshot` priced against a real tariff version, opening/closing indexes tied to real readings. Retrofitting manual entries into that model means either faking all of that or weakening the invariants for everyone. **Resolution (detailed in Phase 5):** a new, deliberately lightweight resource — a manually-entered summary record (dates + kWh + total, no tariff computation, no reading linkage) — kept structurally separate from `BillingPeriod` and visually distinguished on the chart.
5. **Admin's "no contract" state needs its own home, not a redirect to onboarding.** Regular users are correctly forced through `/onboarding` on their first login — the product's whole point, for them, is tracking one meter. An admin's job may be exclusively managing the global tariff catalog (the seeded admin account has no meter at all, confirmed live in the Phase 4 testing pass). **Resolution (confirmed):** the forced `/onboarding` redirect stays for regular users; for `role === 'ADMIN'` with `!contract`, `/` redirects straight to `/admin/tariffs` instead — that's their home. `/admin/tariffs` itself gets a small empty-state banner when the logged-in admin has no contract ("No meter registered under your account — Register one" linking to `/onboarding`), so the option to add a personal meter is still one click away without it being forced. The nav sidebar hides **Dashboard**, **Daily Reading**, and **Solar Sizing** (Phase 6) whenever `!contract` (true for anyone, not just admins — those pages are 100% meaningless without a meter); **Settings** stays visible always, since Phase 4 makes its Profile tab account-level, not meter-level.
6. **Profile can only ever edit name/email in this pass — the API has no password-change endpoint.** `UpdateUserDto` explicitly excludes `password` with a comment pointing at "a dedicated flow" — that flow doesn't exist anywhere in `power-meter-api` today (confirmed: no `change-password`/`reset-password` route in any controller). **Resolution:** Phase 4's Profile tab edits `firstName`/`lastName`/`email` for real via `PATCH /users/:id`; the password field is dropped entirely rather than kept as a non-functional placeholder, with a short note that password changes aren't available yet.

## Phase 1: Onboarding clarity & the active-contract fix ✅ COMPLETED
Small, no dependencies on later phases, and closes the door on the worst failure mode (a corrupted first data point that can never be corrected, since the anchor/opening-index are immutable).

Both pieces verified live: registered a fresh user, confirmed the relabeled index field copy, backdated the anchor date to see the amber warning + "Use today" button appear, confirmed "Use today" resets it and the warning clears, and completed onboarding normally. Then deactivated that contract directly via the API (`DELETE /contracts/:id` — the UI for this lands in Phase 4) and reloaded: the bootstrap fix correctly treated the account as having no active contract and routed back to `/onboarding` instead of showing stale dashboard data against a dead meter. `tsc`/`eslint`/`vite build` stayed green throughout (lint holds at 6 problems, same as end of Phase 5 — no regressions).

1. **`AddMeterPage` guidance** (`src/features/onboarding/`):
   - Relabel `initialImportIndex`/`initialExportIndex` to be explicit: "Meter's exact reading on the start date below" rather than "at registration."
   - When the `billingAnchorDate` field's value isn't today, show an inline warning (a `FieldDescription`-style callout, not a blocking validation error): *"Backdating the start date only works if the index above is the meter's real reading on that exact date. If you're not sure, anchor to today with today's reading instead — the app just won't line up with your CFE cycle boundary."*
   - Add a "Use today" quick-reset affordance next to the date field for the safe default path.
2. **Active-contract bootstrap fix** (`src/state/AppDataProvider.tsx`): change `setContract(res.items[0] ?? null)` to select the first item where `isActive`, so a future deactivated contract (Phase 4) can never be silently treated as the live one. This is a pure bugfix, independent of the guidance work above, bundled here because it's small and because Phase 4's deactivate feature depends on it being correct first.

## Phase 2: Reading backfill ✅ COMPLETED
Append-only, per architecture decision #1 above.

1. **`ReadingEntryPage` gets a date field** (`src/features/reading-entry/`): a native `type="date"` input, defaulting to today, kept as plain `useState` outside react-hook-form (the schema's monotonic baseline depends on which reading is targeted, which depends on the selected date — routing that through `watch()` would create a circular dependency on the form itself). `min` = the latest existing reading's own calendar date (selecting it switches into editing that reading) or the period's `startDate` if there are no readings yet; `max` = today.
2. **Generalized "is this an edit or a new entry" beyond "today."** `isEditTargetDate(date)` compares the latest reading's date to whichever date is selected (period match check carried over unchanged) — today's original behavior is just the case where the selected date defaults to today. A non-matching date creates, with `readAt` = local noon on the *selected* date (`localNoonISOInstant` generalized to take an optional target date, defaulting to today).
3. **A real client-side guard, not just the native `min`/`max`.** Found live: the browser happily accepts an out-of-range date set programmatically (and can via manual keyboard entry too, depending on browser) — `min`/`max` only constrain the picker UI. This one is load-bearing, not cosmetic: `ReadingsService.create()` never recomputes a *later* reading's delta, so an inserted-between submission wouldn't error, it would silently leave the next reading's stored consumption wrong (architecture decision #1). Added `isDateOutOfRange` derived state that disables the submit button, shows an inline error, and is re-checked as the first line of `onSubmit` itself (a disabled button doesn't reliably block Enter-key submission in every browser).
4. **Copy**: "Log today's reading" → "Log a reading," with the card's date line and field hint reflecting whichever date is selected ("Today" / "Filling in a day you missed" / "Already logged for this date — editing it below.").

**Verified live**: registered a fresh contract with the anchor backdated 5 days, then from `ReadingEntryPage` — backfilled a reading 3 days into the period (billing correctly recalculated days-elapsed and daily average from it), confirmed the date bounds tightened to the new latest reading, confirmed re-selecting that date switched the form into edit mode automatically, and confirmed attempting a date one day *before* the new minimum (bypassing the native picker via direct value assignment, exactly the gap found) was correctly blocked with the button disabled and an explanatory error — the scenario item 3 above exists to prevent. Logging today's reading afterward worked normally, flipping into "editing it below" exactly as the original single-day version did. `tsc`/`eslint`/`vite build` all green (lint still at 6, unchanged).

## Phase 3: Admin "no meter" experience ✅ COMPLETED
1. **`App.tsx`**: the root route group's `!contract` branch redirects a normal user to `/onboarding` as before; for `role === 'ADMIN'`, it redirects to `/admin/tariffs` instead — that's the admin's default home whenever they have no personal meter.
2. **`AdminTariffsPage` gets a small empty-state banner** (not a whole separate page) rendered above the version editor when the logged-in admin's own `contract` is `null`: "No meter registered under your account — [Register one]" linking to `/onboarding`.
3. **`AppShell.tsx` nav**: `NAV_ITEMS`/`ADMIN_NAV_ITEMS` entries now carry a `requiresContract` flag; **Dashboard** and **Daily Reading** are hidden whenever `!contract` (both roles). **Settings** and **Tariff Management** stay visible unconditionally.
4. Depends on Phase 1's active-contract fix already being in place — confirmed live (see below).

**Verified live**: found the seeded admin account had picked up a real contract (alias "HOME") since the last session — not something built for this pass, so temporarily deactivated it via the API to exercise the actual no-meter path, then reactivated it afterward to leave things as found. With it deactivated: navigating to `/` correctly redirected to `/admin/tariffs`, the nav sidebar showed only Settings and Tariff Management, the empty-state banner appeared, and "Register one" correctly opened `/onboarding`. Reactivating the contract afterward (via `PATCH .../isActive: true`) and reloading confirmed the app picks it back up normally — incidentally re-confirming Phase 1's active-contract fix in both directions. `tsc`/`eslint`/`vite build` all green (lint still at 6).

## Phase 4: Account & history surfaces
The four post-Phase-5 audit gaps, each independent of the others.

### 4.1 Profile — real API
- New `usersRepository` (`src/data/repositories/api/usersRepository.ts`): `get(id)`, `update(id, patch)` against `GET`/`PATCH /users/:id`. No `list`/`create`/`deactivate` yet — those are admin-only user-management, explicitly out of scope for this pass (a separate "admin user management" screen would be its own future feature, not bundled here).
- New types in `domain/types.ts` mirroring `UserResponseDto`/`UpdateUserDto` (email, firstName, lastName — `role`/`isActive` typed but not exposed in the form; the API already rejects them from a non-admin actor).
- `SettingsPage`'s `ProfileTab` rewritten: fetch the current user via `AuthUser` already on context (no extra `GET` needed — `user` has id/email/firstName/lastName already) for the default values, submit via `usersRepository.update(user.id, {...})`, refresh `user` on context via `setUser` on success. Password field removed entirely (architecture decision #6); `address` field also removed — there's no `address` on the `User` model at all (that was always local-only, and doesn't correspond to anything in `CreateUserDto`/`UpdateUserDto`).
- `AppConfig`/`localStorage` profile config and `configRepository` become fully dead once this lands — remove them (mirrors how Phase 4 of the API integration already trimmed `AppConfig` down once Tariff/Solar/Billing went live).

### 4.2 Reading history
- `readingsRepository.list()` already supports `page`/`limit`/`from`/`to`/`type`/`periodId` — nothing new needed at the data layer.
- New page `src/features/reading-entry/ReadingHistoryPage.tsx`, route `/reading/history`. A simple paginated list (date, import/export index, deltas, source, notes), newest first, matching the API's own default sort. A "View all readings →" link added to `ReadingEntryPage` rather than a new top-level nav item, keeping the sidebar from growing further.
- Delete action per row (wired to the already-existing but unused `readingsRepository.remove()`), only enabled for readings in the currently *open* period (the API rejects deletes on closed periods — the button should be disabled with a tooltip explaining why, not just fail on click).

### 4.3 Period detail view
- `billingRepository.period(contractId, periodId)` already exists, unused until now.
- New page `src/features/dashboard/PeriodDetailPage.tsx`, route `/periods/:periodId`. Shows the period's full segment-by-segment breakdown (season, date range, tiers with per-tier kWh/rate/charge, subtotal/tax/total) — the data the server already computes and stores (`tariffSnapshot`, `segments`) but nothing currently renders.
- `ConsumptionCostChart`'s bars become clickable: add `id: period.id` to the mapped chart data and an `onClick` on the `<Bar>` navigating to `/periods/${id}`. Cursor changes to a pointer on hover to signal it's interactive.

### 4.4 Contract detail & deactivate
- New Settings tab, **"Meter"** (5th tab, after Billing Period): read-only display of the immutable fields not shown elsewhere (`serviceNumber`, `meterSerial`, `address`, `customerType`, `billingAnchorDate`, `initialImportIndex`/`initialExportIndex`) — `bankedExportKwh` stays on the existing Solar tab, not duplicated here.
- A "Deactivate meter" danger action at the bottom, behind the same inline two-step confirm pattern already used for "Close this period" in `ProjectionSummary` (not a native `window.confirm`, consistent with the existing convention). Calls `contractRepository.deactivate(id)` (already exists, unused until now), then `setContract(null)` — the Phase 1 active-contract bootstrap fix means a subsequent reload would reach the same conclusion on its own, but setting it directly avoids a round-trip and gets the user back to onboarding (or the Phase 3 admin empty state) immediately.

## Phase 5: Historical periods for the graph — confirmed, backend work approved
The only phase touching `power-meter-api`.

**Scope, answering "is this only for past closed periods?": yes.** A `HistoricalPeriodEntry` describes a bill that already fully concluded — always in the past, never the currently-open period (which stays live-tracked through real readings, as today). In practice that means entries for the stretch *before* the contract's own `billingAnchorDate` — bills the user already has on paper from before they started tracking in the app. The one server-side rule enforcing "closed": `endDate` must not be in the future. There's deliberately no check against the contract's real period history/boundaries (see architecture decision #4) — these are a separate, parallel record, not reconciled against real periods.

### Backend addition (power-meter-api)
A new, deliberately lightweight resource — manually-entered summary records, structurally separate from `BillingPeriod` so real periods' invariants (sequential numbering, tariff pricing, reading linkage) are never faked or weakened:

```
HistoricalPeriodEntry
  id
  contractId
  startDate: ISODate
  endDate: ISODate
  importedKwh: number
  exportedKwh?: number
  total: number
  currency: string          // defaults to the contract's tariff's currency
  notes?: string            // e.g. "from paper bill"
  createdAt / updatedAt
```

Proposed routes, owner-or-admin scoped like readings/contracts (not admin-only — this is a personal record of your own past bills, not a global catalog):
- `POST /contracts/:id/historical-periods` — create
- `GET /contracts/:id/historical-periods` — list, sorted `startDate` ascending
- `PATCH /contracts/:id/historical-periods/:entryId` — correct a typo
- `DELETE /contracts/:id/historical-periods/:entryId` — remove

No validation against real period boundaries or tariff versions — these predate the contract's own tracked history by definition, so there's nothing to reconcile against. Server-side checks worth adding: `startDate < endDate`, `endDate` not in the future (enforces "closed/past only"), and `importedKwh`/`total` non-negative.

### Frontend
- New `historicalPeriodsRepository` (`src/data/repositories/api/`) and matching types.
- A small form for entering a past bill (start/end date, kWh, total) — likely living on the new Settings "Meter" tab from Phase 4.4, as a natural place for "manage things about my meter's history." The date fields default their `max` to today (mirroring the server rule) and the form's helper text nudges toward "before you started tracking here" without hard-blocking other dates.
- `ConsumptionCostChart` merges real `periods` (filtered to `CLOSED`) with `historicalPeriodEntries`, sorted chronologically together, with historical bars visually distinguished (a lighter/hatched fill, and a "manually entered" note in the tooltip) so they're never mistaken for server-priced bills.

## Phase 6: Solar sizing calculator — new tab, UI-only
**Goal:** given how much a contract imports, how many 620–650 W panels would it take to drive net imports to ~0 kWh (so the period only bills the tariff's fixed/minimum charge)? A planning tool, not a certified engineering estimate — framed that way throughout the UI.

**Formula** (matches the worked example given):
```
dailyGenerationPerPanelKwh = (wattageW / 1000) × efficiency × peakSunHours
dailyGenerationKwh(panels) = dailyGenerationPerPanelKwh × panels
offsetPercent(panels)      = dailyGenerationKwh(panels) / dailyConsumptionKwh × 100
```
`0.620 kW × 0.80 × 5 h = 2.48 kWh/day/panel` — exactly the given example.

**`dailyConsumptionKwh` — sizing basis, both computed and selectable** (this is "against max peak daily reading or divide by avg of period" from the request):
- **Average day** — `estimate.dailyAverage.importKwh`, already computed server-side for the current period. No new derivation needed.
- **Peak day** — not provided by the API directly, so derived client-side: fetch the current period's readings (`readingsRepository.list(contractId, { periodId })`), and for each consecutive pair compute an implied daily rate (`deltaImportKwh ÷ days between the two readAt timestamps, floored at 1 day`); take the max across the period. Sizing to this basis means net-zero even on the highest-usage day observed so far, at the cost of more panels.
- Both numbers are shown side by side; the results table (below) is driven by whichever the user has selected, with a toggle to switch.

**Peak sun hours — simplified per review: a plain user-editable input, no state table.** No lookup, no defaults, no dataset to source or maintain — the user types their own local peak-sun-hours figure directly (from their utility, PVWatts, a solar installer's quote, or wherever they'd trust). Sidesteps needing a verified per-state dataset entirely.

**Other inputs**, each pre-filled per review, all adjustable:
- Panel wattage — number input, default **620 W**.
- System efficiency — percent input, default **85%**.

**Output — the sizing table** (the literal "make this table" ask): rows for panel count 1 through however many it takes to clear 100% offset (plus two extra rows past that point, capped at 20 to bound the table), columns:

| Panels | Generation/day | Generation/period | % of usage offset | Est. remaining import | Note |
|---|---|---|---|---|---|
| 1 | 2.48 kWh | 74.4 kWh (30d) | 22% | ~8.7 kWh/day | |
| … | … | … | … | … | |
| N | … | … | ≥100% | ~0 kWh/day | "Fixed/minimum charge only" |

"Generation/period" uses the contract's own `periodDays` (30 or 60) so it lines up with real billing cycles. The row that first clears 100% gets a highlighted "pay only the fixed/minimum charge" note, pulling the actual figure from the resolved tariff (`GET /tariffs/:code` → `fixedCharge`/`minimumCharge`) so it's a real number, not just a description.

**Scope note:** this sizes generation against import *consumption* — it doesn't simulate the bank-forward mechanics of `bankedExportKwh` (architecture decision #3 from `api-implementation-v2.md`: surplus banks forward, there's no separate export credit rate). That's a planning simplification worth stating in the UI, not something to build out here — once panels are actually installed and `hasExports`/real export readings exist, the real `estimate`/`periods` endpoints already handle the true banking math.

**Structure** (new feature folder, new nav tab):
- `src/features/solar-sizing/SolarSizingPage.tsx` — page; pulls `contract`/`estimate` from context, fetches current-period readings for the peak-day derivation.
- `src/features/solar-sizing/domain/solarMath.ts` — pure functions: `dailyGenerationPerPanelKwh(wattageW, efficiency, peakSunHours)`, `buildSizingTable(dailyConsumptionKwh, dailyGenerationPerPanelKwh, periodDays)`.
- `src/features/solar-sizing/components/SizingInputs.tsx` — peak-sun-hours, wattage, efficiency, basis toggle (Average day / Peak day).
- `src/features/solar-sizing/components/PanelSizingTable.tsx` — the results table.
- `AppShell.tsx`: new nav item **"Solar Sizing"**, route `/solar-sizing`, added to the group hidden when `!contract` (Phase 3, decision #5).

## Milestones
- [x] Milestone 1: Onboarding guidance + active-contract bootstrap fix (Phase 1)
- [x] Milestone 2: Reading backfill (Phase 2)
- [x] Milestone 3: Admin no-meter experience (Phase 3)
- [ ] Milestone 4: Profile, reading history, period detail, contract detail (Phase 4)
- [ ] Milestone 5: Historical periods — API + UI (Phase 5)
- [ ] Milestone 6: Solar sizing calculator (Phase 6)

## Decisions from review
1. ✅ Phase 2 stays append-only — no backend change to `ReadingsService.create()` for this pass.
2. ✅ Phase 3 — admin with no contract lands on `/admin/tariffs`, which also carries the empty-state banner.
3. ✅ Phase 4.1 — Profile ships name/email only, no password field.
4. ✅ Phase 5 — `HistoricalPeriodEntry` approved, scoped to past/closed periods only (`endDate` can't be in the future); go ahead on the backend addition.
5. ✅ Phase 6 — peak sun hours is a plain user-editable input (no state table/dataset); panel wattage defaults to 620 W, efficiency to 85%.

All six phases confirmed. Building in order, starting with Phase 1.
