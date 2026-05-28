# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite)
npm run build      # Production build
npm run lint       # ESLint
npm run preview    # Preview production build locally
```

There is no test suite. Type-checking is done via `tsc --noEmit` (implied by the build step).

## Architecture Overview

This is a Spanish-language accounting SPA (Libro Diario / Ledger Magic) built with React + TypeScript + Vite, backed by Supabase. The UI uses shadcn/ui components throughout.

### Data layer — `src/accounting/`

All persistence goes through the `IDataAdapter` interface in `data-adapter.ts`. There are two implementations:

- **`LocalAdapter`** — reads/writes `localStorage`. Used as fallback when Supabase is unreachable.
- **`SupaAdapter`** — reads/writes Supabase tables. Uses `fetchAllPaginated()` (1000-row chunks) to bypass PostgREST's silent 1000-row limit.

`pickAdapter()` probes Supabase at startup and returns `SupaAdapter` if reachable, otherwise `LocalAdapter`.

**`AccountingProvider`** (React context) loads all data once at startup via the adapter and exposes it plus setters. Every page reads from this context via `useAccounting()`.

### Core domain types — `src/accounting/types.ts`

Key entities:
- `Account` — chart of accounts; `type` ∈ `{ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO}`, `normal_side` ∈ `{DEBE, HABER}`.
- `JournalEntry` + `JournalLine` — double-entry ledger entries; `id` format is `NNN-QN-YY` (e.g. `001-Q1-25`).
- `AuxiliaryLedgerDefinition` / `AuxiliaryLedgerEntry` / `AuxiliaryMovementDetail` — sub-ledgers linked to specific accounts.
- `KardexDefinition` / `KardexMovement` — inventory kardex (perpetual inventory) per account.
- `Shipment` / `ShipmentProduct` — import shipment module (see `shipment-types.ts`).

### Financial calculation utilities — `src/accounting/`

- `utils.ts` — `round2()` for all monetary values, `round6()` for unit costs, `generateEntryId()` / `generateChronologicalEntryId()`, `signedBalanceFor()`, locale-aware `fmt()` (Bolivian locale `es-BO`).
- `kardex-utils.ts` — `calculateCPP()` computes Weighted Average Cost (Costo Promedio Ponderado) for a sequence of kardex movements.
- `period-utils.ts` — unified monthly/quarterly/annual period resolution; `resolvePeriod()` is the entry point for report filtering.
- `quarterly-utils.ts` — quarter boundaries; `getQuarterIdentifier(date)` returns the `QN-YY` suffix used in entry IDs.

### Auth & access control — `src/components/auth/` + `src/contexts/UserAccessContext.tsx`

- `AuthProvider` wraps Supabase auth.
- `UserAccessProvider` checks `user_roles` table for `owner` vs `viewer` role.
  - **owners** see all routes including `/settings`, `/shipments`, `/inventory`, `/sales`.
  - **viewers** only see their dashboard plus permitted accounting views; `targetUserId` switches to the owner's data.
- Route guarding lives in `App.tsx` (not in `router.tsx`, which is an older unused file).

### Pages and components

Pages are thin shells in `src/pages/<module>/Index.tsx`; heavy logic lives in components under `src/components/<module>/`.

The journal entry form uses `useJournalForm` hook (`src/hooks/useJournalForm.ts`) which manages line drafts, account selection, and kardex popup coordination. Kardex popup state is held in the journal page and passed down.

### Services — `src/services/`

- `exportService.ts` — generic CSV export.
- `pdfService.ts` — jsPDF-based PDF generation.
- `backupService.ts` — JSON export/import of all data.
- `auditService.ts` — audit log utilities.
- `aiService.ts` — AI assistant integration.

### Supabase integration

Client lives in `src/integrations/supabase/client.ts`. Migrations are in `supabase/migrations/`. The Supabase project URL/key come from `.env` (not committed).

### Locale & currency

All amounts are in Bolivianos (Bs). Number formatting uses `es-BO` locale (dot as thousands separator, comma as decimal). Input parsing in `toDecimal()` handles both `1.234,56` and `1234.56` forms. Use `round2()` for all monetary arithmetic to avoid floating-point drift.
