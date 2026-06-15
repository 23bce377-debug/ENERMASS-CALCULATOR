# Forensic Data Audit Report: ENERMASS ERP
Generated: 2026-06-11T20:42:47.063Z

This report documents all data inconsistencies, duplicate master records, naming variations, GST errors, and invalid pricing in the ENERMASS ERP database configuration.

## 1. Equipment Master Audit

### Panels (38 records)
- Total records: 38

### Duplicate Panels (same brand, model, wattage)

| Idx | Duplicate of | Brand | Model | Wattage (W) | Rate |
| --- | --- | --- | --- | --- | --- |
| 3 | 1 | Unknown | PANEL | 620 | 15810 |
| 4 | 1 | Unknown | PANEL | 620 | 15500 |
| 5 | 1 | Unknown | PANEL | 620 | 9300 |
| 6 | 1 | Unknown | PANEL | 620 | 16120 |
| 8 | 7 | Unknown | PANEL | 580 | 13340 |
| 9 | 1 | Unknown | PANEL | 620 | 8680 |
| 10 | 1 | Unknown | PANEL | 620 | 10540 |
| 11 | 2 | Unknown | PANEL | 550 | 8800 |
| 13 | 1 | Unknown | PANEL | 620 | 9610 |
| 14 | 1 | Unknown | PANEL | 620 | 10230 |
| 15 | 1 | Unknown | PANEL | 620 | 9920 |
| 20 | 0 | Unknown | PANEL | 545 | 7020 |
| 27 | 24 | Unknown | PANEL |  | 8912.5 |
| 32 | 28 | Unknown | PANEL | 590 | 10030 |
| 34 | 21 | Unknown | PANEL | 585 | 9067.5 |
| 35 | 7 | Unknown | PANEL | 580 | 9860 |
| 36 | 1 | Unknown | PANEL | 620 | 9424 |

### Panels with Invalid/Zero/Null Rates

| Idx | Brand | Model | Wattage (W) | Rate |
| --- | --- | --- | --- | --- |
| 17 | Unknown | NUT BOLTS(PANEL) |  |  |

### Panels GST/Schema Inconsistencies

| Idx | Brand | Model | Issue Description |
| --- | --- | --- | --- |
| 0 | Unknown | PANEL | Field 'gst_pct' has value 6016.8 (looks like absolute amount instead of rate fraction) |
| 1 | Unknown | PANEL | Field 'gst_pct' has value 7886.4 (looks like absolute amount instead of rate fraction) |
| 2 | Unknown | PANEL | Field 'gst_pct' has value 3300 (looks like absolute amount instead of rate fraction) |
| 3 | Unknown | PANEL | Field 'gst_pct' has value 9486 (looks like absolute amount instead of rate fraction) |
| 4 | Unknown | PANEL | Field 'gst_pct' has value 14880 (looks like absolute amount instead of rate fraction) |
| 5 | Unknown | PANEL | Field 'gst_pct' has value 5580 (looks like absolute amount instead of rate fraction) |
| 6 | Unknown | PANEL | Field 'gst_pct' has value 9672 (looks like absolute amount instead of rate fraction) |
| 7 | Unknown | PANEL | Field 'gst_pct' has value 10857.6 (looks like absolute amount instead of rate fraction) |
| 8 | Unknown | PANEL | Field 'gst_pct' has value 6003 (looks like absolute amount instead of rate fraction) |
| 9 | Unknown | PANEL | Field 'gst_pct' has value 8332.8 (looks like absolute amount instead of rate fraction) |
| 10 | Unknown | PANEL | Field 'gst_pct' has value 4216 (looks like absolute amount instead of rate fraction) |
| 11 | Unknown | PANEL | Field 'gst_pct' has value 4224 (looks like absolute amount instead of rate fraction) |
| 12 | Hoymiles | PANEL | Field 'gst_pct' has value 16368 (looks like absolute amount instead of rate fraction) |
| 13 | Unknown | PANEL | Field 'gst_pct' has value 10378.8 (looks like absolute amount instead of rate fraction) |
| 14 | Unknown | PANEL | Field 'gst_pct' has value 11048.4 (looks like absolute amount instead of rate fraction) |
| 15 | Unknown | PANEL | Field 'gst_pct' has value 19046.4 (looks like absolute amount instead of rate fraction) |
| 16 | Unknown | PANEL | Field 'gst_pct' has value 4179.6 (looks like absolute amount instead of rate fraction) |
| 18 | Unknown | PANEL | Field 'gst_pct' has value 5443.2 (looks like absolute amount instead of rate fraction) |
| 19 | Unknown | PANEL | Field 'gst_pct' has value 6350.4 (looks like absolute amount instead of rate fraction) |
| 21 | Unknown | PANEL | Field 'gst_pct' has value 26044.2 (looks like absolute amount instead of rate fraction) |
| 22 | Unknown | PANEL | Field 'gst_pct' has value 9720 (looks like absolute amount instead of rate fraction) |
| 23 | Unknown | PANEL | Field 'gst_pct' has value 9720 (looks like absolute amount instead of rate fraction) |
| 25 | Unknown | PANEL | Field 'gst_pct' has value 14113.44 (looks like absolute amount instead of rate fraction) |
| 26 | Unknown | PANEL | Field 'gst_pct' has value 29164.8 (looks like absolute amount instead of rate fraction) |
| 27 | Unknown | PANEL | Field 'gst_pct' has value 49197 (looks like absolute amount instead of rate fraction) |
| 28 | Unknown | PANEL | Field 'gst_pct' has value 5734.8 (looks like absolute amount instead of rate fraction) |
| 30 | STM | PANEL | Field 'gst_pct' has value 190464 (looks like absolute amount instead of rate fraction) |
| 31 | Newen | PANEL | Field 'gst_pct' has value 365601.6 (looks like absolute amount instead of rate fraction) |
| 32 | Unknown | PANEL | Field 'gst_pct' has value 7221.6 (looks like absolute amount instead of rate fraction) |
| 33 | Solinteg | PANEL | Field 'gst_pct' has value 41412 (looks like absolute amount instead of rate fraction) |
| 34 | Unknown | PANEL | Field 'gst_pct' has value 365601.6 (looks like absolute amount instead of rate fraction) |
| 35 | Unknown | PANEL | Field 'gst_pct' has value 41412 (looks like absolute amount instead of rate fraction) |
| 36 | Unknown | PANEL | Field 'gst_pct' has value 147014.4 (looks like absolute amount instead of rate fraction) |
| 37 | Enphase | PANEL | Field 'gst_pct' has value 147014.4 (looks like absolute amount instead of rate fraction) |

