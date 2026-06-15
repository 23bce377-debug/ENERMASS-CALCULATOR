# EnerMass Solar Calculator ☀️🔋

Welcome to the **EnerMass Solar Calculator**—a premium, client-side solar design and financial estimation platform built with **Next.js (App Router)**, **React**, **Zustand**, and **Tailwind CSS**. 

Designed specifically for sales representatives, technicians, and engineering teams, this tool facilitates instant calculation of system costs, customized equipment configurations, Indian government subsidies (PM Surya Ghar Muft Bijli Yojana), return on investment (ROI) metrics, and CRM pipeline tracking.

---

## 📌 Table of Contents

1. [System Architecture & Data Flow](#-system-architecture--data-flow)
2. [Core Features & Tabs Reference](#-core-features--tabs-reference)
3. [Mathematical Formulas & Pricing Engine](#-mathematical-formulas--pricing-engine)
4. [State-Specific Irradiance & Tax Matrix](#-state-specific-irradiance--tax-matrix)
5. [PM Surya Ghar Subsidy Logic](#-pm-surya-ghar-subsidy-logic)
6. [Interactive BOM (Bill of Materials) & Overrides](#-interactive-bom-bill-of-materials--overrides)
7. [Quote Pipeline & CRM Features](#-quote-pipeline--crm-features)
8. [Codebase File Map](#-codebase-file-map)
9. [Local Development & Setup](#-local-development--setup)

---

## 🏗️ System Architecture & Data Flow

The application runs **100% client-side**. All configurations, overrides, and customer quotes are saved and retrieved from the browser's `localStorage` (via the Zustand store hydration). There is no dependency on an external database or network connection to compute quotes, making it lightning-fast and functional offline.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CALCULATOR PAGE                                   │
│                        (src/app/calculator/page.tsx)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Left Panel (Controls)            │  Right Panel (Content)                  │
│  ─────────────────────           │  ──────────────────────────────         │
│  • SystemSelector                │  • EquipmentSelector                    │
│  • StateSelector                 │    - Panels Tab (Custom Mixes)          │
│  • ProjectTypeToggle             │    - Inverters Tab (Single Select)       │
│                                  │    - Batteries Tab (Storage Pairing)     │
│                                  │  • BOMTable (Inline Quantity/Rate/GST)  │
│                                  │  • DiscountPanel (Flat/Percentage)      │
│                                  │  • AdditionalCostsPanel (Civil, etc.)   │
│                                  │  • SummaryCard (Final Billing)          │
│                                  │  • EnergyCard (Generation & Payback)     │
│                                  │  • ActionBar & SaveQuote Modal          │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CALCULATOR STORE (Zustand)                              │
│                   (src/lib/store/calculatorStore.ts)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Holds activeSelections, rowOverrides, customPresets, and savedQuotes.   │
│  • Automatically triggers recalculate() on every mutation.                  │
│  • Handles LocalStorage synchronization ('enermass-calc-state').            │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CALCULATION ENGINE                                     │
│                    (src/lib/engine/calculator.ts)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Pure function: calculateSystem(input) -> CalcResult                      │
│  • Computes precise markup margin, input vs. output GST, and discounts.     │
│  • Projects daily/monthly/annual kWh yield, degradation, LCOE & payback.    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Core Features & Tabs Reference

The application layout is structured around an adaptive `AppShell` with collapsing navigation for desktop and ergonomic tab-bar layouts on mobile:

*   **Calculator (`/calculator`)**: The primary workspace. Set capacity, select state, customize panels, adjust item prices, control markups, view payback timelines, and generate proposals.
*   **Systems (`/systems`)**: A full grid catalog of all 25+ default systems. Includes a **Compare Mode** where you can select up to 3 systems side-by-side to compare capacity, pricing, yields, and hardware.
*   **Quotes (`/quotes`)**: The sales lead tracker. Features status transitions (**Draft**, **Sent**, **Won**, **Lost**), metadata summaries, quick action handlers (WhatsApp/Email templates), and clean, navigation-hidden **Print to PDF** templates.
*   **Rate Master (`/rate-master`)**: An administrative database displaying every distinct item in the systems. Editing a rate globally overrides it in every system that utilizes it.
*   **Presets (`/presets`)**: A customized system creator allowing engineering teams to design custom solar configurations, save them to the catalog, and load them directly into the Calculator.
*   **Settings (`/settings`)**: Configures geographic defaults, category target profit margins, custom equipment databases, letterhead details, data export (JSON), import (JSON), and factory state resets.

---

## 🧮 Mathematical Formulas & Pricing Engine

The calculator operates on a pure mathematical model defined in [calculator.ts](file:///c:/Users/hrush/Downloads/enermass%20calculator/src/lib/engine/calculator.ts). There is no rounding on intermediate variables to prevent compounding errors.

### 1. Line Item Calculations
For each item $i$ in the Bill of Materials (BOM):
$$\text{Line Total}_i = \text{Effective Quantity}_i \times \text{Effective Unit Rate}_i$$
$$\text{Line GST}_i = \text{Line Total}_i \times \text{Effective GST Rate}_i$$
$$\text{Line Subtotal}_i = \text{Line Total}_i + \text{Line GST}_i$$

*If a row is unchecked/disabled, its totals are set to zero.*

### 2. Cost Aggregates
$$\text{Cost Before GST} = \sum \text{Line Total}_i$$
$$\text{Total Input GST} = \sum \text{Line GST}_i$$
$$\text{Total Cost (incl. GST)} = \text{Cost Before GST} + \text{Total Input GST}$$

### 3. Margin & MRP Calculation (Markup Model)
Margin is calculated as a markup on the raw cost before GST, and then the state-specific output GST rate is applied:
$$\text{Margin Amount} = \text{Cost Before GST} \times \text{Effective Margin \%}$$
$$\text{MRP Excl. GST} = \text{Cost Before GST} + \text{Margin Amount}$$
$$\text{MRP Incl. GST} = \text{MRP Excl. GST} \times (1 + \text{State Output GST Rate})$$

### 4. Final Customer Price
$$\text{Discount Amount} = \begin{cases} 
0 & \text{if Discount Type} = \text{'none'} \\
\text{Discount Value} & \text{if Discount Type} = \text{'flat'} \\
\text{MRP Incl. GST} \times \frac{\text{Discount Value}}{100} & \text{if Discount Type} = \text{'percent'} 
\end{cases}$$
$$\text{Final Customer Price} = \text{MRP Incl. GST} - \text{Discount Amount} + \sum \text{Additional Cost Amounts}$$

### 5. Beneficiary Contribution (Actual Out-Of-Pocket Price)
$$\text{Beneficiary Contribution (You Pay)} = \text{Final Customer Price} - \text{Subsidy Amount}$$

### 6. Energy Projections Model
Energy generation calculations incorporate inverter clipping limitations (capping peak production to the minimum of panel capacity and inverter capacity), geographic irradiance, system losses, and panel orientation:
$$\text{Max Generation Power (kW)} = \min(\text{Panel Capacity (kW)}, \text{Inverter Capacity (kW)})$$
$$\text{Daily Generation (kWh)} = \text{Max Generation Power} \times \text{Peak Sun Hours} \times \text{Performance Ratio} \times \text{Orientation Multiplier}$$
$$\text{Monthly Generation (kWh)} = \text{Daily Generation} \times 30$$
$$\text{Annual Generation (kWh)} = \text{Daily Generation} \times 365$$

*   **Orientation Multiplier**: South (`1.0`), East/West (`0.85`), Flat (`0.90`).
*   **Performance Ratio**: Default state-specific efficiency factor (ranges from `0.75` to `0.80`).

### 7. Financial Payback & ROI (LCOE)
$$\text{Annual Savings (₹)} = \text{Annual Generation (kWh)} \times \text{Grid Tariff (₹/kWh)}$$
$$\text{Simple Payback Period (Years)} = \frac{\text{Beneficiary Contribution}}{\text{Annual Savings (₹)}}$$

To compute the **Levelized Cost of Energy (LCOE)**, the engine sums the total generation over a 25-year lifespan, factoring in a yearly panel degradation rate:
$$\text{Lifetime Generation (kWh)} = \sum_{t=0}^{24} \text{Annual Generation} \times (1 - \text{Degradation Rate})^t$$
$$\text{LCOE (₹/kWh)} = \frac{\text{Beneficiary Contribution}}{\text{Lifetime Generation (kWh)}}$$

*   **Default Degradation Rate**: `0.5%` (`0.005`) per year.

---

## 🗺️ State-Specific Irradiance & Tax Matrix

Different Indian states enforce different peak sun hours (solar irradiance), system loss profiles, labor multipliers, tax guidelines, and subsidy rules. The parameters defined in [masters.ts](file:///c:/Users/hrush/Downloads/enermass%20calculator/src/lib/data/masters.ts) are:

| Indian State | Peak Sun Hours | Performance Ratio (PR) | Labor Multiplier | Output GST Rate | Surya Ghar Subsidy Eligibility |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Gujarat** | 5.5 | 0.78 | 1.00 | 13.8% | Eligible |
| **Rajasthan** | 6.0 | 0.80 | 0.95 | 13.8% | Eligible |
| **Madhya Pradesh** | 5.4 | 0.78 | 0.92 | 13.8% | Eligible |
| **Uttar Pradesh** | 5.0 | 0.76 | 0.90 | 13.8% | Eligible |
| **Haryana** | 5.0 | 0.77 | 1.03 | 13.8% | Eligible |
| **Punjab** | 4.8 | 0.76 | 1.05 | 13.8% | Eligible |
| **Maharashtra** | 5.0 | 0.76 | 1.10 | 13.8% | Eligible |
| **Karnataka** | 5.1 | 0.77 | 1.08 | 13.8% | Eligible |
| **Andhra Pradesh** | 5.2 | 0.77 | 1.00 | 13.8% | Eligible |
| **Telangana** | 5.3 | 0.78 | 1.02 | 13.8% | Eligible |
| **Tamil Nadu** | 5.0 | 0.77 | 1.05 | 13.8% | Eligible |
| **Kerala** | 4.5 | 0.75 | 1.15 | 13.8% | Not Eligible |

---

## ⚡ PM Surya Ghar Subsidy Logic

Government subsidies under the national **PM Surya Ghar Muft Bijli Yojana** are automatically calculated when:
1. The **Project Type** toggle is set to `Residential`.
2. The installation state is marked as **Eligible** in the master data.
3. The capacity falls within the government-mandated thresholds.

The capacity used for calculations is the **minimum** of the total panel capacity and the inverter rating (`eligibleCapacityKW`).

### Subsidy Calculation Tiers:
*   **Up to 2.0 kWp**: ₹30,000 per kW (Maximum ₹60,000).
*   **From 2.0 kWp to 3.0 kWp**: ₹30,000 for the first 2 kW + ₹18,000 for the third kW (Maximum ₹78,000).
*   **Above 3.0 kWp up to 10.0 kWp**: Capped at a maximum flat amount of ₹78,000.
*   **Above 10.0 kWp**: Capped at a flat ₹0 (Commercial rates, or residential projects exceeding standard eligibility).

---

## 📦 Interactive BOM (Bill of Materials) & Overrides

The application structures the Bill of Materials into 9 logical sections:
1.  **Solar Panels**: Active solar modules.
2.  **Power Electronics**: Grid-tied, hybrid, or micro-inverters, communication units, and batteries.
3.  **Metering**: Solar check meters and bidirectional net meters.
4.  **Mounting & Structure**: Hot-Dip Galvanized structures, custom elevation channels, and fasteners.
5.  **Electrical Protection**: AC Distribution Boxes (ACDB), DC Distribution Boxes (DCDB), isolators, and meter boxes.
6.  **Earthing**: Copper-bonded chemical rods, GI earthing strips, backfill compounds, and brick chambers.
7.  **Cabling**: Solar-grade DC cables, heavy armored AC cables, and matching lugs/connectors.
8.  **Wiring**: Flexible conduits, cable trays, PVC pipes, accessories, and lightning arresters.
9.  **Services**: Logistics, civil foundations, module erection, statutory approvals, and grid commissioning.

### Inline Cell Overrides
Users can double-click cells in the **Qty**, **Rate/Unit**, or **GST %** columns to manually override the values for a specific quote:
*   **Override Warning Indicator**: Overridden rows display a small yellow dot warning next to the description, indicating that the value differs from the default catalog.
*   **Factory Reset**: Clicking the circular reset arrow button on an overridden row instantly reverts the cells to their default values.
*   **Rate Resolution Precedence**:
    $$\text{Row Override} \rightarrow \text{Rate Master Global Override} \rightarrow \text{Custom Equipment Rate} \rightarrow \text{BOM Item Default}$$

---

## 💼 Quote Pipeline & CRM Features

A saved configuration creates a formal sales quote with comprehensive structural details, manageable via the **Quotes** tab:

### 1. 4-Step Customer Registration Wizard
*   **Step 1: Customer Profile**: Client name, primary phone number, active WhatsApp contact, and email.
*   **Step 2: Install Address**: Full billing and site address (Line 1/2, City, ZIP, State).
*   **Step 3: Site Assessment Profile**: Sanctioned electrical load (kW), electricity meter serial number, current average utility monthly bill, roof type (RCC slab, tile, tin sheet, ground-mount), and total usable square footage.
*   **Step 4: Sales Attribution**: Assigned sales manager, lead type (new lead, upgrade, referral), and custom site notes.

### 2. State-Tracking and Timeline Logs
Clicking the status badge on the quote page cycles the transaction state (**Draft** $\rightarrow$ **Sent** $\rightarrow$ **Won** $\rightarrow$ **Lost**). Every stage transition is saved with a detailed user and timestamp log.

### 3. Integrated Client Communication
*   **WhatsApp Composition**: Instantly formats and launches a WhatsApp chat window containing a customer quote message outlining kW size, hardware components, final pricing, government subsidy, and final net contribution.
*   **Email Formulation**: Compiles a standard mail text populated with complete hardware specs and detailed billing tables, opening your default mail client.
*   **Print Brochure & PDF Export**: Clicking **Print** applies custom CSS media rules (`@media print`) that hide headers, sidebar, buttons, and settings panels. It formats the page layout to perfectly match standard A4 paper dimensions, allowing a clean **Save as PDF** download complete with company letterhead.

---

## 📂 Codebase File Map

```
enermass-calculator/
├── src/
│   ├── app/
│   │   ├── calculator/        # Core calculator page & state wrapper
│   │   ├── systems/           # Catalog browser & comparisons
│   │   ├── quotes/            # CRM tracker & PDF layouts
│   │   ├── rate-master/       # Global BOM items rate administrator
│   │   ├── presets/           # Custom system builder
│   │   └── settings/          # Base tariffs, company profiles, and backups
│   ├── components/
│   │   ├── AppShell.tsx       # Main navigation layout
│   │   └── calculator/        # Calculator page components
│   │       ├── BOMTable.tsx
│   │       ├── SummaryCard.tsx
│   │       ├── EnergyCard.tsx
│   │       ├── EquipmentSelector.tsx
│   │       ├── DiscountPanel.tsx
│   │       └── QuoteSaveModal.tsx
│   └── lib/
│       ├── engine/
│       │   └── calculator.ts  # Pure-function calculation engine (math logic)
│       ├── store/
│       │   └── calculatorStore.ts # Zustand global store (state machine)
│       └── data/
│           ├── bom.ts         # Predefined solar system BOM templates
│           └── masters.ts     # Panel, inverter, battery, and state details
├── package.json
└── tsconfig.json
```

---

## 🚀 Local Development & Setup

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 2. Installation
Clone the repository, navigate into the directory, and install dependencies:
```bash
# Install package dependencies
npm install
```

### 3. Development Server
Run the development environment locally:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to interact with the application.

### 4. Build and Production Run
Compile the application to optimize static generation and server-side components:
```bash
# Build the production bundle
npm run build

# Start the production server
npm run start
```
