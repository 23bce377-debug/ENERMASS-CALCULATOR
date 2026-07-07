# ENERMASS Solar ERP

ENERMASS Solar ERP is a DB-backed solar pricing, quotation, master-data, and operations application built with Next.js App Router, React, Supabase, PostgreSQL, Zustand, TanStack Query, Upstash Redis, and server-side PDF generation.

The app is used to:

- Build solar system quotations from state-wise system presets.
- Resolve panels, inverters, batteries, structures, accessories, subsidy rules, GST, rate overrides, and terms from database masters.
- Generate and store formal quote PDFs.
- Maintain quote status, revisions, surveys, and rate comparison reports.
- Manage reusable system presets and reusable BOM preset sets.
- Maintain master data with import/export, bulk edit, history, and audit trails.
- Enforce organisation isolation, licensing, device binding, and super-admin controls.

This README is the primary functional and engineering guide for the current codebase.

---

## Contents

1. Product map
2. Tech stack
3. Local setup
4. Environment variables
5. Application shell and navigation
6. Calculator flow
7. System presets flow
8. BOM presets flow
9. Masters flow
10. Quotes and PDF flow
11. Settings, profile, and access control
12. Super admin and SaaS controls
13. Operations modules
14. Data model and database rules
15. Caching, sync, and invalidation
16. Calculation engine
17. Import/export behavior
18. Modals, drawers, popups, and small UI flows
19. Important source files
20. Testing and verification
21. Deployment
22. Development rules and maintenance checklist

---

## 1. Product Map

Primary user-facing modules:

| Module | Route | Purpose |
| --- | --- | --- |
| Calculator | `/calculator` | Build live solar quote calculations and create quote PDFs. |
| Systems | `/systems` | Browse, filter, duplicate, edit, delete, and quick-load state-wise system presets. |
| Quotes | `/quotes`, `/quotes/[id]` | Manage saved quotes, statuses, revisions, generated PDFs, and rate checks. |
| Masters | `/master` | Dashboard for equipment, pricing, BOM, subsidy, structure, and terms masters. |
| Settings | `/settings` | Organisation defaults, theme, margins, billing, users, devices, and security. |
| Profile | `/profile` | User profile, password recovery, and personal account details. |
| Master Control | `/super-admin/*` | Super-admin-only organisation, plan, subscription, key, device, and audit controls. |

Secondary/operational modules:

| Module | Route | Purpose |
| --- | --- | --- |
| Management Dashboard | `/dashboard/management` | Company-level metrics and management overview. |
| Dashboards | `/dashboards` | Sales and operational dashboards. |
| Inventory | `/inventory`, `/inventory/bulk-update`, `/inventory/receipt/[movementId]` | Inventory stock, valuation, receipts, and bulk changes. |
| Procurement | `/procurement`, `/procurement/purchase-orders` | Procurement workflow and purchase orders. |
| Reports | `/reports`, `/reports/gst`, `/reports/net-metering`, `/reports/vendor-retention` | GST, net-metering SLA, and vendor retention reporting. |
| Service | `/service/amc`, `/service/warranty` | AMC and warranty service pages. |
| Survey | `/survey/mobile` | Mobile survey workflow. |

Public/system routes:

| Route | Purpose |
| --- | --- |
| `/login` | Supabase login. |
| `/activate` | Activation-key onboarding. |
| `/forgot-password` | Password reset request. |
| `/email-not-confirmed` | Email confirmation prompt. |
| `/device-blocked` | Device binding block page. |
| `/device-reset-request` | Device reset request flow. |
| `/subscription-expired` | Subscription enforcement page. |
| `/unauthorized` | Permission denied page. |

---

## 2. Tech Stack

Core runtime:

- Next.js `16.2.6`
- React `19.2.4`
- TypeScript
- Tailwind CSS v4
- Zustand for calculator state
- TanStack Query for server data, optimistic updates, and cache invalidation
- Supabase Auth, Database, Storage, RLS, and RPC functions
- PostgreSQL via Supabase
- Upstash Redis for cache and rate limiting where configured
- Puppeteer Core plus Chromium for PDF generation
- Handlebars for quote template rendering
- Vitest and Testing Library for unit/component verification
- Playwright config for browser tests

Key package scripts:

```bash
npm run dev
npm run build
npm run start
npm run test
npm run preflight
npm run saas:preflight
npm run saas:test
```

Node requirement:

```bash
node >= 20.9.0
```

---

## 3. Local Setup

Install dependencies:

```bash
npm install
```

Copy env template:

```bash
copy .env.example .env.local
```

Start local development:

```bash
npm run dev
```

Run type check:

```bash
npx tsc --noEmit --pretty false
```

Run tests:

```bash
npm run test
```

Build for deployment:

```bash
npm run build
```

The app assumes database migrations have been applied to Supabase. If an RPC is missing, features such as quote saving, preset replacement, subsidy creation, or duplicate flows can fail even if the UI compiles.

---

## 4. Environment Variables

See `.env.example`.

Required public app values:

```env
NEXT_PUBLIC_APP_NAME=ENERMASS Solar Calculator
NEXT_PUBLIC_COMPANY_NAME=ENERMASS Solar
NEXT_PUBLIC_SITE_URL=https://your-vercel-domain.vercel.app
```

Required Supabase values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_REF=your-project-ref
SUPABASE_ACCESS_TOKEN=your-supabase-management-token
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

Required security and auth values:

