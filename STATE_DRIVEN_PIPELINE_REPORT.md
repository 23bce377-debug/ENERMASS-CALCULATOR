# State-Driven Quotation Pipeline — Implementation Report

**Date:** 2026-06-28
**Scope:** Make the selected state the single source of truth for subsidy, presets, and Terms & Conditions across the quotation pipeline, fully database-driven, without breaking existing functionality.

---

## 1. Objective

Previously, users had to manually configure state-dependent items that should follow from one choice:

- **Subsidy** was DB-backed but required manually picking a scheme in the UI, and the client hardcoded `PM_SURYA_GHAR_2024`. The RPC also ignored per-state top-ups.
- **Presets** (`systems`) were not state-scoped — every state showed the same list, creating duplicate/irrelevant entries.
- **Terms & Conditions** had no DB master — defaults were hardcoded (Kerala-specific) in two places; the DISCOM name was hardcoded too.
- **PDF** forced every section onto its own page and contained informal/Kerala-specific wording.

**Goal achieved:** selecting a state now auto-loads subsidy, presets, and editable T&C. Adding a new state requires inserting database rows only — no code changes.

---

## 2. Decisions confirmed with you

1. **Migrations delivered as files**, applied to a Supabase branch / test state first, then promoted to prod (no direct prod writes).
2. **Subsidy UX:** auto-applied from state + project type, with a single "Apply Subsidy" on/off toggle (no scheme picker).
3. **One comprehensive plan**, then built in ordered phases.

---

## 3. What was delivered, by phase

### Phase 0 — Database (files only)
- `supabase/migrations/202607040000_state_driven_pipeline.sql` — additive, idempotent, ID-free:
  - `state_rules.discom_name` + backfill of representative DISCOMs for all 12 states.
  - `system_state_availability` (system↔state junction). **Rule: a system with no rows is global** (shown for all states) → existing presets unchanged.
  - `state_terms_templates` (`clauses` JSONB; one active row per state; `state_id NULL` = global default).
  - `calculate_state_subsidy(state_code, capacity_kw, project_type)` RPC — resolves the scheme from project type, adds `additional_state_subsidy`, applies the cap.
  - Seeds: professional global-default T&C + Kerala/Gujarat templates.
  - Ensures `quotes.terms_json` exists.
- `supabase/rollbacks/202607040000_state_driven_pipeline_rollback.sql` — clean reversal.
- `schema.sql` — updated to mirror all new objects.
- `scripts/validate_state_pipeline.js` — branch validator.

**Safety guarantee:** for a residential state **without** an override, `calculate_state_subsidy` returns the **same** amount as the legacy `calculate_subsidy`, so existing quote math is unchanged. The non-zero top-up path is exercised only by the validator inside a rolled-back transaction — never seeded into prod.

### Phase 1 — Server loaders
- `src/app/api/erp/master/rules/route.ts` — added the three datasets to the existing batched `Promise.all`; cache key bumped to `v2`.
- `src/lib/cache/server-cache.ts` — `getRulesMaster` loads the new datasets; cache key → `master-rules-v2`.
- `src/lib/cache/masterCache.ts` — loads new datasets + `discom_name`; `CACHE_VERSION` 3.0.0 → 3.1.0.
- `src/lib/cache/masterCacheTypes.ts` — added `discom_name`, `CachedSystemStateAvailability`, `CachedStateTermsTemplate`, and the `MasterData` fields.

No new DB round-trips beyond the existing batched queries.

### Phase 2 — State-driven subsidy + toggle
- `src/lib/store/calculatorStores/subsidyStore.ts` — calls `calculate_state_subsidy` (state + project type); clears the value on error so the engine falls back cleanly.
- `src/lib/engine/calculator.ts` — `applySubsidy` is the source of truth (legacy `selectedScheme` retained for back-compat); server value authoritative, local slab fallback for offline.
- `src/components/calculator/SummaryCard.tsx` — replaced the scheme dropdown with a single "Apply Subsidy" toggle (disabled for commercial); label derived from the state.
- State changes already re-trigger subsidy via `setState` / `setProjectType`.

### Phase 3 — State-scoped presets
- `src/lib/store/calculatorStores/calculationStore.ts` — new `buildStateScopedMaps()` helper builds `dbSystemStateMap` and `dbStateTerms` from the bootstrap (online + offline paths).
- `src/components/calculator/SystemPresetDropdown.tsx` — filters presets to the selected state (unmapped = global).
- `src/lib/store/calculatorTypes.ts` — added `dbSystemStateMap` / `dbStateTerms` store fields.

