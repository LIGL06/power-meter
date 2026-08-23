# Implementation Plan: Integrating power-meter-api into power-meter UI

## Phase 1: Infrastructure & Auth ✅ COMPLETED

## Overview
The goal is to integrate the `power-meter-api` (NestJS/MongoDB backend) features into the `power-meter` React application. This involves migrating local data models to API integrations, implementing authentication, and syncing the complex billing logic.

## Analysis of source: power-meter-api
Audited directly against the running code (controllers/services/schemas), not just the README.

- **Auth** (`/auth`): JWT access (15m) + refresh (7d) pair. `register`/`login` return `{accessToken, refreshToken, expiresIn, user}`. `refresh` takes `refreshToken` in the **body** (not a header) and rotates both tokens. `logout` revokes the stored refresh token server-side. `me` returns the current user. Roles: `ADMIN` | `USER`.
- **Contracts** (`/contracts`): a user's meter/service — **not** a 1:1 concept with "the app's user profile". A user can own multiple; a normal user only ever sees their own (`ADMIN` sees all, or one owner via `?ownerId=`). Creating one immediately opens billing period #1. Fields: `alias`, `serviceNumber` (unique), `meterSerial?`, `address?`, `customerType`, `tariffCode` (default `'1C'`), `periodDays` (30 or 60), `billingAnchorDate`, `hasExports`, `initialImportIndex`, `initialExportIndex`, `bankedExportKwh` (server-managed), `isActive`. `periodDays`/`hasExports`/alias/etc. are patchable; the opening meter state and anchor date are immutable after creation. Delete is a soft-deactivate (history retained).
- **Readings** (`/contracts/:id/readings`, `/readings/:id`): **cumulative meter indexes**, not daily deltas (matches the frontend's existing model — good news). Each reading has a real timestamp (`readAt`), not just a calendar date, and a `type: PARTIAL | COMPLETE` — posting a `COMPLETE` reading closes the current billing period and opens the next one atomically. The server enforces: index can only increase (422 otherwise), `readAt` can't be in the future or before the period's start, and a contract with `hasExports: false` must never send `exportIndex` (and one with `hasExports: true` must always send it). Editing/deleting is only allowed while the reading's period is still open, and re-derives neighboring deltas automatically.
- **Billing** (`/contracts/:id/estimate`, `/contracts/:id/periods*`): all period/pricing math lives server-side. `getCurrentPeriod` lazily rolls over any period whose `expectedEndDate` has passed (closing it on its last `PARTIAL` reading, flagged `estimatedClose: true`) — there's also a nightly cron doing the same as a convenience, not a correctness requirement. `estimate` returns both the to-date actual charge and a forecast (extrapolated daily average × remaining days), each a full `BillingBreakdown` (imported/exported/net/billable kWh, energy+fixed charge, minimum-charge flag, subtotal, tax, total, and a per-segment breakdown). A period can span a season or month boundary — it's split into priced `segments`, each locked to one tariff version at close time (a `tariffSnapshot` prevents a later scrape from re-stating an already-issued bill).
- **Tariffs** (`/tariffs`): a **global, versioned, admin-managed** catalog, not a per-user setting. Any authenticated user can `GET /tariffs` (list) and `GET /tariffs/:code?at=` (the version in force on a date); only `ADMIN` can `POST /tariffs`, `POST /tariffs/import` (bulk/scraper), or `PATCH /tariffs/:id`. A contract just references a `tariffCode`; the applicable version is resolved by date automatically.
- **Users** (`/users`): admin-only list/create/deactivate; `GET/PATCH /users/:id` allowed for admin-or-self.
- **Errors**: uniform envelope `{statusCode, path, timestamp, message, ...}` — `message` is a **plain string** for most exceptions but a **string array** for class-validator failures (400s). Any shared error-toast helper must handle both.
- **Misc**: global prefix `api/v1`, `GET /health` is public (liveness + Mongo connectivity) and could back a "server unreachable" banner.

## Current State of power-meter (UI)
- React + TypeScript + Vite, with a working JWT auth flow (Phase 1) against the real API: register/login/logout, Bearer header on every request, access-token refresh-and-retry on 401, and session rehydration via `/auth/me` on load.
- Everything **past** auth is still 100% local: `src/state/AppDataProvider.tsx` seeds a single local `AppConfig` + `MeterReading[]` blob into `localStorage` and does its own period/tariff/projection math in `src/domain/{periods,statistics,tariff,validation}.ts`. There is no concept of a `Contract` anywhere in the frontend.
- `src/data/repositories/*` wrap `localStorage`, synchronously — they have no async/paginated shape and will need to become real API clients.

## Architecture decisions & mismatches (read before starting Phase 2)
The backend's data model is *not* a drop-in replacement for the local one. These are the real gaps found while auditing the API, each with a recommended resolution so Phase 2 doesn't stall on design questions mid-implementation:

1. **Missing concept: Contract.** The local model assumes one household/meter per install; the API is contract-centric and a user can own several. *Resolution:* don't build a multi-contract switcher yet. On login, `GET /contracts`; if empty, route to a new one-time "Add your meter" onboarding screen (`POST /contracts`); if one or more exist, use the most recently created as "the" contract. Treat a multi-contract switcher as an explicit non-goal until there's a real need for it.
2. **Tariffs are global and admin-owned**, but Settings' "Tariff & Tiers" tab today lets any user freely edit plan name/tiers/fixed charge/tax rate. *Resolution:* that tab becomes **read-only** for normal users (render the contract's resolved tariff from `GET /tariffs/:code`); full tariff CRUD (`POST/PATCH /tariffs`) is only ever shown to `role === 'ADMIN'`, and should live in a separate admin surface, not bolted onto the regular Settings page — defer building that admin UI until Phase 4, and only if actually needed.
3. **No server concept of a solar "export credit rate."** The API instead **banks** surplus export kWh (`Contract.bankedExportKwh`) forward to offset future imports — there's no distinct $/kWh credit. *Resolution:* drop `SolarConfig.exportCreditRatePerKwh` entirely; the Solar tab becomes just the `hasExports` toggle (`PATCH /contracts/:id`) plus a read-only display of the current banked kWh.
4. **Reading identity differs.** Local readings are keyed by calendar date and upserted once/day; the API keys on an exact `readAt` timestamp with a uniqueness constraint per contract. *Resolution:* always submit `readAt` as local noon converted to an ISO instant, preserving "one reading per day" without colliding with the unique index, and without ever needing to expose a time picker in the UI.
5. **Two billing engines would drift.** Keeping `src/domain/{periods,statistics,tariff}.ts` around while also calling the real `/estimate` and `/periods` endpoints is exactly the parity risk Phase 4 originally worried about. *Resolution:* delete those local calculators once the API wiring lands in Phase 3 rather than maintaining them in parallel "just in case." `domain/validation.ts`'s monotonic check can stay as a client-side fast-fail (the server is still the source of truth and re-validates).
6. **Error shape:** validation failures return `message` as a `string[]`, not a `string`. *Resolution:* one shared `getErrorMessage(error): string` helper (Phase 5, but write it as soon as Phase 2 starts making real mutations, since every new form needs it).