```env
JWT_SECRET=your-jwt-signing-secret
NEXT_PUBLIC_JWT_EXPIRY=7d
ACTIVATION_KEY_ENCRYPTION_SECRET=your-64-character-hex-secret
ACTIVATION_KEY_CURRENT_VERSION=1
```

Optional but recommended infrastructure:

```env
UPSTASH_REDIS_REST_URL=https://your-redis-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-token
CRON_SECRET=your-cron-secret
DISCORD_WEBHOOK_URL=
```

If Upstash is not configured, Redis helpers fall back to server-side in-memory cache where supported.

---

## 5. Application Shell and Navigation

Main shell files:

- `src/app/layout.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Providers.tsx`
- `src/app/globals.css`

Shell behavior:

- Auth is checked on every protected page.
- Public pages are allowed without a session.
- Logged-out users are redirected to `/login`.
- The sidebar is shown on desktop.
- A mobile tab bar is used on smaller screens.
- Sidebar collapse state is persisted in `localStorage`.
- Quote count is hydrated from DB-backed quote hooks.
- Super admins see `Master Control`; normal users do not.
- Vendor manager/backend pieces may exist but the UI route is intentionally hidden unless re-enabled.

Global helpers loaded by `AppShell`:

- `ToastProvider` for notifications.
- `ConfirmProvider` for destructive action confirmations.
- `CommandPalette` opened with `Ctrl/Cmd + K`.
- `KeyboardHelpModal` opened with `?`.
- `OnboardingTour` for first-run guidance.
- `OfflineBanner` for network/sync visibility.
- `SyncConflictResolver` for offline conflict handling.
- `PwaPrompt` for install/shortcut prompt behavior.

Header behavior:

- Calculator header displays selected system context.
- Systems header displays `Engineering / System Presets`.
- Quotes header displays `CRM / Quote Management`.
- Masters header displays `Masters / Master Data Management`.
- Settings header displays `System / Organization Settings`.

Theme behavior:

- Theme is managed by `src/lib/hooks/useTheme.tsx`.
- `html.light` and `html.dark` define semantic colors in `globals.css`.
- Use semantic classes such as `bg-background`, `bg-surface`, `text-text-primary`, `text-text-muted`, `border-border`, and `text-accent`.
- Avoid hard-coded dark surfaces for loading or empty states.

---

## 6. Calculator Flow

Main files:

- `src/app/calculator/page.tsx`
- `src/app/calculator/loading.tsx`
- `src/app/calculator/CalculatorContent.tsx`
- `src/app/calculator/CalculatorClient.tsx`
- `src/lib/store/calculatorStore.ts`
- `src/lib/store/calculatorStores/*`
- `src/lib/engine/calculator.ts`

Server bootstrap:

1. `CalculatorContent` calls `requireLicensedPage`.
2. It resolves `orgId`.
3. It fetches equipment and rules in parallel:
   - `getEquipmentMaster(orgId)`
   - `getRulesMaster(orgId)`
4. It starts deferred fetches for:
   - `getStructuresMaster(orgId)`
   - `getOrgContext(orgId)`
5. It passes all data to `CalculatorClient`.

Loading state:

- `src/app/calculator/loading.tsx` renders a theme-aware loading screen.
- Background uses `bg-background`.
- Spinner uses `text-accent`.
- Loading text uses `text-text-muted`.

Calculator left/control area:

- System preset dropdown loads built-in and DB presets.
- Installation state selector uses DB states when available, fallback static states otherwise.
- Project type toggles residential/commercial behavior.
- Round-to-1000 toggle adjusts final pricing and pushes the adjustment into panel totals.
- Save Draft stores a draft quote.
- Create Quote PDF opens the quote creation wizard.
- Share uses browser share API or clipboard fallback.

Calculator right/content area:

- `EquipmentSelector` handles panels, inverters, batteries, structures, meters, lightning arresters, and related engineering selections.
- `ValidationPanel` warns about configuration issues.
- `BOMTable` displays calculated line items and editable overrides.
- `DiscountPanel` applies flat or percentage discount.
- `AdditionalCostsPanel` adds manual extra costs.
- `SummaryCard` displays totals, GST, subsidy, margin, and customer price.
- `EnergyCard` displays generation estimates.
- `ROIDisplay` displays payback and long-term return estimates.

Calculator state:

The composed Zustand store includes:

- Selected system and state.
- Project type and ITC eligibility.
- Margin mode and target values.
- Output GST override.
- Panel mix, inverter mix, battery mix.
- Structure selection and structure pricing mode.
- Meters and lightning arrester selections.
- BOM row overrides.
- Disabled BOM rows.
- Custom BOM rows.
- Discounts.
- Additional costs.
- Round pricing toggle.
- Quotes and active quote ID.
- DB master payloads.

Row editing behavior in BOM:

- Quantity, rate, GST, description, remarks, and unit can be overridden where supported.
- Reset action clears row override and returns to resolved master value.
- Disabled rows remain visible but calculate as zero.
- Custom rows can be added and removed.
- Dropdown-driven rows must remain reselectable after an item has been selected.

Panel mix behavior:

- Multiple panels can be selected together.
- Panel quantities contribute to effective panel capacity.
- Panel price calculation must use the selected panel mix, not only the first panel.
- Round pricing adjustment is applied consistently to panel totals.

Structure behavior:

- Structure can be weight-based, flat, or per-watt depending on selected DB data.
- Structure vendor/material rates resolve from DB.
- Walkway and ladder lengths can add structure accessories.
- Component mix can be edited for detailed structure items.

Subsidy behavior:

