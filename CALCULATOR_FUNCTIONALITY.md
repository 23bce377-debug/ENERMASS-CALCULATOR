# EnerMass Solar Calculator — Comprehensive Functionality & User Guide

Welcome to the **EnerMass Solar Calculator** documentation. This document provides an in-depth explanation of all the features, user interfaces, data structures, and core mechanics that power the application.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Application Shell & Navigation](#2-application-shell--navigation)
3. [The Core Calculator (Calculator Tab)](#3-the-core-calculator-calculator-tab)
4. [System Browser & Comparison (Systems Tab)](#4-system-browser--comparison-systems-tab)
5. [Lead & Quote Management (Quotes Tab)](#5-lead--quote-management-quotes-tab)
6. [BOM Rate Overrides (Rate Master Tab)](#6-bom-rate-overrides-rate-master-tab)
7. [Custom Preset Sizing (Presets Tab)](#7-custom-preset-sizing-presets-tab)
8. [Global System Settings (Settings Tab)](#8-global-system-settings-settings-tab)
9. [Under the Hood: Technical Architecture](#9-under-the-hood-technical-architecture)

---

## 1. Overview

**EnerMass Solar Calculator** is a premium, client-side solar design and pricing application built with **Next.js 14+ (App Router)**, **React**, **Zustand**, and **Tailwind CSS**. Designed for sales teams and engineers, it enables:

- Selection of **25+ preconfigured solar system templates** across 6 distinct categories.
- Deep hardware customization, including active panel mix ratios, custom inverters, and battery pairings.
- Real-time inline editing of the **Bill of Materials (BOM)** with transparent input/output tax calculations.
- Automatic lookup of **PM Surya Ghar Subsidies** and grid financial returns based on Indian states.
- End-to-end sales lead tracking (Draft, Sent, Won, Lost) with pre-formatted WhatsApp and email share features.
- Dynamic generation of **print-optimized PDF brochures** showing customer costs, energy yields, and payback curves.

> [!NOTE]
> The application runs **100% client-side**. All calculations, presets, settings, and saved quotes are persisted in the browser's `localStorage`. No remote server or database is required, making the app exceptionally fast and fully offline-capable.

---

## 2. Application Shell & Navigation

The application uses a high-end, responsive layout structured by the `AppShell` and `Sidebar` components:

- **Desktop Sidebar**: A collapsing side navigation showing active states with a premium gold gradient brand emblem.
- **Mobile Navigation Bar**: A fixed bottom tab-bar providing ergonomic access to essential pages on phones and tablets.
- **Dynamic Context Header**: Displays the currently active solar configuration and keeps a live counter of saved quotes.

### Navigational Mapping
| Route | Label | Target Device Visibility | Purpose |
| :--- | :--- | :--- | :--- |
| `/calculator` | **Calculator** | Desktop & Mobile | Core configuration and sizing console |
| `/systems` | **Systems** | Desktop only | Grid browser and multi-system comparison |
| `/quotes` | **Quotes** | Desktop & Mobile | Lead status pipeline, sharing, and PDF printing |
| `/rate-master` | **Rate Master**| Desktop only | Global BOM item rate override sheet |
| `/presets` | **Presets** | Desktop & Mobile | Quick builder for custom systems |
| `/settings` | **Settings** | Desktop & Mobile | Theme settings, defaults, backup tools |

---

## 3. The Core Calculator (Calculator Tab)

The **Calculator Tab** (`/calculator`) is the central terminal. It is divided into an input-control panel on the left and a detailed results and adjustment panel on the right.

```
┌────────────────────────────────────────────────────────┐
│                   CALCULATOR PAGE                      │
├───────────────────────────┬────────────────────────────┤
│ Left Panel (Inputs)       │ Right Panel (Outputs)      │
│ 1. Predefined System      │ 1. Equipment Selectors     │
│    Dropdown               │    - Panels, Inverters,    │
│ 2. State & Irradiance     │      and Batteries Mix     │
│    Selector               │ 2. BOM Table               │
│ 3. Project Type Toggle    │    - Inline Qty, Rate, GST │
│    (Residential/Comm.)    │ 3. Pricing & Subsidy Card  │
│                           │ 4. Energy & Payback Card   │
│                           │ 5. Discount / Extra Costs  │
│                           │ 6. Action Bar & Quote Save │
└───────────────────────────┴────────────────────────────┘
```

### Key Interactive Components

#### 1. System Selector
Selects from a list of predefined rooftop solar setups grouped by category (On-Grid, 3-Phase, Micro-Inverter, Hybrid, Upgrade, Commercial). Searching by name or capacity instantly loads the respective default Bill of Materials (BOM) templates.

#### 2. Indian State Selector
Configures installation geography. This selection directly adjusts:
- **Irradiance & Peak Sun Hours**: Affects energy generation projections.
- **Performance Ratios**: Factors local ambient losses.
- **Labour Costs**: Multiplies service-related rates.
- **Output GST**: Adjusts tax between 13.8% and 13.8%.
- **State Subsidy Rules**: Sets limits and brackets for central government incentives.

#### 3. Residential vs. Commercial Toggle
Controls government subsidy access.
- **Residential**: Automatically applies the **PM Surya Ghar Muft Bijli Yojana** brackets (subsidies up to 10 kW).
- **Commercial**: Sets all subsidies to zero and changes tax/margin expectations.

#### 4. Equipment Customization Tabs
Rather than using generic components, users can override default solar kits:
- **Panels Tab**: Filter panels by wattage ranges. Users can toggle "Custom Qty" to design a **Panel Mix** (e.g. using two different brands or models in a single array) while a live progress bar displays total selected power versus targeted capacity.
- **Inverters Tab**: Filter by capacity and single-select specific grid-tied, hybrid, or micro-inverter models.
- **Batteries Tab**: Configure Lithium Iron Phosphate (LFP) or Lithium-Ion battery storage capacities for Hybrid setups.

#### 5. Interactive BOM (Bill of Materials) Table
A fully interactive breakdown of all line items categorized into:
1. *Solar Panels*
2. *Power Electronics* (Inverters, Communication Devices, Batteries)
3. *Metering* (Solar & Net Meters)
4. *Mounting & Structures* (Hot-Dip Galvanized structures, fasteners)
5. *Electrical Protection* (ACDB, DCDB, lightning arresters, earthing)
6. *Earthing & Cabling* (Cables, strips, chamber boxes)
7. *Services* (Transportation, structure commissioning, civil installation)

```
BOM Table Inline Features:
- Double-click Qty, Rate/Unit, or GST% to edit.
- Warning Badge (Yellow Dot) indicates overridden cells.
- Reset Button restores factory defaults for that row.
- Custom Item Button allows adding site-specific hardware.
- Profit Margin Slider (0% - 100%) dynamically computes the markup amount.
```

#### 6. Dynamic Pricing Summary & Subsidies
Displays financial calculations in a clear, digestible format:
- **Base Cost**: Raw material cost + Input GST.
- **MRP (incl. GST)**: Raw Cost + Profit Margin + Output GST (calculated based on state-specific solar tax rules).
- **Final Price**: Base MRP - Customer Discounts + Additional Civil Costs.
- **Subsidy Deductible**: Live display of Surya Ghar subsidies based on system size.
- **Beneficiary Contribution (You Pay)**: Highlighted in a premium gold gradient, indicating the customer's actual out-of-pocket investment.

#### 7. Energy Yield & Payback Projections
Performs structural analysis to show ROI:
- Calculates daily, monthly, and annual generation in kWh.
- Simulates seasonal variation in a 12-month bar chart (peaking in May, dipping in monsoon/winter).
- Forecasts **25-Year Lifetime Savings** accounting for standard panel degradation (0.5% annually).
- Outputs the **Simple Payback Period** (investment cost divided by grid tariff bill savings).

---

## 4. System Browser & Comparison (Systems Tab)

The **Systems Tab** (`/systems`) provides an elegant grid dashboard showcasing the solar configurations available in the system catalog.

- **System Search**: Instantly filters systems by title, capacity, or technology group.
- **Quick Calculate**: Launches the selected configuration directly in the active main calculator.
- **Compare Mode**:
  - Allows selecting **up to 3 systems** simultaneously.
  - Generates a side-by-side metrics grid comparing capacity, component lists, default costs, output pricing, per-kW cost ratios, subsidy eligibility, estimated yearly energy yields, and payback years.

---

## 5. Lead & Quote Management (Quotes Tab)

The **Quotes Tab** (`/quotes`) serves as a mini CRM, allowing sales agents to manage, track, and share generated offers.

### 1. The Quote Pipeline
Saved quotes are organized in an interactive data sheet showing Quote IDs, client profiles, system sizes, final margins, and transaction states.

> [!TIP]
> Users can click on a status badge (**Draft**, **Sent**, **Won**, **Lost**) to instantly cycle through states, allowing agents to track sales conversions. Each state transition is automatically logged with a date-time stamp in the quote's **Status History**.

### 2. Lead Details Modal
Clicking on a quote opens an absolute overlay showing:
- **Customer Profiles**: Names, phones, WhatsApp numbers, email addresses, and detailed physical site addresses.
- **Site Assessment Info**: Local energy meter serial numbers, sanctioned electrical loads, current average monthly utility bills, roof type (e.g. RCC slab, metal sheet, tile), and usable space in square feet.
- **Technical Specs**: Custom panel mixtures, precise inverter and battery serials.
- **Financial Breakdown**: Exact input cost, margin, discounts, and payback.

### 3. Integrated Action Bar
- **WhatsApp Share**: Auto-composes and launches a WhatsApp link prefilled with formatted customer project titles, system specifications, final pricing, and beneficiary costs.
- **Email Share**: Triggers a `mailto` utility pre-formatted with complete billing summaries.
- **Edit & Duplicate**: Reloads the historical snapshot into the calculator store or duplicates it as a template for a new quote.
- **Highly-Styling Print View**: Executes standard `window.print()` using custom print media styles. It displays a beautiful, highly polished page optimized for direct A4 paper printing or PDF export (hiding UI buttons, navigation, and sidebar).

---

## 6. BOM Rate Overrides (Rate Master Tab)

The **Rate Master** (`/rate-master`) is a global administrative sheet that aggregates every unique material description used across the 25+ default systems.

- **Centralized Rates**: Displays how many system templates utilize a particular item and its average baseline cost.
- **Live Override**: Setting a master rate and toggling its active status replaces the rate for that item across **ALL** active calculations instantly. For example, updating the "Structure" rate globally adjusts all 25+ systems without needing manual individual adjustments.
- **Reset All Utility**: Clear all global overrides with one click, restoring factory default prices.

---

## 7. Custom Preset Sizing (Presets Tab)

The **Presets Tab** (`/presets`) allows engineering teams to design custom templates that are not present in the default catalog.

- **Custom Preset Builder**:
  - Provide a name (e.g., `"7.5 kWp Semi-Industrial Rooftop"`).
  - Select a base category and capacity.
  - Choose a base BOM template as a starting point.
  - Select specific solar panel models from the active settings catalog or input custom wattages.
  - Designate default inverter and battery mixes.
  - Define custom profit margin targets.
- **Saving Configurations**: Once added, these systems appear inside the main Calculator's system dropdown selector as quick-load items. They can be renamed or deleted at any time.

---

## 8. Global System Settings (Settings Tab)

The **Settings Tab** (`/settings`) governs the global operational parameters of the application.

```
┌────────────────────────────────────────────────────────┐
│                     SETTINGS PAGE                      │
├────────────────────────────────────────────────────────┤
│ 1. Theme Configuration (Light vs. Dark Mode)           │
│ 2. Default Sizing Parameters (Default State)           │
│ 3. Target Profit Margins per Category                  │
│ 4. Base Grid Utility Tariff (₹/kWh)                    │
│ 5. Equipment Cost Databases (Panels, Inverters, Bats)  │
│ 6. Company Info (Letterhead Name & Print Address)      │
│ 7. Data Backups (Export JSON / Import JSON)            │
│ 8. Factory Reset Button                                │
└────────────────────────────────────────────────────────┘
```

### Key Configurations

#### Default Location & Tariffs
- Sets the default geographic state loaded at startup.
- Establishes the default grid tariff rate (default: `₹8.00 / kWh`) used for ROI equations.

#### Baseline Category Margins
Sets target profit margins for each system category (e.g., 20% for On-Grid, 22% for Micro-Inverter, 15% for Upgrades). These defaults are loaded when a system under that category is selected.

#### Equipment Selling Costs
Manage the base unit cost database for:
- Panels (Rate per watt, e.g., Adani Mono PERC, Waaree TOPCon).
- Inverters (Flat rate per unit based on brand and model capacity).
- Batteries (Flat rate per unit based on chemistry and storage capacity).

#### Company Profile
Enter details for printouts (Company name and physical office address) which are rendered onto the letterheads of generated PDF brochures.

#### Data Backups & Migration
- **Export Data**: Downloads the entire active state (including settings overrides, presets, and all saved customer quotes) as a single local `.json` file.
- **Import Data**: Uploads a previously exported JSON backup, overwriting active local storage data.
- **Reset Defaults**: Clears all local storage overrides, restoring the application to its original default state.

---

## 9. Under the Hood: Technical Architecture

### 1. Core Data Structures

#### Predefined Systems (`SolarSystem`)
Defined in `src/lib/data/bom.ts`, each system is structured as follows:
```typescript
interface SolarSystem {
  id: string;                  // Unique identifier
  name: string;                // Display name
  category: 'on-grid' | '3-phase' | 'micro-inverter' | 'hybrid' | 'upgrade' | 'commercial';
  capacityKW: number;          // Peak power capacity
  panelWattage: number;        // Wattage per panel
  panelQty: number;            // Panel quantity
  targetMarginPct: number;     // Target profit margin percentage
  items: BomItem[];            // Pre-populated Bill of Materials
  defaultEquipment?: {         // Pre-linked equipment models
    panelMix?: Record<string, number>;
    inverterMix?: Record<string, number>;
    batteryMix?: Record<string, number>;
  };
}
```

#### State Master Configurations (`StateData`)
Configured in `src/lib/data/masters.ts`, each state contains parameters that determine solar outputs and local taxes:
```typescript
interface StateData {
  name: string;
  sunHoursPerDay: number;      // Average peak sun hours
  performanceRatio: number;    // System efficiency multiplier
  labourMultiplier: number;    // Labor cost factor
  gstOnOutput: number;         // Output GST tax rate (e.g., 0.138 or 0.138)
  subsidyRules: SubsidyRule[]; // Government subsidy brackets
}
```

### 2. State Management Flow (Zustand + LocalStorage)

The application state is managed by the Zustand store located in `src/lib/store/calculatorStore.ts`. It provides a unified state machine with automatic recalculations:

```
┌──────────────────────────┐
│  State Change Action     │ (selectSystem, setState, editBOM, etc.)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│     Zustand Store        │ (calculatorStore.ts)
├──────────────────────────┤
│ 1. Merge new values      │
│ 2. Run recalculate()     │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Calculation Engine     │ (calculator.ts)
├──────────────────────────┤
│ 1. Process BOM Items     │ (Quantities × Rates + Input GST)
│ 2. Compute Margin        │ (Cost × Margin% = MRP Excl. GST)
│ 3. Apply Output GST      │ (MRP Excl. GST × (1 + State Output GST))
│ 4. Apply Discounts       │
│ 5. Apply Additional Costs│
│ 6. Lookup Subsidy        │ (Surya Ghar Rules matching System Capacity)
│ 7. Compute Payback       │ (Capacity × Sun Hours × PR × Tariff)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Update UI & Persist    │ (Render updated state + sync to LocalStorage)
└──────────────────────────┘
```

### 3. State Irradiance Reference Matrix
The following table shows the baseline parameters utilized by the engine when a state is selected:

| Indian State | Peak Sun Hours | Performance Ratio (PR) | Labor Cost Multiplier | Output GST Rate | Surya Ghar Subsidy |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Gujarat** | 5.5 hrs | 0.78 | 1.00 | 13.8% | Eligible |
| **Rajasthan** | 6.0 hrs | 0.80 | 0.95 | 13.8% | Eligible |
| **Madhya Pradesh** | 5.4 hrs | 0.78 | 0.92 | 13.8% | Eligible |
| **Uttar Pradesh** | 5.0 hrs | 0.76 | 0.90 | 13.8% | Eligible |
| **Haryana** | 5.0 hrs | 0.77 | 1.03 | 13.8% | Eligible |
| **Punjab** | 4.8 hrs | 0.76 | 1.05 | 13.8% | Eligible |
| **Maharashtra** | 5.0 hrs | 0.76 | 1.10 | 13.8% | Eligible |
| **Karnataka** | 5.1 hrs | 0.77 | 1.08 | 13.8% | Eligible |
| **Andhra Pradesh** | 5.2 hrs | 0.77 | 1.00 | 13.8% | Eligible |
| **Telangana** | 5.3 hrs | 0.78 | 1.02 | 13.8% | Eligible |
| **Tamil Nadu** | 5.0 hrs | 0.77 | 1.05 | 13.8% | Eligible |
| **Kerala** | 4.5 hrs | 0.75 | 1.15 | 13.8% | Not Eligible |

### 4. PM Surya Ghar Subsidy Logic
Subsidies are automatically calculated for residential project types based on the system capacity loaded in the calculator:

- **Systems up to 2.0 kWp**: ₹30,000 per kW (Max ₹60,000).
- **Systems between 2.0 kWp and 3.0 kWp**: ₹30,000 for the first 2 kW + ₹18,000 for the third kW (Max ₹78,000).
- **Systems above 3.0 kWp up to 10.0 kWp**: Capped at a maximum of ₹78,000.
- **Systems above 10.0 kWp**: ₹0 (commercial limits or large residential systems).

---

> [!TIP]
> To back up your data or move your configurations to another computer, navigate to the **Settings** page and click **Export All Data**. This will package all your custom systems, quotes, and rate configurations into a single portable JSON file.