### Panels Naming Inconsistencies

| Idx | Issue | Model | Wattage |
| --- | --- | --- | --- |
| 0 | Brand is "Unknown" | PANEL | 545 |
| 1 | Brand is "Unknown" | PANEL | 620 |
| 2 | Brand is "Unknown" | PANEL | 550 |
| 3 | Brand is "Unknown" | PANEL | 620 |
| 4 | Brand is "Unknown" | PANEL | 620 |
| 5 | Brand is "Unknown" | PANEL | 620 |
| 6 | Brand is "Unknown" | PANEL | 620 |
| 7 | Brand is "Unknown" | PANEL | 580 |
| 8 | Brand is "Unknown" | PANEL | 580 |
| 9 | Brand is "Unknown" | PANEL | 620 |
| 10 | Brand is "Unknown" | PANEL | 620 |
| 11 | Brand is "Unknown" | PANEL | 550 |
| 13 | Brand is "Unknown" | PANEL | 620 |
| 14 | Brand is "Unknown" | PANEL | 620 |
| 15 | Brand is "Unknown" | PANEL | 620 |
| 16 | Brand is "Unknown" | PANEL | 7167 |
| 17 | Brand is "Unknown" | NUT BOLTS(PANEL) |  |
| 18 | Brand is "Unknown" | PANEL | 5250 |
| 19 | Brand is "Unknown" | PANEL | 6125 |
| 20 | Brand is "Unknown" | PANEL | 545 |
| 21 | Brand is "Unknown" | PANEL | 585 |
| 22 | Brand is "Unknown" | PANEL | 540 |
| 23 | Brand is "Unknown" | PANEL | 4167 |
| 24 | Brand is "Unknown" | PANEL |  |
| 25 | Brand is "Unknown" | PANEL | 222 |
| 26 | Brand is "Unknown" | PANEL | 179 |
| 27 | Brand is "Unknown" | PANEL |  |
| 28 | Brand is "Unknown" | PANEL | 590 |
| 32 | Brand is "Unknown" | PANEL | 590 |
| 34 | Brand is "Unknown" | PANEL | 585 |
| 35 | Brand is "Unknown" | PANEL | 580 |
| 36 | Brand is "Unknown" | PANEL | 620 |

### Inverters (50 records)

### Duplicate Inverters (same brand, model, capacity)

| Idx | Duplicate of | Brand | Model | Capacity (kW) | Rate |
| --- | --- | --- | --- | --- | --- |
| 5 | 3 | Unknown | INVERTER | 3.1 | 14800 |
| 6 | 3 | Unknown | INVERTER | 3.1 | 75000 |
| 9 | 4 | Unknown | INVERTER | 4.96 | 20000 |
| 10 | 4 | Unknown | INVERTER | 4.96 | 22500 |
| 11 | 4 | Unknown | INVERTER | 4.96 | 38000 |
| 16 | 14 | Unknown | INVERTER | 5.58 | 46000 |
| 19 | 4 | Unknown | INVERTER | 4.96 | 155000 |
| 25 | 14 | Unknown | INVERTER | 5.58 | 74000 |
| 32 | 31 | Unknown | INVERTER | 29.76 | 87000 |
| 33 | 18 | Unknown | INVERTER | 15.5 | 61187 |
| 35 | 34 | Unknown | INVERTER | 20.46 | 65000 |
| 37 | 28 | Unknown | INVERTER |  | 80850 |
| 42 | 38 | Unknown | INVERTER | 3.54 | 44000 |