- Residential/commercial selection affects subsidy eligibility.
- Subsidy schemes, slabs, state overrides, and caps come from DB where available.
- Quote snapshots preserve subsidy values at quote creation time.

Draft behavior:

- Calculator can auto-save local/current draft state.
- DB-backed `draft_quotes` are used for recoverable draft work.
- On reload, a compatible draft can be restored.

---

## 7. System Presets Flow

Main files:

- `src/app/systems/page.tsx`
- `src/components/presets/PresetEditorDialog.tsx`
- `src/components/presets/DuplicatePresetChoiceDialog.tsx`
- `src/components/presets/CatalogItemPicker.tsx`
- `src/lib/actions/presets.ts`
- `src/backend/orm/system.ts`

Purpose:

- Maintain state-wise reusable system configurations.
- Load presets into Calculator.
- Duplicate presets to create new variants.
- Edit core components and BOM lines.
- Delete or hide presets safely.

Systems page views:

- Grid/card view.
- List/table view for long preset names.
- State filter.
- Category filter: All, On-Grid, Hybrid, Upgrade, 3-Phase, Micro-Inverter, Commercial.
- Search.
- Quick Calculate action.
- Edit action.
- Duplicate action.
- Delete action.

State behavior:

- Presets are state-associated.
- The UI can display all states or one selected state.
- Loading a preset into Calculator should also select its state in Calculator.
- Global/all-state presets are avoided for the current production preset set unless explicitly reintroduced later.

Create/edit preset journey:

`PresetEditorDialog` is a staged workflow:

1. Basics
   - Preset name.
   - State.
   - Goal wattage/capacity.
   - Target margin.
   - Preset category/type.
2. Core components
   - Panels only in panel section.
   - Inverters only in inverter section.
   - Batteries only in battery section.
   - Mounting structure selection.
   - First panel quantity can auto-fill to satisfy goal wattage.
3. BOM items
   - Add saved non-core BOM items.
   - Add custom items.
   - Import a BOM preset.
   - Choose whether to keep existing items or replace existing items when importing into an existing preset.
   - Duplicate catalog items are skipped/blocked according to validation.
4. Review
   - Final state, capacity, component, and BOM summary.
   - Save writes the preset and items.

Duplicate preset flow:

1. User clicks duplicate.
2. `DuplicatePresetChoiceDialog` asks whether to edit now or later.
3. Later:
   - Saves immediately with a unique name like `Preset Name (1)`.
4. Edit now:
   - Creates a duplicate and opens it in the staged preset editor.
5. Every item detail is copied, including BOM rows, source references, rates, quantities, GST, notes, and selected state.

Atomic persistence:

- System items are replaced with `replace_system_items_atomic`.
- This prevents partial deletion/partial insert states.
- Saving a full preset must be treated as one transaction.

Important validation rules:

- Preset name cannot be blank.
- State is required.
- Capacity/goal wattage must be positive.
- Core catalog rows must remain in their matching sections.
- Duplicate catalog keys are blocked during BOM preset imports.
- Save failures should surface actionable messages, not empty `{}` errors.

---

## 8. BOM Presets Flow

Main files:

- `src/app/master/bom-presets/page.tsx`
- `src/components/presets/BomPresetMaster.tsx`
- `src/components/presets/CatalogItemPicker.tsx`
- `src/lib/actions/presets.ts`
- `supabase/migrations/202607060019_bom_presets.sql`
- `supabase/migrations/202607060021_preset_item_taxonomy.sql`

Purpose:

- Create reusable groups of non-core BOM items.
- Reuse those groups while creating or editing system presets.
- Speed up creation of common sets such as protection kits, cable kits, earthing sets, civil/logistics sets, and miscellaneous items.

Current UI behavior:

- BOM Preset Master appears as a normal tile in Masters dashboard.
- BOM Presets appears as a normal tab in master navigation.
- The UI contains:
  - Preset list.
  - Search.
  - Name field.
  - Description field.
  - Items table.
  - Add saved BOM item.
  - Add custom item.
  - Save set.
  - Delete set.

Adding saved BOM items:

- User clicks a subcategory button or browse-all control.
- `CatalogItemPicker` opens.
- If browsing all:
  - Category and subcategory filters are shown.
- If opened from a subcategory:
  - The picker focuses on subcategories/items only.
  - It does not show redundant category and subcategory columns.
- Search can match item name, SKU, subcategory, specs, unit, and rate.
- Selected items are added to the current BOM preset.

Adding custom BOM items:

- User enters description, specification details, unit, quantity, rate, and GST.
- Custom item is stored as part of the BOM preset.
- It can later be imported into system presets with the same saved values.

Importing BOM presets into system presets:

- In system preset Stage 3, choose a saved BOM preset.
- For an empty new preset:
  - Items are imported directly.
- For an existing/edit/duplicate preset with items:
  - User chooses append/keep old items or replace old items.
- Append mode skips duplicate catalog items.
- Replace mode clears old non-core BOM list and imports selected preset items.

Data integrity:

- `bom_presets` stores preset metadata.
- `bom_preset_items` stores ordered item rows.
- RLS restricts presets to the current organisation.
- Name uniqueness is enforced per organisation for active presets.
- Delete should soft-delete or safely remove according to DB action behavior.

---

## 9. Masters Flow

Main files:

- `src/app/master/page.tsx`
- `src/app/master/panels/page.tsx`
- `src/app/master/inverters/page.tsx`
- `src/app/master/batteries/page.tsx`
- `src/app/master/pricing/page.tsx`
- `src/app/master/rate-master/page.tsx`
- `src/app/master/structures/page.tsx`
- `src/app/master/accessories/page.tsx`
- `src/app/master/bom-presets/page.tsx`
- `src/app/master/subsidy/page.tsx`
- `src/app/master/terms/page.tsx`
- `src/components/master/BulkEditModal.tsx`
- `src/components/master/HistoryDrawer.tsx`

