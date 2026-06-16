# Quote Calculation Formula Mapping

This document maps the Excel formulas from `XXkWp_Project Name_PCC_INTERNAL_V22.9` to the TypeScript implementation in `quoteEngine.ts`.

## Overview

After unhiding the hidden sheets, the following calculation structure was discovered:

### Key Sheets
1. **SOLAR** - Main quote summary and line items (rows 30-124)
2. **Projects PnL** - Profit & Loss breakdown by category
3. **Linking Cells** - Links data between sheets for agreements
4. **Internal** & **Internal 2** - Project management effort calculations
5. **DNSP Calc** - DNSP-specific calculations
6. **Rebates** - STC and VEEC rebate calculations
7. **AC Calculator** - AC system sizing calculations
8. **Procore Budget** - Budget export formatting

## Main Calculation Flow (SOLAR Sheet)

### Summary Calculations (Rows 13-21)

| Cell | Excel Formula | Description | TypeScript |
|------|---------------|-------------|------------|
| L13 | `=K124` | Total System Value (Ex. GST) | `totalSystemValueExGst` |
| J14 | `=I124` | Install Cost | `totalInstallCost` |
| L14 | `=L13*0.1` | GST | `gst = totalSystemValueExGst * 0.1` |
| J15 | `=J124` | Cost per Watt | `costPerWatt` |
| L15 | `=SUM(L13:L14)` | Total Inc. GST | `totalSystemValueIncGst` |
| J16 | `=O14` | Markup | `inputs.pricing.proposedMarkup` |
| J17 | `=I17*SUM(I31:I117)` | Contingency | Calculated in subtotals |
| L17 | `=IF(F13>100,IF(F19="Yes",MIN(100,100-F22),0),MIN(100-F22,F13))` | Claimed STC Capacity | `claimedCapacity` in `calculateStcRebate()` |
| J18 | `=K124` | Sale Price | `salePrice` |
| L18 | `=2031-F20` | Deeming Period | `deemingPeriodYears = 2031 - installYear` |
| J19 | `=L124` | Sale Price per Watt | `salePricePerWatt` |
| L19 | `=Rebates!B13` | STC Discount | `stcDiscountExGst` |
| J20 | `=(J18-J14)` | Profit Margin | `profitMargin = salePrice - totalInstallCost` |
| J21 | `=J20/J18` | Gross Profit % | `grossProfitPercent = (profitMargin / salePrice) * 100` |

### Line Item Calculations (Rows 31-122)

Each line item has 4 columns:
- **Column I**: Cost = Base price or VLOOKUP from spec sheets
- **Column J**: $/W Cost = `I / (F13 * 1000)` where F13 is system size in kW
- **Column K**: Sales Rate = `I * J16` where J16 is markup
- **Column L**: Sale $/W = `J * J16`

Example from row 31 (Preliminaries):
```excel
I31: =IF(D18="Yes",0,IFERROR(VLOOKUP(TRUE,'1. Prelim'!C8:M67,11,FALSE)*0.9,"Talk To Projects"))
J31: =I31/($F$13*1000)
K31: =I31*$J$16
L31: =J31*$J$16
```

### Total Calculations (Row 124)

| Cell | Excel Formula | Description |
|------|---------------|-------------|
| I124 | `=SUM(I31:I122)` | Total Install Cost |
| J124 | `=SUM(J31:J122)` | Total Cost per Watt |
| K124 | `=SUM(K31:K122)+J17` | Total Sales (with contingency) |
| L124 | `=SUM(L31:L122)+J17/(F13*1000)` | Total Sale per Watt |

## STC Rebate Calculation

### Claimed Capacity (SOLAR L17)
```excel
=IF(F13>100, IF(F19="Yes", MIN(100,100-F22), 0), MIN(100-F22,F13))
```

Logic:
- If system > 100kW:
  - If "STCs on 1st 100kW" = Yes: MIN(100, 100 - existing solar)
  - Else: 0
- If system ≤ 100kW: MIN(100 - existing solar, system size)

### STC Quantity (Rebates Sheet)
```excel
=Claimed Capacity × Zone Factor × Deeming Period
```

Zone Factors:
- NSW/ACT/VIC: 1.382
- QLD/SA/WA/NT: 1.536
- TAS: 1.185

### STC Discount
```excel
=STC Quantity × STC Price
```

## Projects PnL Sheet

Breaks down costs by category using SUMIF:

```excel
C3 (Sold ex GST): =C30+C4+C10
C4 (Contractor Costs): =SUM(C5:C9)
C5 (Labour): =SUMIF(SOLAR!$H$30:$H$124,'Projects PnL'!B5,SOLAR!$I$30:$I$124)
C10 (SCS Costs): =SUM(C11:C29)
```

Categories summed:
- Labour
- BOS (Balance of System)
- Travel/Accommodation
- Site Inspection
- Structural
- AFC (Application for Connection)
- Engineering
- Project Management
- etc.

## TypeScript Implementation

### Updated Functions

1. **`calculateStcRebate()`** - Now includes:
   - Existing solar consideration
   - Proper claimed capacity logic matching Excel L17
   - Deeming period = 2031 - install year

2. **`calculateComponentCosts()`** - Calculates:
   - Cost per item
   - Cost per watt = cost / (systemKw * 1000)
   - Sales rate = cost × markup
   - Sale per watt = cost per watt × markup

3. **`calculateQuote()`** - Main function:
   - Sums all subtotals
   - Applies markup
   - Calculates rebates with existing solar
   - Computes profit metrics
   - Returns structured result

### Formula Matching

| Excel | TypeScript |
|-------|------------|
| `=I*J16` | `cost * (1 + markup)` |
| `=I/(F13*1000)` | `cost / (systemKw * 1000)` |
| `=SUM(I31:I122)` | `subtotals.reduce((sum, cat) => sum + cat.totalCost, 0)` |
| `=(K124-I124)/K124` | `(salePrice - totalInstallCost) / salePrice` |

## Key Improvements from Unhidden Sheets

1. **Accurate STC Calculation**: Now properly handles systems > 100kW and existing solar
2. **Deeming Period**: Correctly uses 2031 - install year
3. **Claimed Capacity**: Implements the exact Excel logic for STC eligibility
4. **Cost Structure**: Matches the 4-column structure (Cost, $/W Cost, Sales, Sale $/W)
5. **Profit Calculations**: Uses Excel's exact formulas for margin and gross profit %

## Next Steps

To fully replicate Excel calculations:

1. **VLOOKUP Integration**: Connect to Supabase spec tables for dynamic pricing
2. **Conditional Logic**: Implement IF statements for optional items
3. **DNSP Rules**: Add DNSP-specific calculations from DNSP Calc sheet
4. **AC Calculator**: Integrate AC sizing formulas
5. **Procore Export**: Add budget export formatting

## Testing

Compare TypeScript output with Excel for:
- [ ] 50kW system with no existing solar
- [ ] 150kW system with 20kW existing solar
- [ ] System with BESS
- [ ] System with EV chargers
- [ ] Different states (zone factors)
- [ ] Different install years (deeming periods)