### Inverters with Invalid/Zero/Null Rates

*No issues found.*

### Inverters GST/Schema Inconsistencies

| Idx | Brand | Model | Issue Description |
| --- | --- | --- | --- |
| 0 | Unknown | INVERTER | Field 'gst_pct' has value 1536 (looks like absolute amount) |
| 1 | Unknown | INVERTER | Field 'gst_pct' has value 1731 (looks like absolute amount) |
| 2 | Unknown | INVERTER | Field 'gst_pct' has value 1440 (looks like absolute amount) |
| 3 | Unknown | INVERTER | Field 'gst_pct' has value 1656 (looks like absolute amount) |
| 4 | Unknown | INVERTER | Field 'gst_pct' has value 8160 (looks like absolute amount) |
| 5 | Unknown | INVERTER | Field 'gst_pct' has value 1776 (looks like absolute amount) |
| 6 | Unknown | INVERTER | Field 'gst_pct' has value 9000 (looks like absolute amount) |
| 7 | Unknown | INVERTER | Field 'gst_pct' has value 1824 (looks like absolute amount) |
| 8 | Unknown | INVERTER | Field 'gst_pct' has value 3700 (looks like absolute amount) |
| 9 | Unknown | INVERTER | Field 'gst_pct' has value 2400 (looks like absolute amount) |
| 10 | Unknown | INVERTER | Field 'gst_pct' has value 1125 (looks like absolute amount) |
| 11 | Unknown | INVERTER | Field 'gst_pct' has value 4560 (looks like absolute amount) |
| 12 | Unknown | INVERTER | Field 'gst_pct' has value 5760 (looks like absolute amount) |
| 13 | Hoymiles | INVERTER | Field 'gst_pct' has value 5040 (looks like absolute amount) |
| 14 | Unknown | INVERTER | Field 'gst_pct' has value 2880 (looks like absolute amount) |
| 15 | Unknown | INVERTER | Field 'gst_pct' has value 4560 (looks like absolute amount) |
| 16 | Unknown | INVERTER | Field 'gst_pct' has value 5520 (looks like absolute amount) |
| 17 | Unknown | INVERTER | Field 'gst_pct' has value 5280 (looks like absolute amount) |
| 18 | Unknown | INVERTER | Field 'gst_pct' has value 22800 (looks like absolute amount) |
| 19 | Unknown | INVERTER | Field 'gst_pct' has value 18600 (looks like absolute amount) |
| 20 | Unknown | INVERTER | Field 'gst_pct' has value 1680 (looks like absolute amount) |
| 21 | Unknown | INVERTER | Field 'gst_pct' has value 1680 (looks like absolute amount) |
| 22 | Unknown | INVERTER | Field 'gst_pct' has value 1800 (looks like absolute amount) |
| 24 | Unknown | INVERTER | Field 'gst_pct' has value 5298.24 (looks like absolute amount) |
| 25 | Unknown | INVERTER | Field 'gst_pct' has value 8880 (looks like absolute amount) |
| 26 | Unknown | INVERTER | Field 'gst_pct' has value 9079.32 (looks like absolute amount) |
| 27 | Unknown | INVERTER | Field 'gst_pct' has value 2016 (looks like absolute amount) |
| 29 | Unknown | INVERTER | Field 'gst_pct' has value 6000 (looks like absolute amount) |
| 30 | Unknown | INVERTER | Field 'gst_pct' has value 7560 (looks like absolute amount) |
| 31 | Unknown | INVERTER | Field 'gst_pct' has value 8696.16 (looks like absolute amount) |
| 32 | Unknown | INVERTER | Field 'gst_pct' has value 10440 (looks like absolute amount) |
| 33 | Unknown | INVERTER | Field 'gst_pct' has value 7342.44 (looks like absolute amount) |
| 34 | Unknown | INVERTER | Field 'gst_pct' has value 8160 (looks like absolute amount) |
| 35 | Unknown | INVERTER | Field 'gst_pct' has value 7800 (looks like absolute amount) |
| 36 | Unknown | INVERTER | Field 'gst_pct' has value 120000 (looks like absolute amount) |
| 37 | Unknown | INVERTER | Field 'gst_pct' has value 9702 (looks like absolute amount) |
| 38 | Unknown | INVERTER | Field 'gst_pct' has value 1860 (looks like absolute amount) |
| 40 | STM | INVERTER | Field 'gst_pct' has value 29282.88 (looks like absolute amount) |
| 42 | Unknown | INVERTER | Field 'gst_pct' has value 5280 (looks like absolute amount) |
| 43 | Unknown | INVERTER | Field 'gst_pct' has value 31254.36 (looks like absolute amount) |
| 44 | Unknown | INVERTER | Field 'gst_pct' has value 42000 (looks like absolute amount) |
| 45 | Solinteg | INVERTER | Field 'gst_pct' has value 88552.08 (looks like absolute amount) |
| 47 | Unknown | INVERTER | Field 'gst_pct' has value 32040 (looks like absolute amount) |
| 48 | Unknown | INVERTER | Field 'gst_pct' has value 29520 (looks like absolute amount) |
| 49 | Enphase | INVERTER | Field 'gst_pct' has value 160800 (looks like absolute amount) |