Masters dashboard:

- Shows normal tiles for all master modules.
- Counts active records by entity.
- Shows recent master data changes.
- Shows recent audit logs.

Panels Master:

- Manages panel brand, model, wattage, panel type/cell tech, rate per watt, selling rate, GST, description, and specification details.
- Supports search and filters.
- Supports saved views.
- Supports column visibility.
- Supports add, edit, clone, delete where allowed.
- Supports bulk edit.
- Supports Excel export.
- Supports import mapping with preview:
  - Add.
  - Update.
  - Unchanged.
  - Invalid.
  - Failed.
- Import must acknowledge counts clearly and not report unrelated messages.

Inverters Master:

- Manages inverter brand, model, capacity, type, phases, selling price, GST, and specs.
- Supports add/edit/delete.
- Supports bulk edit.
- Supports Excel import/export.
- Import summary reports created, updated, and unchanged/skipped.

Batteries Master:

- Manages battery brand, model, capacity, chemistry, voltage, depth of discharge, selling price, GST, and specs.
- Supports add/edit/delete.
- Supports bulk edit.
- Supports Excel import/export.
- Import summary reports created, updated, and unchanged/skipped.

Pricing Master:

- Displays unified BOM/equipment pricing override records.
- Supports create/edit/delete override.
- Supports export/import.
- Import requires matching component descriptions or known identifiers.
- Summary reports created, modified, skipped, and failed counts.

Rate Overrides:

- Focused rate override table for BOM item rates used in costing and finance review.
- Supports override rates and history.
- History should be readable, not raw JSON dumps.

Structures Master:

- Manages capacity templates.
- Manages structure vendors and material rates.
- Manages walkway and ladder add-ons.
- Supports editing rate per kg for structure material pricing.
- Supports mounting structure quote specification details.

Accessories Master:

- Manages BOM accessory rows such as ACDB/DCDB, earthing, cables, transport, civil, meters, LA, and other non-core items.
- Supports add/edit/delete.
- Supports GST and specification details.
- Feeds Calculator, BOM preset master, and system preset editor.

BOM Preset Master:

- Covered in section 8.

Subsidy Master:

- Manages scheme code, scheme name, applies-to segment, max capacity, max subsidy cap, description, state availability, and piecewise slabs.
- Supports create, edit, and delete.
- Save should use atomic database functions.
- State overrides and slabs must not become orphaned.

Terms Master:

- Manages global default terms and state-specific quotation terms.
- Terms are used when generating PDFs.
- Existing quotes preserve a snapshot of terms.
- Add Clause should scroll/focus to the newly added clause.
- Save Template persists current clauses.

Master history drawer:

- `HistoryDrawer` shows revision log and platform audit.
- It summarizes human-readable field changes.
- It hides noisy internal values such as IDs, timestamps, org IDs, and raw schema internals unless explicitly needed.

Bulk edit modal:

- Used by panel, inverter, battery, and similar masters.
- Applies a selected set of field changes to selected rows.
- Must validate field types and GST normalization.

---

## 10. Quotes and PDF Flow

Main files:

- `src/app/quotes/page.tsx`
- `src/app/quotes/[id]/page.tsx`
- `src/components/calculator/QuoteSaveModal.tsx`
- `src/components/quotes/*`
- `src/app/api/quotes/generate-pdf/route.ts`
- `src/lib/pdf/*`
- `enermass-quote-template.html`
- `src/lib/store/calculatorStores/quoteStore.ts`
- `src/lib/hooks/useQuotes.ts`
- `src/lib/quotes/reviseQuote.ts`

Quote creation entry points:

- From Calculator: `Create Quote PDF`.
- From Quotes page: generate PDF for an existing quote.
- From Quote detail: generate/regenerate PDF.

Create Quote PDF modal:

The modal is staged:

1. Project
   - Project title.
   - Customer name.
   - Phone number.
   - WhatsApp number.
   - Email address.
2. Address
   - Billing/site address fields.
   - City, state, pincode, and related address metadata.
3. Site
   - Site type.
   - Roof information.
   - Electrical/load details.
   - Site notes where supported.
4. Sales
   - Sales executive.
   - Sales executive phone.
   - Sales executive email.
   - Sale type.
   - Sales attribution.
   - Email validation should only enforce valid format when an email is provided.
5. Proposal customization
   - Proposal details and printable options.
   - PDF-specific customization.

Quote persistence:

- Quotes are stored in the `quotes` table.
- Quote numbers are generated and preserved.
- Equipment, terms, pricing, and BOM snapshots are stored so historical quotes remain stable after masters change.
- Draft quotes may be stored in `draft_quotes`.
- Atomic quote persistence RPC is used where required.

Quote PDF:

- Rendered server-side.
- Uses Handlebars template.
- Uses Puppeteer/Chromium for PDF output.
- Uploads to Supabase Storage bucket `quotes`.
- Stores PDF path/URL metadata back on the quote.
- API route has extended Vercel max duration.

Quotes list:

- Search.
- Status filter.
- Sort.
- Quote cards/table.
- Quick PDF generation.
- Status dropdown.
- Delete where allowed.
- Version history.
- Survey summary.
- Stale rate warning.
- Rate verdict report.

Quote statuses:

