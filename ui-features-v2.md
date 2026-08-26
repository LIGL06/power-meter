# Implementation Plan: UI Features v2

## Overview
Found while auditing `ui-features-v1.md` and `api-implementation-v2.md` against the actual shipped UI (a full bug-hunt pass across both repos, done after v1's six phases all shipped). Unlike that pass's bug fixes, these two are not defects — they're capabilities the **backend already fully supports** that never got a frontend UI, each with a direct textual pointer in the existing docs or a live, unused code path as evidence:

| # | Gap | Phase | Evidence |
|---|---|---|---|
| 1 | Admin user management | Phase 1 | `ui-features-v1.md` Phase 4.1 says outright: *"a separate 'admin user management' screen would be its own future feature, not bundled here."* The backend has full CRUD (`GET/POST /users`, `GET/PATCH/DELETE /users/:id`, all confirmed live in `users.controller.ts`) — the frontend has none of it: `usersRepository` only has `get`/`update`, and no route/page/nav item exists. |
| 2 | Historical period entry editing | Phase 2 | `ui-features-v1.md` Phase 5's own backend spec lists `PATCH /contracts/:id/historical-periods/:entryId — correct a typo` as a real, built, e2e-tested endpoint. `historicalPeriodsRepository.update()` exists and calls it — but nothing in the UI ever calls `.update()` (confirmed via a repo-wide grep: zero call sites outside the repository file itself). `PastBillsSection` only offers create and delete. |

Both are **frontend-only, zero backend work** — Phase 1 uses `/users` routes that already exist and are already covered by e2e ownership/role tests (`api-implementation-v2.md`'s "refuses a non-admin listing users" case, among others); Phase 2 uses the exact `PATCH` endpoint built and tested for `ui-features-v1.md` Phase 5.

Not included here (checked and ruled out as genuine gaps, not oversights):
- **Multi-contract switching** — `api-implementation-v2.md` architecture decision #1 marks this an explicit non-goal, not a deferred feature.
- **`contractRepository.get(id)`** — also unused, but not a gap: `MeterTab` already displays the full contract record straight from context (refreshed after every mutation), so a redundant fetch-by-id would duplicate data already in hand, not add a capability.
- **`usersRepository.get(id)` for the current user** — deliberately unused per `ui-features-v1.md` Phase 4.1's own reasoning: `AuthUser` on context already carries everything the Profile tab needs. (Phase 1 below *does* need a `list`, which doesn't exist yet.)

## Phase 1: Admin user management

### What the backend already does (`users.controller.ts`, confirmed live)
| Method & Path | Auth | Notes |
|---|---|---|
| `GET /users?page=&limit=` | `ADMIN` | Paginated `{items: UserResponseDto[], meta}`, same envelope as `contracts`/`readings` |
| `POST /users` | `ADMIN` | `{email, password, firstName, lastName, role?, isActive?}` — the only path that can set `role` to anything other than `USER` |
| `GET /users/:id` | `ADMIN` or self | Already has a repo method (`usersRepository.get`), unused for this case since Profile uses context instead |
| `PATCH /users/:id` | `ADMIN` or self | Non-admin actor sending `role`/`isActive` gets a `403` (`UsersService.update`, confirmed in source) — so only an admin editing *someone else* (or themselves) can actually change those two fields |
| `DELETE /users/:id` | `ADMIN` | Soft-deactivate (`isActive: false`, refresh token revoked), returns `200` with the updated user |

`UserResponseDto` (`id, email, firstName, lastName, role, isActive, createdAt, updatedAt`) is already mirrored field-for-field by the frontend's existing `UserProfile` type — no new response type needed.

### A real risk found while researching this (read before building)
**No self-lockout guard exists anywhere in the stack.** `UsersService.update`'s only check is `assertSelfOrAdmin` plus "non-admin can't touch role/isActive" — there is nothing stopping an admin from `PATCH`-ing their *own* record to `role: 'USER'`, or `DELETE`-ing their own account, via this same API. Today that's a non-issue because no UI can reach these endpoints at all; once this phase ships a UI that can, it becomes reachable with one misclick and has no recovery path short of DB access. **Resolution:** client-side guard only (matches the scope of this phase — a backend fix would be a separate, deliberate hardening task, not bundled here): disable the role-select, the active toggle, and the deactivate action on the row where `row.id === user.id`, with a tooltip explaining why.

### Frontend additions
1. **Types** (`domain/types.ts`): reuse `UserProfile`/`Role` as-is. Add `CreateUserDto` (`email, password, firstName, lastName, role?, isActive?`) mirroring the backend's `CreateUserDto`.
2. **`usersRepository`**: add `list(params?: {page?, limit?})` and `deactivate(id)`, matching `contractRepository`'s existing shape for the same two operations exactly (same pagination params, same soft-delete semantics). `create(dto)` too, for the "add a user directly" case (mainly useful for seeding a second admin without DB access).
3. **New page** `src/features/admin/users/AdminUsersPage.tsx`, **route** `/admin/users`, **nav item** "User Management" added to `ADMIN_NAV_ITEMS` in `AppShell.tsx` — gated exactly like `/admin/tariffs` already is (`role === 'ADMIN'` only, **not** gated on `!contract`, per `ui-features-v1.md` architecture decision #5: an admin's job may have nothing to do with their own meter).
4. **Table**: email, name, role badge, active/inactive badge, created date — paginated the same way `ReadingHistoryPage` already paginates (`page`/`pages` state, Previous/Next buttons).
5. **Per-row actions**: role changed via a small `Select` (`USER`/`ADMIN`), active/inactive via a `Switch` — both firing `PATCH` directly on change (mirrors `SolarTab`'s "toggle, then Save" pattern, or fires immediately like `AdminTariffsPage`'s edit flow; pick one convention consistently). Deactivate behind the same inline two-step confirm used everywhere else in this app (`MeterTab`, `ReadingHistoryPage`) — never a native `window.confirm`.
6. **"New user" form**: email/password/firstName/lastName + a role selector, reusing `registerSchema`'s password-complexity rule (`authSchema.ts`) since `CreateUserDto`'s password rule is identical to `RegisterDto`'s (both derive from the same backend `CreateUserDto`).
7. Editing a user's own name/email stays exclusively self-service via their own Profile tab — this screen never edits `firstName`/`lastName`/`email` for anyone, admin-editable fields here are deliberately limited to `role`/`isActive`, to avoid two screens both claiming ownership of the same profile fields.

## Phase 2: Historical period entry editing

### What the backend already does
`PATCH /contracts/:id/historical-periods/:entryId` — built and e2e-tested in `ui-features-v1.md` Phase 5 ("corrects a typo via PATCH without disturbing other fields" test, still green). Accepts a partial `UpdateHistoricalPeriodDto` (every field optional). `historicalPeriodsRepository.update(contractId, entryId, patch)` already exists at the repository layer.

### Frontend additions
1. **`PastBillsSection`** (`SettingsPage.tsx`): add an "Edit" button per row, next to the existing "Delete". Clicking it loads that entry into the *same* create form (start/end date, kWh, total, notes) and switches the submit button to "Save changes", calling `.update()` instead of `.create()`.
2. **Reuses `historicalPeriodSchema`/`HistoricalPeriodFormValues` as-is** — no new validation needed; the same start-before-end and non-negative checks apply equally to a correction.
3. **Reset-on-load, not reset-in-click-handler.** `AdminTariffsPage`'s `VersionEditor` hit a real bug from doing this the naive way (`reset(...)` called synchronously inside the "Edit" button's `onClick`, in the same tick as the state update that also toggled other props — several top-level fields silently kept stale values). The fix that shipped there — moving the `reset()` call into a `useEffect` keyed on the edit target itself — is the pattern to reuse here directly, not rediscover.
4. Dates round-trip the same way they do on create: a bare `type="date"` input value converted via `new Date(value).toISOString()` on submit, and the entry's own stored `startDate`/`endDate` sliced to `YYYY-MM-DD` (`.slice(0, 10)`) when loading it back into the form — matching the UTC-midnight calendar-day convention already established for every other date field in this app.

## Milestones
- [ ] Milestone 1: Admin user management (Phase 1)
- [ ] Milestone 2: Historical period entry editing (Phase 2)