### Inverters Brand Naming Issues

| Idx | Issue | Model | Capacity |
| --- | --- | --- | --- |
| 0 | Brand is "Unknown" | INVERTER | 2.18 |
| 1 | Brand is "Unknown" | INVERTER | 2.48 |
| 2 | Brand is "Unknown" | INVERTER | 1.1 |
| 3 | Brand is "Unknown" | INVERTER | 3.1 |
| 4 | Brand is "Unknown" | INVERTER | 4.96 |
| 5 | Brand is "Unknown" | INVERTER | 3.1 |
| 6 | Brand is "Unknown" | INVERTER | 3.1 |
| 7 | Brand is "Unknown" | INVERTER | 3.48 |
| 8 | Brand is "Unknown" | INVERTER | 5.22 |
| 9 | Brand is "Unknown" | INVERTER | 4.96 |
| 10 | Brand is "Unknown" | INVERTER | 4.96 |
| 11 | Brand is "Unknown" | INVERTER | 4.96 |
| 12 | Brand is "Unknown" | INVERTER | 2.2 |
| 14 | Brand is "Unknown" | INVERTER | 5.58 |
| 15 | Brand is "Unknown" | INVERTER | 6.2 |
| 16 | Brand is "Unknown" | INVERTER | 5.58 |
| 17 | Brand is "Unknown" | INVERTER | 9.92 |
| 18 | Brand is "Unknown" | INVERTER | 15.5 |
| 19 | Brand is "Unknown" | INVERTER | 4.96 |
| 20 | Brand is "Unknown" | INVERTER | 21.5 |
| 21 | Brand is "Unknown" | INVERTER | 21 |
| 22 | Brand is "Unknown" | INVERTER | 24.5 |
| 23 | Brand is "Unknown" | INVERTER | 6 |
| 24 | Brand is "Unknown" | INVERTER | 8.19 |
| 25 | Brand is "Unknown" | INVERTER | 5.58 |
| 26 | Brand is "Unknown" | INVERTER | 5.4 |
| 27 | Brand is "Unknown" | INVERTER | 25 |
| 28 | Brand is "Unknown" | INVERTER |  |
| 29 | Brand is "Unknown" | INVERTER | 4 |
| 30 | Brand is "Unknown" | INVERTER | 5 |
| 31 | Brand is "Unknown" | INVERTER | 29.76 |
| 32 | Brand is "Unknown" | INVERTER | 29.76 |
| 33 | Brand is "Unknown" | INVERTER | 15.5 |
| 34 | Brand is "Unknown" | INVERTER | 20.46 |
| 35 | Brand is "Unknown" | INVERTER | 20.46 |
| 36 | Brand is "Unknown" | INVERTER | 30.38 |
| 37 | Brand is "Unknown" | INVERTER |  |
| 38 | Brand is "Unknown" | INVERTER | 3.54 |
| 42 | Brand is "Unknown" | INVERTER | 3.54 |
| 43 | Brand is "Unknown" | INVERTER | 20.06 |
| 44 | Brand is "Unknown" | INVERTER | 25.42 |
| 46 | Brand is "Unknown" | INVERTER | 196.56 |
| 47 | Brand is "Unknown" | INVERTER | 20.3 |
| 48 | Brand is "Unknown" | INVERTER | 80.6 |

### Batteries (7 records)

### Duplicate Batteries

| Idx | Duplicate of | Brand | Model | Capacity (kWh) | Rate |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | Unknown | battery |  | 150000 |
| 2 | 0 | Unknown | battery |  | 148000 |
| 3 | 0 | Unknown | battery |  | 68000 |
| 4 | 0 | Unknown | battery |  | 75000 |
| 5 | 0 | Unknown | BATTERY |  | 50000 |
| 6 | 0 | Unknown | battery |  | 85000 |

### Batteries with Invalid/Zero/Null Rates

*No issues found.*

### Batteries Chemistry/Unit Issues