- Draft.
- Sent.
- Won.
- Lost.

Status change behavior:

- Status is changed directly via dropdown.
- It saves to DB.
- It records status history.
- It shows a compact acknowledgement such as "Quote state changed from X to Y."
- It should not block the user with unnecessary survey override modals.

Quote detail:

- Displays quote summary.
- Lets user change status.
- Lets user download/regenerate PDF.
- Shows version list and revision actions.
- Can revise quote and create a new version.
- Can load quote back into calculator for adjustment.

Rate comparison:

- `RateVerdictReport` compares saved quote rates against live master rates.
- It identifies stale rates and unlinked rows.
- It helps finance review quote profitability after master changes.

Survey-related components:

- `CreateSurveyModal` starts a survey.
- `SurveyGateModal` protects flows that require survey acknowledgement.
- `SurveySummaryCard` shows survey status on quote cards/details.

---

## 11. Settings, Profile, and Access Control

Main files:

- `src/app/settings/page.tsx`
- `src/app/settings/users/page.tsx`
- `src/app/settings/team/page.tsx`
- `src/app/settings/roles/page.tsx`
- `src/app/settings/security/page.tsx`
- `src/app/settings/devices/page.tsx`
- `src/app/settings/device-reset-requests/page.tsx`
- `src/app/settings/password-resets/page.tsx`
- `src/app/settings/billing/page.tsx`
- `src/app/settings/subscription/page.tsx`
- `src/app/settings/activation-keys/page.tsx`
- `src/app/profile/page.tsx`

Settings page:

- Theme switch.
- Default margins by category.
- Grid tariff.
- Company information.
- Organisation-level settings.
- Save All commits changes.
- Discard All must revert unsaved local edits and not write them.

Settings layout requirement:

- Content should be centered over the settings workspace.
- Controls should not be pinned too far left on wide screens.
- Hidden features remain hidden.

Users/team/roles:

- Manage organisation users and role metadata.
- Normal users should have access to normal app modules.
- Master Control stays restricted to super admins.

Security:

- Device binding.
- Password reset controls.
- Device reset requests.
- Audit logs.

Profile:

- User details.
- Password recovery handling.
- Personal account state.

PWA/shortcut:

- Browser install prompt is not shown repeatedly every refresh.
- Shortcut/install option belongs in settings where supported.
- Manifest is in `public/manifest.json`.

---

## 12. Super Admin and SaaS Controls

Main files:

- `src/app/super-admin/orgs/page.tsx`
- `src/app/super-admin/orgs/[id]/page.tsx`
- `src/app/super-admin/plans/page.tsx`
- `src/app/super-admin/subscriptions/page.tsx`
- `src/app/super-admin/payments/page.tsx`
- `src/app/super-admin/activation-keys/page.tsx`
- `src/app/super-admin/device-resets/page.tsx`
- `src/app/super-admin/passwords/page.tsx`
- `src/app/super-admin/audit-log/page.tsx`
- `src/app/super-admin/mfa/page.tsx`
- `src/components/saas/*`
- `src/lib/saas/*`

Purpose:

- Manage organisations.
- Manage plans and plan features.
- Manage subscriptions and seat limits.
- Generate/revoke/export activation keys.
- Review payments.
- Approve/reject device resets.
- Review password reset flows.
- View platform audit logs.

Access:

- Only super admins see Master Control in the sidebar.
- Normal authenticated users can access standard app features based on licensing.
- Server-side guards must still enforce privileged routes even if UI hides links.

SaaS components:

- `ManagementUi` renders SaaS management sections.
- `GenerateKeysModal` generates activation keys.
- `UpgradePrompt` displays plan/feature restriction messaging.
- `PasswordResetActions` handles password reset approvals/rejections.

---

## 13. Operations Modules

Inventory:

- Routes:
  - `/inventory`
  - `/inventory/bulk-update`
  - `/inventory/receipt/[movementId]`
- Libraries:
  - `src/lib/inventory/inventoryRepository.ts`
  - `src/lib/inventory/transitions.ts`
  - `src/lib/inventory/valuation.ts`
- Handles stock, movement transitions, valuation, receipt updates, and isolation.

Procurement:

- Routes:
  - `/procurement`
  - `/procurement/purchase-orders`
- Libraries:
  - `src/backend/orm/procurement.ts`
  - `src/lib/procurement/3way-match.ts`
- Handles purchase orders, analytics, and matching.

Finance:

- Routes:
  - `/reports/gst`
  - `/reports/vendor-retention`
  - `/api/finance/journal`
- Libraries:
  - `src/lib/finance/ledger.ts`
  - `src/lib/finance/receivables.ts`
  - `src/lib/finance/taxEngine.ts`
  - `src/lib/reports/gstr1.ts`
  - `src/lib/reports/gstr3b.ts`
  - `src/lib/reports/gstr_service.ts`

Net metering:

- Route:
  - `/reports/net-metering`
- Cron:
  - `/api/cron/net-metering-sla`
- Vercel cron runs daily at 09:00.

Service:

- Routes:
  - `/service/amc`
  - `/service/warranty`
  - `/amc`
  - `/warranty`
- Backends:
  - `src/backend/orm/amc.ts`
  - service-related quote/project data.

---

## 14. Data Model and Database Rules

Core database groups:

- Auth/profile/org:
  - `profiles`
  - organisations and membership tables
  - subscription tables
  - activation key tables
  - device binding/reset tables