## Implementation Plan

### Phase 1: Infrastructure & Auth ✅ COMPLETED
1. API client (`src/lib/api.ts`): Bearer header via request interceptor, one-shot refresh-and-retry on 401, token storage helpers.
2. Auth flow: real `/auth/register|login|logout|me`, `AppDataProvider` manages `user`/`isAuthenticated`/`authReady` (session rehydration on load), logout revokes the server-side refresh token.
3. Env config: `VITE_API_BASE_URL` matches the API's `PORT`/`API_PREFIX`; `.env` gitignored with an `.env.example`.

### Phase 2: Data Layer & Schema Alignment
1. **Type mapping** — replace the locally-invented shapes in `src/domain/types.ts` with ones that mirror the API DTOs (drop `BillBreakdown`/`BillingPeriod`/`PeriodProjection`/`TariffConfig`/`SolarConfig`, which were locally-computed and have no server equivalent in that shape):

   | Local type today | Replace with (mirrors API) |
   |---|---|
   | `AppConfig` (single blob) | `Contract` (`id, alias, serviceNumber, meterSerial?, address?, customerType, tariffCode, periodDays, billingAnchorDate, hasExports, initialImportIndex, initialExportIndex, bankedExportKwh, isActive`) |
   | `MeterReading` | `Reading` (`id, contractId, billingPeriodId, type: 'PARTIAL'\|'COMPLETE', readAt, importIndex, exportIndex, deltaImportKwh, deltaExportKwh, source, notes?`) |
   | `BillingPeriod` + `PeriodProjection` (locally computed) | `BillingPeriodDto` from `GET /periods*` (`id, sequence, status, startDate, expectedEndDate, actualEndDate?, segments[], totals?`) + `EstimateDto` from `GET .../estimate` (`period, actual, projected, dailyAverage, bankedExportKwh, lastReadingAt, projectionAvailable, projectionUnavailableReason`) |
   | `TariffConfig` (editable) | `TariffDto` (read-only for users): `code, name, category, currency, effectiveFrom, effectiveTo?, summerWindow, seasons[].tiers[], fixedCharge, minimumCharge, taxRate` |
   | `SolarConfig` | dropped — see mismatch #3 above; only `Contract.hasExports` + `Contract.bankedExportKwh` remain |
   | `ProfileConfig` | dropped as a separate local concept — profile display now comes straight from `AuthUser` (`firstName, lastName, email`); there is no local-only address/password to manage since the API has no such user fields |