| Idx | Brand | Model | Issue |
| --- | --- | --- | --- |
| 0 | Unknown | Battery | Chemistry is Unknown or missing |
| 1 | Unknown | battery | Chemistry is Unknown or missing |
| 2 | Unknown | battery | Chemistry is Unknown or missing |
| 3 | Unknown | battery | Chemistry is Unknown or missing |
| 4 | Unknown | battery | Chemistry is Unknown or missing |
| 5 | Unknown | BATTERY | Chemistry is Unknown or missing |
| 6 | Unknown | battery | Chemistry is Unknown or missing |

### Meters (39 records)

### Duplicate Meters

*No issues found.*

### Meters with Zero/Null Rates

| Idx | Type | Brand | Model | Rate |
| --- | --- | --- | --- | --- |
| 20 | solar_meter | Unknown | SOLAR METER | 0 |
| 21 | net_meter | Unknown | net meter |  |
| 24 | meter | Unknown | METER BOX | 0 |

### Meters Type Inconsistencies

*No issues found.*

### Lightning Arresters (17 records)

### Duplicate Lightning Arresters

*No issues found.*

### Lightning Arresters with Invalid/Zero Rates

| Idx | Brand | Model | Rate |
| --- | --- | --- | --- |
| 8 | Unknown | L/A STAND |  |

## 2. Vendors & Structures Audit

### Vendors (6 records)

### Duplicate Vendor Names (Canonical/Fuzzy Match)

*No issues found.*

### Vendors Missing Contact Info

| Idx | Vendor Name | Issue |
| --- | --- | --- |
| 0 | Hoymiles | No contact info, email, or phone present |
| 1 | Inkel | No contact info, email, or phone present |
| 2 | STM | No contact info, email, or phone present |
| 3 | Newen | No contact info, email, or phone present |
| 4 | Solinteg | No contact info, email, or phone present |
| 5 | Enphase | No contact info, email, or phone present |

### Structures (32 records)

### Duplicate Structures (same name, type, rate)

| Idx | Duplicate of | Name | Type | Rate |
| --- | --- | --- | --- | --- |
| 9 | 8 | STRUCTURE | rcc_flat | 12000 |
| 28 | 18 | Mounting Structure | rcc_flat | 50000 |
| 29 | 26 | Mounting Structure | rcc_flat | 160 |
| 31 | 30 | Mounting Structure | rcc_flat | 270000 |

### Structures with Non-Standard Materials

*No issues found.*

### Structures with Zero/Null Rates

| Idx | Name | Type | Rate |
| --- | --- | --- | --- |
| 13 | STRUCTURE LEG BIG | rcc_flat |  |
| 14 | STRUCTURE LEG SMALL | rcc_flat |  |
| 15 | NUT BOLTS(STRUCTURE) | rcc_flat |  |

## 3. BOM & Template Audit

### Accessories / BOM Items (329 records)

### Duplicate BOM Items (same section, subtype, desc, rate)

| Idx | Duplicate of | Section | Subtype | Description | Rate |
| --- | --- | --- | --- | --- | --- |
| 72 | 0 | accessories | ACCESSORIES | ACCESSORIES |  |
| 73 | 17 | accessories | WIRING_PIPE | WIRING PIPE | 65 |
| 74 | 71 | accessories | WIRING_ACCESSORIES | WIRING ACCESSORIES | 2000 |
| 75 | 50 | accessories | EARTH_ROD | EARTH ROD | 220 |
| 76 | 4 | accessories | GI_STRIP | GI STRIP | 300 |
| 77 | 20 | accessories | EARTH_COMPOUND | EARTH COMPOUND | 165 |
| 78 | 51 | accessories | CHAMBER_BOX | CHAMBER BOX | 169 |
| 79 | 7 | accessories | EARTH_BENCH | EARTH BENCH | 175 |
| 80 | 68 | accessories | ACDB | ACDB | 2800 |
| 81 | 22 | accessories | DCDB | DCDB | 1750 |
| 82 | 41 | accessories | DC_CABLE | DC CABLE | 39 |
| 84 | 55 | accessories | ALUM_CABLE_50_SQMM | ALUM CABLE 50 SQMM | 53 |
| 86 | 45 | accessories | COPPER | COPPER | 900 |
| 87 | 15 | accessories | MC4_ADDITIONAL | MC4(ADDITIONAL) | 22 |
| 88 | 70 | accessories | ISOLATOR | ISOLATOR | 650 |
| 210 | 20 | accessories | EARTH_COMPOUND | EARTH COMPOUND | 165 |
| 212 | 95 | accessories | EARTH_BENCH | EARTH BENCH | 450 |
| 216 | 23 | accessories | DC_CABLE | DC CABLE | 34 |
| 218 | 204 | accessories | ALUM_CABLE_50_SQMM | ALUM CABLE 50 SQMM | 64 |
| 220 | 14 | accessories | COPPER | COPPER | 1150 |
| 221 | 15 | accessories | MC4_ADDITIONAL | MC4(ADDITIONAL) | 22 |
| 228 | 206 | accessories | VERTICAL_LADDER | vertical ladder | 40000 |
| 230 | 208 | accessories | EARTH_ROD | EARTH ROD | 600 |
| 231 | 209 | accessories | GI_STRIP | GI STRIP | 24 |
| 232 | 20 | accessories | EARTH_COMPOUND | EARTH COMPOUND | 165 |
| 233 | 211 | accessories | CHAMBER_BOX | CHAMBER BOX | 480 |
| 234 | 95 | accessories | EARTH_BENCH | EARTH BENCH | 450 |
| 240 | 204 | accessories | ALUM_CABLE_50_SQMM | ALUM CABLE 50 SQMM | 64 |
| 241 | 219 | accessories | AC_WIRE | AC WIRE | 547 |
| 242 | 14 | accessories | COPPER | COPPER | 1150 |
- ... and 66 more duplicate accessory records.