- Masters:
  - `eq_panels`
  - `eq_inverters`
  - `eq_batteries`
  - `eq_mounting_structures`
  - `bom_template_items`
  - `rate_master`
  - `calculation_schemes`
  - `scheme_slabs`
  - `state_scheme_overrides`
  - `state_terms_templates`
  - `bom_presets`
  - `bom_preset_items`
- Systems:
  - system presets
  - system preset items
  - state mappings
- Quotes:
  - `quotes`
  - `draft_quotes`
  - quote status/version/history tables where present
- Audit:
  - `master_data_changes_log`
  - `sys_audit_logs`
- Operations:
  - inventory/procurement/finance/service tables.

RLS expectations:

- Org-scoped records use `org_id`.
- Users can see global rows plus their organisation rows where applicable.
- Users cannot read/write other organisations' data.
- Super-admin routes must still use explicit server checks.
- Service role is only used server-side.

Important RPC functions:

- `replace_system_items_atomic`
  - Replaces all items for a system preset atomically.
  - Used by system preset save/duplicate flows.
- `create_subsidy_scheme_atomic`
  - Creates scheme, slabs, and state overrides atomically.
- `update_subsidy_scheme_atomic`
  - Updates scheme, slabs, and state overrides atomically.
- Atomic quote persistence/duplicate functions from latest migrations.

Migration files of special importance:

- `202607060012_atomic_quote_persistence.sql`
- `202607060014_atomic_system_item_replace.sql`
- `202607060016_atomic_subsidy_and_settings.sql`
- `202607060017_harden_atomic_system_item_replace.sql`
- `202607060018_atomic_quote_duplicate.sql`
- `202607060019_bom_presets.sql`
- `202607060020_excel_bom_baseline_reconciliation.sql`
- `202607060021_preset_item_taxonomy.sql`

---

## 15. Caching, Sync, and Invalidation

Main files:

- `src/lib/cache/server-cache.ts`
- `src/lib/cache/masterCache.ts`
- `src/lib/cache/redis.ts`
- `src/lib/cache/redisCache.ts`
- `src/lib/cache/invalidation.ts`
- `src/app/actions/revalidateMasters.ts`
- `src/lib/hooks/useOfflineSync.ts`
- `src/lib/hooks/useMasters.ts`
- `src/lib/hooks/useQuotes.ts`

Server calculator cache:

- Equipment master cache: short-lived DB-backed cache.
- Structures master cache: separately deferred to avoid blocking calculator render.
- Rules master cache: subsidy/state/rules cache.
- Org context cache: short TTL.

Master cache:

- In-memory stale-while-revalidate payloads.
- Org-specific cache keys.
- Global fallback cache.
- Cache version metadata.
- Failed refreshes keep stale data and back off instead of breaking the UI.

Redis cache:

- Used when Upstash is configured.
- Falls back where possible if Redis env is missing.
- Supports get-or-set, explicit keys, prefix invalidation, and TTL.

Invalidation:

- `revalidateMasterCache` invalidates:
  - Next.js tag cache.
  - In-memory master cache.
  - Server calculator cache.
  - Redis cache keys.
  - Relevant org-scoped cache keys.
- Master updates emit `MASTER_DATA_UPDATED_EVENT`.
- AppShell listens and refreshes master queries and calculator state.

Offline/sync:

- Local state and IndexedDB/localforage support offline use where implemented.
- Inactive records are pruned/tombstoned.
- Conflict resolver handles sync conflicts in the shell.

---

## 16. Calculation Engine

Main files:

- `src/lib/engine/calculator.ts`
- `src/lib/engine/dbCalculator.ts`
- `src/lib/engine/margin.ts`
- `src/lib/engine/pricing.ts`
- `src/lib/engine/energy.ts`
- `src/lib/engine/financials.ts`
- `src/lib/engine/subsidy.ts`
- `src/lib/engine/bomResolver.ts`
- `src/lib/engine/bomElectrical.ts`
- `src/lib/engine/bomStructure.ts`
- `src/lib/engine/bomCivilEarthing.ts`
- `src/lib/engine/formulaParser.ts`
- `src/lib/formula/evaluator.ts`
- `src/lib/math/integrity.ts`

Pricing priority chain:

1. `targetMRPInclGST`
2. `targetMRPPerWatt`
3. `targetMarginPct`
4. `defaultMarginPct`

If multiple targets are provided, the engine follows the priority chain.

Line calculations:

```text
line_total = effective_quantity * effective_rate
line_gst = line_total * gst_rate
line_subtotal = line_total + line_gst
```

Cost aggregates:

```text
cost_before_gst = sum(line_total)
input_gst = sum(line_gst)
cost_including_gst = cost_before_gst + input_gst
```

Margin and final price:

```text
mrp_excluding_gst = cost_before_gst + margin_amount
mrp_including_gst = mrp_excluding_gst + output_gst
discount = flat_or_percent_discount
final_customer_price = mrp_including_gst - discount + additional_costs
beneficiary_contribution = final_customer_price - subsidy
```

Energy:

```text
effective_generation_capacity = min(panel_capacity_kw, inverter_capacity_kw)
daily_generation = capacity * peak_sun_hours * performance_ratio * orientation_multiplier
annual_generation = daily_generation * 365
```

Payback:

```text
annual_savings = annual_generation * grid_tariff
payback_years = beneficiary_contribution / annual_savings
```

Data integrity:

- Numeric inputs are sanitized.
- Currency rounding is centralized.
- Discount is clamped so it cannot produce invalid negative pricing.
- Calculation result integrity is asserted by tests.
- Formula parser safely evaluates supported formula expressions.

---

## 17. Import/Export Behavior