### Phase 4 — State-specific, editable T&C
- `src/components/calculator/QuoteSaveModal.tsx` — `resolveStateTerms()` loads the state template (state → global default → fallback) into the editable terms; existing quotes keep their own snapshot; replaced the Kerala-specific `DEFAULT_TERMS` with a professional, state-agnostic fallback. Saving snapshots edits into `quotes.terms_json` only — the master template is never mutated.
- `src/lib/pdf/buildViewModel.ts` — terms fallback chain (quote → state template → global default); DISCOM name from `state_rules.discom_name`; professionalized the hardcoded default terms.

### Phase 5 — PDF formatting & wording (no redesign)
- `src/lib/pdf/templates/quote.hbs`:
  - Sections now **flow naturally** instead of one-per-page; the cover remains a dedicated full page; inner blocks keep `break-inside: avoid`.
  - Footers became section dividers; the 9 hardcoded "Page N of 10" labels were neutralized (they would be wrong once sections flow).
  - Professionalized the introduction-letter copy.
- **Render-verified** with system Chrome (via `preview.html`): document went from **10 rigid pages to 8 flowing pages**, cover intact, **no blank pages, no overflow**, tables split cleanly with repeated headers.

### Phase 6 — Verification
- `npm run build` — passes (clean TypeScript compile across all changes).
- `npx vitest run` — **277/280 pass**, including all engine/subsidy/masterCache suites.
- Updated `__tests__/masterCache.test.ts` version assertion to 3.1.0 (matches the intentional bump).
- The 3 remaining failures are **pre-existing** `deviceBindingFrontend` jsdom `localStorage` errors, unrelated to this work (device binding was removed in an earlier migration).

---

## 4. Files changed

**Created (3 in-repo):**
`supabase/migrations/202607040000_state_driven_pipeline.sql`,
`supabase/rollbacks/202607040000_state_driven_pipeline_rollback.sql`,
`scripts/validate_state_pipeline.js`

**Modified (15):**
`schema.sql`,
`src/app/api/erp/master/rules/route.ts`,
`src/lib/cache/server-cache.ts`,
`src/lib/cache/masterCache.ts`,
`src/lib/cache/masterCacheTypes.ts`,
`src/lib/store/calculatorStores/subsidyStore.ts`,
`src/lib/engine/calculator.ts`,
`src/lib/store/calculatorTypes.ts`,
`src/components/calculator/SummaryCard.tsx`,
`src/lib/store/calculatorStores/calculationStore.ts`,
`src/components/calculator/SystemPresetDropdown.tsx`,
`src/components/calculator/QuoteSaveModal.tsx`,
`src/lib/pdf/buildViewModel.ts`,
`src/lib/pdf/templates/quote.hbs`,
`__tests__/masterCache.test.ts`

---

## 5. Backward compatibility

- All schema changes are additive; "no mapping = global" keeps every existing preset and quote valid.
- Legacy `calculate_subsidy` RPC and `selectedScheme` field retained.
- Existing quotes (with populated `terms_json`) render unchanged.
- Caching preserved; no extra DB round-trips.

---

## 6. Not done by me / your action items

I could not apply or validate against the live database — the connected Supabase MCP is bound to a different account (`estateflow-crm` / `construction-erp`), and direct prod access was blocked per the "no prod" preference.

1. Apply `supabase/migrations/202607040000_state_driven_pipeline.sql` to a **Supabase branch / shadow DB**.
2. Run `DATABASE_URL="<branch-url>" node scripts/validate_state_pipeline.js` — expect all checks to pass.
3. (Optional) Assign presets to states by inserting `system_state_availability` rows, and customize state T&C in `state_terms_templates`.
4. Render a real quote PDF end-to-end, then promote the migration to production.

---

## 7. How a new state is added afterwards (no code change)

1. Insert a row into `state_rules` (with `discom_name`).
2. (Optional) Insert into `state_scheme_overrides` for an extra state subsidy / cap.
3. (Optional) Insert into `state_terms_templates` for a state-specific T&C set.
4. (Optional) Insert into `system_state_availability` to scope presets to that state.

The calculator, subsidy, presets, T&C, and PDF all pick it up automatically.