2. **Repository integration** — replace the synchronous `localStorage`-backed `src/data/repositories/*` with thin async API clients:
   - `contractRepository`: `list()`, `create(dto)`, `get(id)`, `update(id, patch)`, `deactivate(id)`.
   - `readingsRepository`: `list(contractId, query?)` (paginated), `create(contractId, dto)`, `update(id, patch)`, `remove(id)`.
   - `billingRepository`: `estimate(contractId)`, `periods(contractId)`, `period(contractId, periodId)`, `closeCurrent(contractId)`.
   - `tariffRepository`: `resolve(code, at?)` (read-only for regular users).
   - All paginated list endpoints return `{items, meta: {total, page, limit, pages}}` — repositories should return that shape as-is rather than unwrapping it, so callers can page later without a breaking change.
3. **Contract bootstrap / "Sync" flow** — on login (once `authReady`), fetch `GET /contracts`:
   - Zero contracts → route to a new `AddMeterPage` (`/onboarding` or similar) that calls `POST /contracts`. This is the "Link your meter" flow the original plan gestured at, now concretely spec'd against `CreateContractDto`.
   - One or more → hold the most-recent as `contract` in `AppDataProvider`'s context; expose it alongside `user`.
   - `AppDataProvider` needs a new loading phase for this (`contractReady` or folded into `authReady`), same pattern as the Phase 1 session-rehydration fix, to avoid another flash-of-wrong-state.