Shared utility:

- `src/lib/utils/ImportExportHelper.ts`

Masters export:

- Exports visible/current master data to Excel.
- Exported data should include enough stable identity fields for re-import.
- Download notification should happen once per user action.

Masters import:

- Import should not blindly create duplicate rows with a different scope.
- Import should identify existing rows by stable natural key and/or exported IDs.
- Import should report:
  - Created.
  - Updated/modified.
  - Unchanged/skipped.
  - Invalid.
  - Failed.
- Toast should match the imported module, not show unrelated text such as "pricing override created" for unrelated imports.

Panel import mapping:

- Reads Excel headers.
- Auto-maps common labels:
  - Brand.
  - Model/SKU.
  - Wattage/capacity.
  - Type/cell tech.
  - Rate/price.
  - GST.
  - Description.
  - Specification/warranty/details.
- Shows preview before DB write.
- Commit Import writes only add/update rows.
- Duplicate conflicts are surfaced to user.

Inverter and battery import:

- Existing brand/model/capacity rows should update.
- Existing rows should not be duplicated by changing scope.
- Summary toast reports created/updated/unchanged.

Pricing import:

- Requires known component descriptions or identifiers.
- Updates existing org overrides where possible.
- Creates only when no matching override exists.
- Reports created/modified/skipped/failed.

---

## 18. Modals, Drawers, Popups, and Small UI Flows

Global:

- Toasts: `src/components/ui/Toast.tsx`
- Confirm dialogs: `src/components/ui/Confirm.tsx`
- Modal shell: `src/components/ui/Modal.tsx`
- Select dropdown: `src/components/ui/Select.tsx`
- Empty states: `src/components/ui/EmptyState.tsx`
- Skeletons: `src/components/ui/Skeletons.tsx`

Calculator popups:

- `QuoteSaveModal`
  - 5-step create quote/PDF wizard.
  - Validates required fields.
  - Validates sales executive email only by email format if present.
- `PresetManagerModal`
  - Loads saved presets into calculator.
- `SavePresetModal`
  - Saves current calculator configuration as a system preset.
- `AdditionalCostsPanel`
  - Adds/removes manual additional cost rows.
- BOM row dropdowns
  - Saved DB item selectors.
  - Must remain re-openable after selection.

Systems popups:

- `PresetEditorDialog`
  - Staged preset create/edit/duplicate journey.
- `DuplicatePresetChoiceDialog`
  - Edit now or save duplicate for later.
- `CatalogItemPicker`
  - Adds catalog items by subcategory.
  - Full browse mode includes category/subcategory.
  - Subcategory-launched mode only shows relevant browse controls.

Masters popups:

- `BulkEditModal`
  - Bulk field edits.
- `HistoryDrawer`
  - Human-readable revision and audit history.
- Import mapping modal
  - Maps Excel columns to app fields.
- Import review modal
  - Confirms add/update/skip/invalid rows.
- Bulk markup modal
  - Pricing master bulk markup adjustment.

Quote popups:

- `QuoteReviseModal`
  - Creates revised versions.
- `QuoteVersionHistory`
  - Shows version history.
- `QuoteCompareModal`
  - Compares versions where used.
- `RateVerdictReport`
  - Shows rate freshness comparison.
- `CreateSurveyModal`
  - Creates survey records.
- `SurveyGateModal`
  - Survey acknowledgement/guard where still required.

Layout popups:

- `CommandPalette`
  - Global navigation command palette.
- `KeyboardHelpModal`
  - Shortcut reference.
- `OnboardingTour`
  - Guided onboarding.
- `PwaPrompt`
  - Install/shortcut prompt.
- `SyncConflictResolver`
  - Offline conflict resolution.

SaaS popups:

- `GenerateKeysModal`
  - Activation key generation.
- `UpgradePrompt`
  - Subscription/feature upgrade messaging.
- `PasswordResetActions`
  - Approve/reject password reset action UI.

---

## 19. Important Source Files

Application:

```text
src/app/layout.tsx
src/app/globals.css
src/proxy.ts
src/components/layout/AppShell.tsx
src/components/layout/Sidebar.tsx
src/components/layout/Providers.tsx
```

Calculator:

```text
src/app/calculator/page.tsx
src/app/calculator/loading.tsx
src/app/calculator/CalculatorContent.tsx
src/app/calculator/CalculatorClient.tsx
src/components/calculator/BOMTable.tsx
src/components/calculator/EquipmentSelector.tsx
src/components/calculator/QuoteSaveModal.tsx
src/components/calculator/SummaryCard.tsx
src/components/calculator/EnergyCard.tsx
src/components/calculator/DiscountPanel.tsx
src/components/calculator/AdditionalCostsPanel.tsx
src/components/calculator/ROIDisplay.tsx
```

Systems and presets:

```text
src/app/systems/page.tsx
src/components/presets/PresetEditorDialog.tsx
src/components/presets/DuplicatePresetChoiceDialog.tsx
src/components/presets/CatalogItemPicker.tsx
src/components/presets/BomPresetMaster.tsx
src/lib/actions/presets.ts
src/backend/orm/system.ts
```

Masters:

```text
src/app/master/page.tsx
src/app/master/panels/page.tsx
src/app/master/inverters/page.tsx
src/app/master/batteries/page.tsx
src/app/master/pricing/page.tsx
src/app/master/rate-master/page.tsx
src/app/master/structures/page.tsx
src/app/master/accessories/page.tsx
src/app/master/bom-presets/page.tsx
src/app/master/subsidy/page.tsx
src/app/master/terms/page.tsx
src/components/master/BulkEditModal.tsx
src/components/master/HistoryDrawer.tsx
```