### ACDB Naming Variations

| Idx | Description | Suggestion |
| --- | --- | --- |
| 185 | MAIN ACDB | Should resolve to canonical "ACDB" |
| 193 | MAIN ACDB | Should resolve to canonical "ACDB" |
| 197 | MAIN ACDB | Should resolve to canonical "ACDB" |
| 201 | MAIN ACDB | Should resolve to canonical "ACDB" |
| 215 | MAIN ACDB | Should resolve to canonical "ACDB" |
| 237 | MAIN ACDB | Should resolve to canonical "ACDB" |
| 249 | MAIN ACDB | Should resolve to canonical "ACDB" |
| 261 | MAIN ACDB | Should resolve to canonical "ACDB" |
| 275 | ACDB DCDB | Should resolve to canonical "ACDB" |
| 276 | MAIN ACDB | Should resolve to canonical "ACDB" |
| 289 | MAIN ACDB | Should resolve to canonical "ACDB" |
| 309 | MAIN ACDB | Should resolve to canonical "ACDB" |
| 321 | MAIN ACDB | Should resolve to canonical "ACDB" |

### DCDB Naming Variations

| Idx | Description | Suggestion |
| --- | --- | --- |
| 275 | ACDB DCDB | Should resolve to canonical "DCDB" |

### BOM Unit Inconsistencies

| Idx | Description | Unit Found | Issue |
| --- | --- | --- | --- |
| 14 | COPPER | 10swg 1kg | Non-standard casing or unit name |
| 15 | MC4(ADDITIONAL) | 1set | Non-standard casing or unit name |
| 26 | COPPER | 10swg 1kg | Non-standard casing or unit name |
| 37 | COPPER | 10swg 1kg | Non-standard casing or unit name |
| 42 | COPPER | 10swg 1kg | Non-standard casing or unit name |
| 45 | COPPER | 10swg 1kg | Non-standard casing or unit name |
| 49 | ACCESSORIES | battery | Non-standard casing or unit name |
| 52 | ACDB | 1 | Non-standard casing or unit name |
| 61 | COPPER | 10swg 1kg | Non-standard casing or unit name |
| 62 | MC4(ADDITIONAL) | 1set | Non-standard casing or unit name |
| 86 | COPPER | 10swg 1kg | Non-standard casing or unit name |
| 87 | MC4(ADDITIONAL) | 1set | Non-standard casing or unit name |
| 101 | COPPER | 10swg 1kg | Non-standard casing or unit name |
| 102 | MC4(ADDITIONAL) | 1set | Non-standard casing or unit name |
| 109 | COPPER | 10swg 1kg | Non-standard casing or unit name |
| 110 | MC4(ADDITIONAL) | 1set | Non-standard casing or unit name |
| 119 | AC Cable | 16sqmm | Non-standard casing or unit name |
| 127 | GI STRIP | 5mtr | Non-standard casing or unit name |
| 128 | EARTH BENCH | 0 | Non-standard casing or unit name |
| 130 | AC CABLE | 20 | Non-standard casing or unit name |
| 131 | ALUM CABLE 50 SQMM | 25 | Non-standard casing or unit name |
| 132 | ALUM CABLE 10 SQMM | 20 | Non-standard casing or unit name |
| 133 | COPPER | 10swg 1kg | Non-standard casing or unit name |
| 134 | MC4(ADDITIONAL) | 1set | Non-standard casing or unit name |
| 139 | EARTH BENCH | 1 | Non-standard casing or unit name |
| 141 | DC CABLE | 50 | Non-standard casing or unit name |
| 142 | ALUM CABLE 50 SQMM | 20 | Non-standard casing or unit name |
| 143 | ALUM CABLE 10 SQMM | 25 | Non-standard casing or unit name |
| 144 | COPPER | 10swg 1kg | Non-standard casing or unit name |
| 148 | 1.5 | 3 | Non-standard casing or unit name |
| 149 | 2 | 4 | Non-standard casing or unit name |
| 150 | 3 | 6 | Non-standard casing or unit name |
| 151 | 4 | 8 | Non-standard casing or unit name |
| 152 | 5 | 9 | Non-standard casing or unit name |
| 153 | 6 | 11 | Non-standard casing or unit name |
| 154 | 8 | 15 | Non-standard casing or unit name |
| 155 | 10 | 19 | Non-standard casing or unit name |
| 170 | AC CABLE | 6SQMM 4 CORE | Non-standard casing or unit name |
| 171 | CU cable | 16 sq mm | Non-standard casing or unit name |
| 172 | down cunductor LA | 25X3 mm | Non-standard casing or unit name |
| 173 | AI CABLE | 25SQMM 4 CR | Non-standard casing or unit name |
| 174 | COPPER | 4sqmm | Non-standard casing or unit name |
| 217 | AC CABLE | 50sqmm | Non-standard casing or unit name |
| 219 | AC WIRE | 120sqmm | Non-standard casing or unit name |
| 239 | AC CABLE | 4core 95 | Non-standard casing or unit name |
| 241 | AC WIRE | 120sqmm | Non-standard casing or unit name |
| 262 | DC CABLE | 6sqmm | Non-standard casing or unit name |
| 263 | AC CABLE | 35sqmm | Non-standard casing or unit name |
| 265 | AC WIRE | 95sqmm | Non-standard casing or unit name |
| 304 | DC CABLE | 6sqmm | Non-standard casing or unit name |