### Phase 3: Core Feature Migration (Readings & Dashboard)
1. **Reading Entry** (`src/features/reading-entry`): `onSubmit` calls `readingsRepository.create(contract.id, { type: 'PARTIAL', readAt: <local noon, ISO>, importIndex, exportIndex })`. Keep the existing client-side monotonic check as a fast-fail, but surface the server's 422 message (import/export can't decrease) via the shared error helper if it slips through. Add a **separate, explicit** "Close this period" action (calls `POST /contracts/:id/periods/current/close`) rather than exposing `type: COMPLETE` as a hidden option on the daily form — closing a period is a one-way action per period and shouldn't be an accidental side effect of logging a routine reading.
2. **Dashboard** (`src/features/dashboard`): replace `buildBillingPeriods`/`getCompletedPeriods`/`projectCurrentPeriod`/`averageConsumption`/`averageAmountPaid` with two calls: `GET /contracts/:id/estimate` (feeds the "Projected this period" stat card directly from `estimate.projected`/`estimate.actual`) and `GET /contracts/:id/periods` (feeds the "avg. last 3 periods" stats — computed client-side by averaging the last 3 `CLOSED` periods' `totals`, and the consumption/cost chart).
3. **Analytics & Charts** (`ConsumptionCostChart`): feed directly from `periods[].totals.{importedKwh, total}` for `status: CLOSED` periods (API returns newest-first; reverse for a chronological x-axis). Prices are already tax-inclusive and segment-aware server-side, so no local recalculation is needed.

### Phase 4: Complex Logic Translation
1. **Billing projection**: fully covered by Phase 3's `/estimate` wiring — the local `projectCurrentPeriod` and its callers (`ProjectionSummary`) are deleted, not reimplemented, once the API call lands. This is what actually "ensures parity" — there's only one calculation left to drift.
2. **Tariff display** (Settings): a new read-only "Tariff" section rendering `GET /tariffs/:code` for the contract's `tariffCode` (plan name, seasons, tiers, fixed charge, minimum charge, tax rate). No edit form for normal users.
3. **Tariff management (admin-only, stretch goal)**: only build this if there's an actual admin user story — a minimal separate screen (gated on `user.role === 'ADMIN'`, from `/auth/me`) using `POST /tariffs`, `POST /tariffs/import`, `PATCH /tariffs/:id`. Do not merge this into the regular Settings page.
4. **Contract settings**: the current "Solar" and "Billing Period" Settings tabs become `PATCH /contracts/:id` calls — `hasExports` and `periodDays` respectively (both already patchable per the API; changes apply from the *next* period, matching the API's own documented behavior, so the UI copy should say so rather than implying an immediate recalculation).

### Phase 5: QA & Polish
1. **Error handling**: implement `getErrorMessage(error): string` in `src/lib/api.ts` (join `message` when it's an array, pass through when it's a string, fall back to a generic message on network/unknown errors) and use it in every `toast.error(...)` call site, replacing the current ad hoc `error.response?.data?.message` reads.
2. **Loading states**: `Skeleton` for the Phase 2 contract-bootstrap gate, the Dashboard's estimate/periods fetch, and reading submission — mirroring the `authReady` loading-state pattern already established in Phase 1's `AppRoutes`.
3. **Validation sync**: give `LoginPage`/`RegisterPage` real zod schemas (they currently have none, unlike Settings) mirroring the backend's password rule (8–128 chars, upper+lower+digit) so weak passwords fail fast instead of round-tripping a 400. Mirror the reading constraints (`readAt` not in the future, not before the open period's start) as pre-submit checks, with the server remaining the final authority.
4. **Role-aware UI**: hide any admin-only affordance (tariff management, if built) for `role !== 'ADMIN'`, sourced from `AuthUser.role` (needs adding to the frontend's `AuthUser` type, since `/auth/me` already returns it).
5. **Resilience**: a small "can't reach the server" state (backed by `GET /health`, which is `@Public()`) for the contract-bootstrap and dashboard fetches, distinct from the "not authenticated" state.

## API Reference (grounded in current controller code)

| Method & Path | Auth | Notes |
|---|---|---|
| `POST /auth/register` | public | `{email, password, firstName, lastName}` → `AuthTokensDto` |
| `POST /auth/login` | public | `{email, password}` → `AuthTokensDto` |
| `POST /auth/refresh` | refresh token in **body** | `{refreshToken}` → new `AuthTokensDto` (rotates both) |
| `POST /auth/logout` | Bearer | revokes stored refresh token, 204 |
| `GET /auth/me` | Bearer | current `UserResponseDto` (includes `role`) |
| `POST /contracts` | Bearer | opens period #1 immediately |
| `GET /contracts` | Bearer | paginated; own contracts only unless `ADMIN` |
| `GET /contracts/:id` | Bearer | 404s if not owned (unless `ADMIN`) |
| `PATCH /contracts/:id` | Bearer | anchor/opening-index/serviceNumber are immutable |
| `DELETE /contracts/:id` | Bearer | soft-deactivate, 200 |
| `POST /contracts/:id/readings` | Bearer | cumulative indexes; `type: COMPLETE` closes the period |
| `GET /contracts/:id/readings` | Bearer | paginated, filters: `periodId`, `from`, `to`, `type` |
| `GET /readings/:id` / `PATCH` / `DELETE` | Bearer | edit/delete only while the period is open |
| `GET /contracts/:id/estimate` | Bearer | actual + projected `BillingBreakdown` for the open period |
| `GET /contracts/:id/periods` | Bearer | all periods, newest first |
| `GET /contracts/:id/periods/current` | Bearer | rolls an expired period first if needed |
| `GET /contracts/:id/periods/:periodId` | Bearer | one period with segments + totals |
| `POST /contracts/:id/periods/current/close` | Bearer | closes early on the latest reading |
| `GET /tariffs` | Bearer | `?code=` filter |
| `GET /tariffs/:code` | Bearer | `?at=` date, defaults to today |
| `POST /tariffs`, `POST /tariffs/import`, `PATCH /tariffs/:id` | Bearer + `ADMIN` | not needed for the regular user flow |
| `GET /health` | public | liveness + Mongo status |

## Target Dates & Milestones
- [x] Milestone 1: Auth & Basic Connection (Phase 1)
- [ ] Milestone 2: Contract bootstrap + type/repository rewrite (Phase 2)
- [ ] Milestone 3: Reading entry + Dashboard on live data (Phase 3)
- [ ] Milestone 4: Projection parity + tariff display + contract settings (Phase 4)
- [ ] Milestone 5: Error handling, loading states, validation sync, role-aware UI (Phase 5)