Quotes and PDF:

```text
src/app/quotes/page.tsx
src/app/quotes/[id]/page.tsx
src/app/api/quotes/generate-pdf/route.ts
src/components/quotes/*
src/lib/pdf/index.ts
src/lib/pdf/buildViewModel.ts
src/lib/pdf/renderPdf.ts
src/lib/pdf/helpers.ts
enermass-quote-template.html
```

State, cache, and hooks:

```text
src/lib/store/calculatorStore.ts
src/lib/store/calculatorStores/*
src/lib/hooks/useMasters.ts
src/lib/hooks/useQuotes.ts
src/lib/hooks/useSettings.ts
src/lib/hooks/useOfflineSync.ts
src/lib/cache/*
```

Backend and ORM:

```text
src/backend/orm/*
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/auth/*
src/lib/saas/*
```

Tests:

```text
__tests__/*
src/lib/engine/__tests__/*
src/lib/inventory/__tests__/*
src/lib/finance/__tests__/*
```

---

## 20. Testing and Verification

Primary commands:

```bash
npx tsc --noEmit --pretty false
npm run test
npm run build
```

Current test areas include:

- Calculator formulas.
- Margin priority.
- Math integrity.
- Formula evaluator.
- BOM resolver.
- Override resolver.
- DB calculator.
- Quote persistence.
- Master API.
- Master cache.
- Multi-tenant isolation.
- Audit/security.
- SaaS access control.
- SaaS services.
- Licensed session guard.
- Device binding API and frontend.
- Device client.
- WebAuthn.
- UPI.
- Inventory ORM and valuation.
- Finance ledger.
- Super-admin actions.

When changing UI:

- Run type check.
- Run affected tests or full `npm run test`.
- For layout changes, visually check desktop and mobile widths.
- Check dark and light mode.
- Check hover-only actions are still accessible where required.

When changing database-backed flows:

- Verify RLS behavior.
- Verify org isolation.
- Verify created/updated/skipped counts.
- Verify cache invalidation after mutation.
- Verify calculator refreshes master data after mutation.
- Verify quote snapshots remain stable after master changes.

When changing quote/PDF:

- Generate a PDF from Calculator.
- Generate a PDF from existing quote.
- Check displayed total, UPI amount, subtotal, subsidy, GST, and final customer price match.
- Check terms snapshot.
- Check sales executive fields.
- Check PDF path storage.

---

## 21. Deployment

Deployment target:

- Vercel.

Vercel config:

- `vercel.json`
- Region: `bom1`
- Build command: `npm run build`
- Output directory: `.next`
- PDF function max duration: 60 seconds.
- Net-metering cron max duration: 60 seconds.
- Daily cron:

```json
{
  "path": "/api/cron/net-metering-sla",
  "schedule": "0 9 * * *"
}
```

Next config:

- `next.config.ts`
- React strict mode enabled.
- Server external packages:
  - `@sparticuz/chromium-min`
  - `puppeteer-core`
  - `handlebars`

Before deployment:

```bash
npx tsc --noEmit --pretty false
npm run test
npm run build
```

Production prerequisites:

- Supabase migrations applied.
- Supabase Storage bucket `quotes` exists.
- RLS policies applied.
- Service role key configured only server-side.
- Upstash Redis configured if production cache/rate limiting is required.
- Cron secret configured if cron endpoint requires it.
- PDF dependencies deploy correctly in Vercel function environment.

---

## 22. Development Rules and Maintenance Checklist

General rules:

- Keep visible features working.
- Do not expose hidden modules accidentally.
- Do not bypass server-side auth because a route is hidden in UI.
- Use semantic theme tokens instead of hard-coded colors.
- Keep actions responsive across screen sizes.
- Do not create horizontal overflow for normal dashboard/list views unless the table explicitly requires it.
- Keep destructive actions behind confirmation where appropriate.
- Keep import/export messages specific and accurate.
- Keep DB writes atomic for multi-table saves.

Master data rules:

- A master edit should update the intended org override or global row, not create accidental duplicates.
- Imports should update existing records by stable identity.
- Deleting master records should preserve quote integrity.
- GST fields should be editable where the master owns GST.
- Specification details should be persisted where they print in quote PDFs.

Preset rules:

- System presets are state-wise.
- Preset quick load should select the preset's state in Calculator.
- Core components stay in their own sections.
- Structures are core components.
- BOM presets import only non-core reusable BOM items.
- Duplicate preset copies every detail and generates a unique name.

Quote rules:

- Quotes are DB-backed.
- Quote PDFs store snapshots.
- Status changes are simple dropdown changes plus acknowledgement.
- Quote status changes should not trigger unexpected workflow side effects.
- Sales executive email is optional unless the business explicitly changes that rule; if provided, validate only email format.

Cache rules:

- Mutations must invalidate org-specific cache.
- Calculator master data should refresh after master changes.
- Stale cache can be served temporarily, but write-after-read flows must eventually reflect changes.

UI rules:

- Light and dark mode must both be checked.
- Loading, empty, and error states must use semantic theme tokens.
- Long preset names must be readable in list view.
- Card actions must remain visible/responsive.
- Dropdown lists must remain reopenable after selection.

---

## Current Verification Baseline

The repository currently includes a broad Vitest suite. At the time of this README rewrite, the established expected baseline from recent work is:

```text
37 test files
301 tests
```

Run this locally before merging substantial changes:

```bash
npm run test
```