### BOM Items with Zero Rate

| Idx | Description | Rate |
| --- | --- | --- |
| 127 | GI STRIP | 0 |
| 128 | EARTH BENCH | 0 |
| 175 | ISOLATOR | 0 |

### BOM Templates (53 records)

### Duplicate BOM Templates (same systemId, type, capacity)

*No issues found.*

### BOM Templates with Duplicate Items within the Same Template

| Idx | Template ID | Item Type | Item Description |
| --- | --- | --- | --- |
| 20 | 10kw_hybrid | accessory | AC CABLE |
| 31 | sheet4 | meter | net meter |

## 4. Pricing & GST Audit

### Equipment Pricing (1239 records)

### Duplicate Equipment Pricing Records

| Idx | Duplicate of | Type | Description | Capacity | Rate |
| --- | --- | --- | --- | --- | --- |
| 112 | 88 | panel | PANEL | 4.96 | 15500 |
| 113 | 89 | inverter | INVERTER | 4.96 | 8500 |
| 114 | 90 | accessory | COMMUNICATION DEVICE | 4.96 | 12000 |
| 115 | 91 | accessory | CONNECTORS | 4.96 | 700 |
| 116 | 92 | meter | SOLAR METER | 4.96 | 1250 |
| 117 | 93 | accessory | ACCESSORIES | 4.96 |  |
| 118 | 94 | accessory | WIRING PIPE | 4.96 | 65 |
| 119 | 95 | accessory | WIRING ACCESSORIES | 4.96 | 1184 |
| 120 | 96 | lightning_arrester | L/A | 4.96 | 550 |
| 121 | 97 | accessory | EARTH ROD | 4.96 | 250 |
| 122 | 98 | accessory | GI STRIP | 4.96 | 300 |
| 123 | 99 | accessory | EARTH COMPOUND | 4.96 | 165 |
| 125 | 101 | accessory | EARTH BENCH | 4.96 | 175 |
| 126 | 102 | accessory | ACDB | 4.96 | 1400 |
| 127 | 103 | accessory | DCDB | 4.96 | 1750 |
| 128 | 104 | meter | METER BOX | 4.96 | 530 |
| 129 | 105 | accessory | DC CABLE | 4.96 | 39 |
| 130 | 106 | accessory | AC CABLE | 4.96 | 43 |
| 131 | 107 | accessory | ALUM CABLE 50 SQMM | 4.96 | 58 |
| 132 | 108 | accessory | ALUM CABLE 10 SQMM | 4.96 | 16.5 |
| 133 | 109 | accessory | COPPER | 4.96 | 950 |
| 134 | 110 | accessory | MC4(ADDITIONAL) | 4.96 | 22 |
| 135 | 111 | accessory | ISOLATOR | 4.96 | 250 |
| 139 | 69 | accessory | ACCESSORIES | 3.1 |  |
| 144 | 74 | accessory | GI STRIP | 3.1 | 300 |
| 149 | 79 | accessory | DCDB | 3.1 | 1750 |
| 156 | 86 | accessory | MC4(ADDITIONAL) | 3.1 | 22 |
| 161 | 138 | meter | SOLAR METER | 3.1 | 1250 |
| 162 | 69 | accessory | ACCESSORIES | 3.1 |  |
| 163 | 140 | accessory | WIRING PIPE | 3.1 | 65 |

### Equipment Pricing with Zero Rate

