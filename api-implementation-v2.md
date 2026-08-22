# Implementation Plan: Integrating power-meter-api into power-meter UI [PHASE 1 COMPLETE]

## Phase 1: Infrastructure & Auth ✅ COMPLETED

## Overview
The goal is to integrate the `power-meter-api` (NestJS/MongoDB backend) features into the `power-meter` React application. This involves migrating local data models to API integrations, implementing authentication, and syncing the complex billing logic.

## Analysis of source: power-meter-api
- **Core Entities**: Users, Contracts (linked to specific tariffs), Readings (cumulative values), Tariffs (versioned/segmented pricing).
- **Key Logic**: Segmented calculation where periods are split based on seasonality and month boundaries.
- **Features**: Projections for future costs, tiered pricing support, and historical data tracking.

## Current State of power-meter (UI)
- React + TypeScript + Vite.
- Existing local state management (`src/state`).
- Local domain models in `src/domain`.
- Basic features like reading entry and dashboard are partially implemented with mock data or simplified logic.

## Implementation Plan

### Phase 1: Infrastructure & Auth
1. **API Client Setup**: Create an Axios/Fetch wrapper in `src/lib` to handle base URLs, headers (Bearer token), and error handling.
2. **Authentication Flow**: Implement login/register pages using the `/auth` endpoints. Update `AppDataContext` to manage JWT tokens and user state.
3. **Environment Configuration**: Sync `.env` variables from the API spec (PORT, API_PREFIX, etc.) into the frontend environment configuration.

### Phase 2: Data Layer & Schema Alignment
1. **Type Mapping**: Map the backend's DTOs to TypeScript types in `src/domain/types.ts`.
2. **Repository Integration**: Update `src/data/repositories` to fetch data from the API instead of local storage or mock files.
3. **Contract Syncing**: Implement a "Sync" or "Link" flow where users can map their physical meter details to the backend contract system.

### Phase 3: Core Feature Migration (Readings & Dashboard)
1. **Reading Entry**: Connect `src/features/reading-entry` to the `/contracts/:id/readings` endpoint.
2. **Dashboard Updates**: Update `src/features/dashboard` to display real-time data from the API. Replace local calculation logic with calls to the backend's estimation endpoints (`/contracts/:id/estimate`).
3. **Analytics & Charts**: Use the data provided by the API (including pre-calculated deltas) to populate charts in `src/components/ui/chart.tsx`.

### Phase 4: Complex Logic Translation
1. **Billing Projection**: Replace local projection logic with the backend's calculation results, ensuring parity between UI display and actual billed amounts.
2. **Tariff Management**: Implement a settings page to view/manage tariff details (if applicable for admins or specific user roles).

### Phase 5: QA & Polish
1. **Error Handling**: Add "Toast" notifications for API errors (e.g., expired tokens, failed validations).
2. **Loading States**: Ensure `Skeleton` components are used during API fetch cycles.
3. **Validation Sync**: Align frontend validation rules with the backend's Joi/class-validator logic where possible.

## Target Dates & Milestones
- [ ] Milestone 1: Auth & Basic Connection (Week 1)
- [ ] Milestone 2: Data Synchronization (Week 2)
- [ ] Milestone 3: Dashboard & Analytics Integration (Week 3)
- [ ] Milestone 4: Final Polish & Bug Fixing (Week 4)