| Idx | Type | Description | Rate |
| --- | --- | --- | --- |
| 487 | accessory | GI STRIP | 0 |
| 490 | accessory | EARTH BENCH | 0 |
| 547 | accessory | GI STRIP | 0 |
| 550 | accessory | EARTH BENCH | 0 |
| 625 | accessory | ACCESSORIES | 0 |
| 635 | accessory | DCDB | 0 |
| 648 | accessory | ACCESSORIES | 0 |
| 658 | accessory | DCDB | 0 |
| 711 | accessory | GI STRIP | 0 |
| 727 | meter | SOLAR METER | 0 |
| 733 | lightning_arrester | L/A STAND | 0 |
| 753 | accessory | ISOLATOR | 0 |
| 756 | meter | SOLAR METER | 0 |
| 774 | meter | METER BOX | 0 |

### GST Rates References (367 records)

### Anomalous GST Percentages in gst_rates.json

| Idx | Workbook | Sheet | Row | GST Pct | Issue |
| --- | --- | --- | --- | --- | --- |
| 6 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 18 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 10 | PRICING_13.8%GST.xlsx | Sheet3 | 30 | 3.0882352941 | GST percentage is >50% (potential amount or percentage scaling error) |
| 62 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 19 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 148 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 20 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 175 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 22 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 204 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 4 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 205 | PRICING_13.8%GST.xlsx | 1.5kw | 5 | 4 | GST percentage is >50% (potential amount or percentage scaling error) |
| 206 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 14 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 207 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 17 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 209 | PRICING_13.8%GST.xlsx | Sheet3 | 26 | 3.0909090909 | GST percentage is >50% (potential amount or percentage scaling error) |
| 211 | PRICING_13.8%GST.xlsx | Sheet3 | 28 | 2.2142857143 | GST percentage is >50% (potential amount or percentage scaling error) |
| 213 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 31 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 214 | PRICING_13.8%GST.xlsx | Sheet3 | 32 | 7.3076923077 | GST percentage is >50% (potential amount or percentage scaling error) |
| 217 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 25 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 218 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 26 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 219 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 27 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 221 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 29 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 222 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 30 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 223 | PRICING_13.8%GST.xlsx | hibrid 3 kw | 32 | 1 | GST percentage is >50% (potential amount or percentage scaling error) |
| 259 | PRICING_13.8%GST.xlsx | Sheet5 | 34 | 1.343721 | GST percentage is >50% (potential amount or percentage scaling error) |

### Pricing Rules (52 records)

### Duplicate Rule Names in pricing_rules.json

| Idx | Duplicate of | Rule Name | System Type | Capacity (kW) |
| --- | --- | --- | --- | --- |
| 36 | 34 | pricing_5_premium | ongrid | 5 |
| 37 | 35 | pricing_5_standard | ongrid | 5 |

## 5. Systems Master Audit

### On-Grid Systems (32 records)

### Duplicate On-Grid Systems (same capacity, bom template, systemId)

*No issues found.*

### Hybrid Systems (3 records)

### Duplicate Hybrid Systems (same capacity, bom template, systemId)

*No issues found.*

## 6. Subsidy & State Rules Audit

### Subsidy Rules (26 records)

### PM Surya Ghar Subsidy Discrepancies

| Idx | Rule Name / System ID | Capacity (kW) | Actual Subsidy (₹) | Expected Subsidy (₹) | Discrepancy Details |
| --- | --- | --- | --- | --- | --- |
| 0 | pricing_1.5_premium | 1.5 | 48600 | 45000 | Subsidy of 48600 does not match expected PM Surya Ghar formula subsidy of 45000 |
| 1 | pricing_1.5_standard | 1.5 | 0 | 45000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 45000 |
| 2 | pricing_2_premium | 2 | 62880 | 60000 | Subsidy of 62880 does not match expected PM Surya Ghar formula subsidy of 60000 |
| 3 | pricing_2_standard | 2 | 0 | 60000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 60000 |
| 5 | pricing_3_standard | 3 | 0 | 78000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 78000 |
| 6 | pricing_4_premium | 4 | 0 | 78000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 78000 |
| 7 | pricing_4_standard | 4 | 0 | 78000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 78000 |
| 8 | pricing_5_premium | 5 | 0 | 78000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 78000 |
| 9 | pricing_5_standard | 5 | 0 | 78000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 78000 |
| 10 | pricing_5_premium | 5 | 0 | 78000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 78000 |
| 11 | pricing_5_standard | 5 | 0 | 78000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 78000 |
| 12 | pricing_6_premium | 6 | 0 | 78000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 78000 |
| 13 | pricing_6_standard | 6 | 0 | 78000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 78000 |
| 14 | pricing_8_premium | 8 | 0 | 78000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 78000 |
| 15 | pricing_8_standard | 8 | 0 | 78000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 78000 |
| 16 | pricing_10_premium | 10 | 0 | 78000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 78000 |
| 17 | pricing_10_standard | 10 | 0 | 78000 | Subsidy of 0 does not match expected PM Surya Ghar formula subsidy of 78000 |