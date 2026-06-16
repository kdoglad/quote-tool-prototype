import { useMemo } from 'react'
import type {
  PriceItem,
  ComputedLineItem,
  QuoteLineItemState,
  PriceItemOptionGroup,
  PriceItemOption,
  PartialFormulaScope,
  InclusionStatus,
  AcMapRow,
} from '../types/domain.types'
import { computeLineItemTotal, calculateQtyForLineItem } from '../lib/formulaEngine'
import { calculateAcCableSize } from '../lib/acCalculator'
import type { GroupedOptions } from './usePriceItemOptions'

export interface MarkupSummary {
  proposedMarkup: number;
  targetMarkup: number;
  minimumMarkup: number;
  midPoint: number;
  engHours: number;
  pmHours: number;
  netProfitEst: number;
  targetNpPercent: number;
}

export function calculateMarkupSummary(
  costSubtotal: number,
  systemKw: number,
  complexityScope?: {
    client_cooperativeness?: string
    switchboard_complexity?: string
    misc1?: string
    misc2?: string
    racking?: string
    racking2?: string
    system_complexity?: string
    builders?: string
    architects_consultants?: string
    ppa_funders?: string
    location?: string
    install_timeline?: string
    dnsp_override?: string
    large_small_team?: string
    stc_lgc_split?: string
    transformer?: string
    rollout?: string
    safety?: string
    dnsp?: string
    has_bess?: boolean
    bess_kwh?: number
    hv_customer?: boolean
    has_optimisers?: boolean
    optimisers?: string
    battery_pcm?: string
    hv_customer_pcm?: string
    manual_target_markup?: number | null
    manual_minimum_markup?: number | null
    manual_proposed_markup?: number | null
  }
): MarkupSummary {
  // If there is no system size and no items on the quote, return zero/empty baseline
  if (systemKw <= 0 && costSubtotal <= 0) {
    return {
      proposedMarkup: 0,
      targetMarkup: 0,
      minimumMarkup: 0,
      midPoint: 0,
      engHours: 0,
      pmHours: 0,
      netProfitEst: 0,
      targetNpPercent: 0,
    }
  }

  // If systemKw is <= 0, we fallback to a standard 100kW system size for baseline preview calculations
  const resolvedKw = systemKw > 0 ? systemKw : 100

  // 1. Baseline Engineering Effort (EU)
  let baselineEng = 0
  if (resolvedKw < 40) {
    baselineEng = Math.sqrt(resolvedKw) / 12.5
  } else {
    baselineEng = Math.sqrt(resolvedKw) / 10
  }

  // 2. Baseline PM Effort (EU)
  let baselinePm = 0
  if (resolvedKw < 40) {
    baselinePm = Math.sqrt(resolvedKw) / 12.5
  } else {
    baselinePm = Math.pow(resolvedKw, 0.4) / 5.257977870668275
  }

  // 3. Define Weighting factors
  let engFactor = 1.0
  let pmFactor = 1.0

  // 1. Racking
  const racking = complexityScope?.racking || 'Base Tin Installation'
  const rackingLookups: Record<string, { eng: number; pm: number }> = {
    'Base Tin Installation': { eng: 1.0, pm: 1.0 },
    'Base Tile Installation': { eng: 1.1, pm: 1.1 },
    'Ground Mounted (Fixed Tilt)': { eng: 1.0, pm: 1.0 },
    'Ground Mounted (Single Axis)': { eng: 1.25, pm: 1.25 },
    'Concrete Roof Mounted (not including waterproofing)': { eng: 1.1, pm: 1.3 },
    'Ballasted System': { eng: 1.3, pm: 1.4 },
    'Floating (ex. Anchors and Extras)': { eng: 1.5, pm: 1.5 },
    'Carpark': { eng: 1.25, pm: 1.3 },
  }
  const rackVals = rackingLookups[racking] || rackingLookups['Base Tin Installation']
  engFactor *= rackVals.eng
  pmFactor *= rackVals.pm

  // 2. Racking 2
  const racking2 = complexityScope?.racking2 || 'Flush Mounted'
  const racking2Lookups: Record<string, { eng: number; pm: number }> = {
    'Flush Mounted': { eng: 1.0, pm: 1.0 },
    'Frameless': { eng: 1.0, pm: 1.0 },
    'Klip Lock Addition': { eng: 1.0, pm: 1.0 },
    'Tilt Legs Addition': { eng: 1.0, pm: 1.0 },
    'Wind Zone C/D': { eng: 1.2, pm: 1.05 },
    'Klip Lock + Tilt Legs Addition': { eng: 1.0, pm: 1.0 },
    'Klip Lock Addition + Wind Zone C/D': { eng: 1.1, pm: 1.05 },
    'Tilt Legs + Wind Zone C/D Addition': { eng: 1.15, pm: 1.05 },
    'Klip Lock + Tilt Legs Addition + Wind Zone C/D Addition': { eng: 1.2, pm: 1.05 },
  }
  const rack2Vals = racking2Lookups[racking2] || racking2Lookups['Flush Mounted']
  engFactor *= rack2Vals.eng
  pmFactor *= rack2Vals.pm

  // 3. System Complexity (System Type)
  const sysComplexity = complexityScope?.system_complexity || 'Standard'
  const sysLookups: Record<string, { eng: number; pm: number }> = {
    'Standard': { eng: 1.0, pm: 1.0 },
    'Complex': { eng: 1.2, pm: 1.1 },
    'Multi Roof': { eng: 1.1, pm: 1.1 },
    'Large Scale Roof': { eng: 0.7, pm: 0.9 },
    'Ground mounted mechanical + electrical': { eng: 1.4, pm: 1.4 },
  }
  const sysVals = sysLookups[sysComplexity] || sysLookups['Standard']
  engFactor *= sysVals.eng
  pmFactor *= sysVals.pm

  // 4. Client co-operativeness
  const coop = complexityScope?.client_cooperativeness || 'Average'
  const coopLookups: Record<string, { eng: number; pm: number }> = {
    'Very Co-operative': { eng: 0.9, pm: 0.9 },
    'Average': { eng: 1.0, pm: 1.0 },
    'Difficult': { eng: 1.2, pm: 1.3 },
    'Very Difficult': { eng: 1.3, pm: 1.3 },
    'CUB': { eng: 1.5, pm: 1.5 },
  }
  const coopVals = coopLookups[coop] || coopLookups['Average']
  engFactor *= coopVals.eng
  pmFactor *= coopVals.pm

  // 5. Builders
  const builders = complexityScope?.builders || 'Not Involved'
  const builderLookups: Record<string, { eng: number; pm: number }> = {
    'Heavily or Continuously Involved': { eng: 1.3, pm: 1.3 },
    'Involved': { eng: 1.1, pm: 1.1 },
    'Not Involved': { eng: 1.0, pm: 1.0 },
  }
  const bldVals = builderLookups[builders] || builderLookups['Not Involved']
  engFactor *= bldVals.eng
  pmFactor *= bldVals.pm

  // 6 & 7. Architects/Consultants
  const architectsConsultants = complexityScope?.architects_consultants || 'Not Involved'
  const archConsLookups: Record<string, { eng: number; pm: number }> = {
    'Involved': { eng: 1.2, pm: 1.1 },
    'Not Involved': { eng: 1.0, pm: 1.0 },
  }
  const archConsVals = archConsLookups[architectsConsultants] || archConsLookups['Not Involved']
  engFactor *= archConsVals.eng
  pmFactor *= archConsVals.pm

  // 8. PPA Funders
  const ppa = complexityScope?.ppa_funders || 'Not Involved'
  const ppaLookups: Record<string, { eng: number; pm: number }> = {
    'Not Involved': { eng: 1.0, pm: 1.0 },
    'Clearsky': { eng: 1.0, pm: 1.02 },
    'Solarbay/Green Peak': { eng: 1.1, pm: 1.1 },
  }
  const ppaVals = ppaLookups[ppa] || ppaLookups['Not Involved']
  engFactor *= ppaVals.eng
  pmFactor *= ppaVals.pm

  // 9. Location
  const location = complexityScope?.location || 'Zone1'
  const locationLookups: Record<string, { eng: number; pm: number }> = {
    'Zone1': { eng: 1.0, pm: 1.0 },
    'Zone2': { eng: 1.0, pm: 1.0 },
    'Zone3': { eng: 1.0, pm: 1.0 },
    'Zone4': { eng: 1.0, pm: 1.0 },
    'Zone5': { eng: 1.0, pm: 1.0 },
    'Zone6': { eng: 1.0, pm: 1.0 },
    'Zone7': { eng: 1.0, pm: 1.0 },
    'Zone8': { eng: 1.0, pm: 1.0 },
    'Darwin': { eng: 1.0, pm: 1.0 },
    'Cairns': { eng: 1.0, pm: 1.0 },
  }
  const locationVals = locationLookups[location] || locationLookups['Zone1']
  engFactor *= locationVals.eng
  pmFactor *= locationVals.pm

  // 10. Install Timeline
  const timeline = complexityScope?.install_timeline || 'Unconstrained'
  const timelineLookups: Record<string, { eng: number; pm: number }> = {
    'Unconstrained': { eng: 1.0, pm: 1.0 },
    'Rushed': { eng: 1.0, pm: 1.0 },
    'Very Rushed': { eng: 1.0, pm: 1.0 },
  }
  const timelineVals = timelineLookups[timeline] || timelineLookups['Unconstrained']
  engFactor *= timelineVals.eng
  pmFactor *= timelineVals.pm

  // 11. DNSP
  // Use dnsp_override if present, otherwise fallback to calculated dnsp
  let dnspName = complexityScope?.dnsp_override || 'No Match'
  if (dnspName === 'No Match' || !dnspName) {
      dnspName = complexityScope?.dnsp || 'Ausgrid'
  }
  
  let dnspEng = 1.1
  let dnspPm = 1.0
  if (dnspName.toLowerCase().includes('endeavour')) {
    dnspEng = 0.8
  } else if (dnspName.toLowerCase().includes('essential')) {
    dnspEng = 1.0
  } else if (dnspName.toLowerCase().includes('ergon') || dnspName.toLowerCase().includes('energex')) {
    dnspEng = 1.2
  } else if (dnspName.toLowerCase().includes('horizon') || dnspName.toLowerCase().includes('western')) {
    dnspEng = 1.3
  }
  engFactor *= dnspEng
  pmFactor *= dnspPm

  // 12. Large/Small Team
  const team = complexityScope?.large_small_team || 'Small'
  const teamLookups: Record<string, { eng: number; pm: number }> = {
    'Large': { eng: 1.2, pm: 1.1 },
    'Small': { eng: 0.85, pm: 0.9 },
  }
  const teamVals = teamLookups[team] || teamLookups['Small']
  engFactor *= teamVals.eng
  pmFactor *= teamVals.pm

  // 13. STC/LGC Split
  const stcLgc = complexityScope?.stc_lgc_split || 'No'
  if (stcLgc === 'Yes') {
    engFactor *= 1.1
    pmFactor *= 1.1
  }

  // 14. Switchboard Mods
  const sw = complexityScope?.switchboard_complexity || 'Appears to be Adequate'
  const swLookups: Record<string, { eng: number; pm: number }> = {
    'May Require Upgrade (Excluded from quote)': { eng: 1.1, pm: 1.0 },
    'Appears to be Adequate': { eng: 1.0, pm: 1.0 },
    'Requires extension/New cabinet': { eng: 1.25, pm: 1.1 },
  }
  const swVals = swLookups[sw] || swLookups['Appears to be Adequate']
  engFactor *= swVals.eng
  pmFactor *= swVals.pm

  // 15. Optimisers
  const optimisers = complexityScope?.optimisers || 'Not Required'
  const optimiserLookups: Record<string, { eng: number; pm: number }> = {
    'Required': { eng: 1.2, pm: 1.1 },
    'Not Required': { eng: 1.0, pm: 1.0 },
  }
  const optVals = optimiserLookups[optimisers] || optimiserLookups['Not Required']
  engFactor *= optVals.eng
  pmFactor *= optVals.pm

  // 16. Transformer
  const transformer = complexityScope?.transformer || 'Not Required'
  if (transformer === 'Required') {
    engFactor *= 1.3
    pmFactor *= 1.1
  }

  // 17. Rollout
  const rollout = complexityScope?.rollout || 'No (1-2 sites)'
  const rolloutLookups: Record<string, { eng: number; pm: number }> = {
    'No (1-2 sites)': { eng: 1.0, pm: 1.0 },
    'Yes (3-5 sites)': { eng: 0.9, pm: 0.9 },
    'Yes (5-20 sites)': { eng: 0.8, pm: 0.8 },
    'Yes (20+ sites)': { eng: 0.7, pm: 0.7 },
  }
  const rolloutVals = rolloutLookups[rollout] || rolloutLookups['No (1-2 sites)']
  engFactor *= rolloutVals.eng
  pmFactor *= rolloutVals.pm

  // 18. Safety
  const safety = complexityScope?.safety || 'Standard'
  const safetyLookups: Record<string, { eng: number; pm: number }> = {
    'Standard': { eng: 1.0, pm: 1.0 },
    'Rigorous': { eng: 1.0, pm: 1.15 },
    'Very Rigorous': { eng: 1.1, pm: 1.3 },
  }
  const safetyVals = safetyLookups[safety] || safetyLookups['Standard']
  engFactor *= safetyVals.eng
  pmFactor *= safetyVals.pm

  // 19 & 20. MISC 1 & MISC 2
  const misc1 = complexityScope?.misc1 || 'None'
  const misc2 = complexityScope?.misc2 || 'None'
  const miscLookups: Record<string, { eng: number; pm: number }> = {
    'None': { eng: 1.0, pm: 1.0 },
    'DA': { eng: 1.1, pm: 1.1 },
    'Mine Site': { eng: 2.0, pm: 2.25 },
    'Tricky Cable Run': { eng: 1.1, pm: 1.1 },
    'AFC Not In Scope': { eng: 0.8, pm: 1.0 },
    'Building Certification': { eng: 1.1, pm: 1.1 },
    'Carport (SCP)': { eng: 1.4, pm: 1.8 },
    'Carport (Other)': { eng: 1.3, pm: 1.5 },
    'Building Height >20m': { eng: 1.2, pm: 1.2 },
    'GSES': { eng: 0.4, pm: 1.2 },
    'Generator on site': { eng: 1.1, pm: 1.05 },
  }
  const misc1Vals = miscLookups[misc1] || miscLookups['None']
  const misc2Vals = miscLookups[misc2] || miscLookups['None']
  engFactor *= misc1Vals.eng * misc2Vals.eng
  pmFactor *= misc1Vals.pm * misc2Vals.pm

  // 21. Battery
  const battery = complexityScope?.battery_pcm || 'None'
  if (battery === 'Included' && resolvedKw > 0) {
    // Determine bess_kwh if manually provided, else default to some sensible value or use 0
    const bessKwh = complexityScope?.bess_kwh || 0
    if (bessKwh > 0) {
      const bessMultiplier = 1.2 + 0.4 * Math.pow(bessKwh / resolvedKw, 0.5)
      engFactor *= bessMultiplier
      pmFactor *= bessMultiplier
    } else {
      // If no capacity specified, apply a minimum bump
      engFactor *= 1.2
      pmFactor *= 1.2
    }
  }

  // 22. HV Customer
  const hvCust = complexityScope?.hv_customer_pcm || 'No'
  const hvLookups: Record<string, { eng: number; pm: number }> = {
    'No': { eng: 1.0, pm: 1.0 },
    'Unknown': { eng: 1.02, pm: 1.02 },
    'Yes': { eng: 1.15, pm: 1.1 },
  }
  const hvVals = hvLookups[hvCust] || hvLookups['No']
  engFactor *= hvVals.eng
  pmFactor *= hvVals.pm

  // 23. Internal Scaling Factor (Flat 1.1 / 1.1)
  engFactor *= 1.1
  pmFactor *= 1.1

  // 4. Scaling hours (Dividing by standard sheet scaling weights 1.38 and 2.05)
  const engHours = 66 * (engFactor / 1.38) * baselineEng
  const pmHours = 86 * (pmFactor / 2.05) * baselinePm

  // If costSubtotal is <= 0, we simulate a typical ex-GST cost subtotal based on system size ($0.922 per watt)
  // to calculate a realistic preview markup multiplier.
  const resolvedCost = costSubtotal > 0 ? costSubtotal : resolvedKw * 922.0469294115555

  // 5. Denominator for overhead markup
  const denominator = 0.8900217846153846

  // 6. Markup Thresholds
  const calculatedTargetMarkup = ((resolvedCost + 94.86498769548305 * engHours + 112.68498769548304 * pmHours) / resolvedCost) / denominator
  const calculatedMinimumMarkup = ((resolvedCost + 45.25 * engHours + 63.07 * pmHours) / resolvedCost) / denominator
  
  const targetMarkup = complexityScope?.manual_target_markup ?? calculatedTargetMarkup
  const minimumMarkup = complexityScope?.manual_minimum_markup ?? calculatedMinimumMarkup
  const midPoint = (targetMarkup + minimumMarkup) / 2
  const proposedMarkup = complexityScope?.manual_proposed_markup ?? targetMarkup

  // 7. Net Profit and Target NP (%)
  const netProfitEst = (94.86498769548305 - 45.25) * engHours + (112.68498769548304 - 63.07) * pmHours
  const netBeforeGST = resolvedCost * proposedMarkup
  const targetNpPercent = netBeforeGST > 0 ? (netProfitEst / netBeforeGST) : 0

  return {
    proposedMarkup,
    targetMarkup,
    minimumMarkup,
    midPoint,
    engHours,
    pmHours,
    netProfitEst,
    targetNpPercent,
  }
}

export function useComputedLineItems(
  priceItems: PriceItem[],
  lineItems: QuoteLineItemState[],
  scope: PartialFormulaScope,
  optionData: GroupedOptions = { groups: [], options: [] },
  acMap: AcMapRow[] = []
): ComputedLineItem[] {
  return useMemo(() => {
    // Index stored line items by price_item_id
    const storedByPriceItemId = new Map<string, QuoteLineItemState[]>()
    const customLineItems: QuoteLineItemState[] = []

    for (const li of lineItems) {
      if (li.price_item_id !== null) {
        const arr = storedByPriceItemId.get(li.price_item_id) ?? []
        arr.push(li)
        storedByPriceItemId.set(li.price_item_id, arr)
      } else {
        customLineItems.push(li)
      }
    }

    // Index option groups by price_item_id
    const groupsByItemId = new Map<string, PriceItemOptionGroup[]>()
    for (const g of optionData.groups) {
      const arr = groupsByItemId.get(g.price_item_id) ?? []
      arr.push(g)
      groupsByItemId.set(g.price_item_id, arr)
    }

    // Index options by id (for modifier lookup)
    const optionById = new Map<string, PriceItemOption>()
    for (const opt of optionData.options) {
      optionById.set(opt.id, opt)
    }

    const panelPriceItem = priceItems.find((item) => item.type_value === 'panels')
    let panelWattage = 440
    let panelQty = 0

    if (panelPriceItem) {
      panelWattage = parseFloat(panelPriceItem.specData?.wattage) || 440
      const storedList = storedByPriceItemId.get(panelPriceItem.id)
      const stored = storedList && storedList[0]
      if (stored) {
        const useCalculatedQty = stored.use_calculated_qty ?? false
        const calculatedQty = Math.floor(((scope.system_kw || 0) * 1000) / panelWattage)
        panelQty = useCalculatedQty ? calculatedQty : (stored.qty ?? 1)
      } else {
        panelQty = Math.floor(((scope.system_kw || 0) * 1000) / panelWattage)
      }
    } else {
      panelQty = Math.floor(((scope.system_kw || 0) * 1000) / panelWattage)
    }

    let invertersQty = 0
    const inverterItems = priceItems.filter(i => i.type_value === 'inverters')
    for (const inv of inverterItems) {
      const storedList = storedByPriceItemId.get(inv.id)
      if (storedList && storedList.length > 0) {
        for (const stored of storedList) {
          if (inclusionToBoolean(stored.inclusion_status)) {
            const useCalculatedQty = stored.use_calculated_qty ?? false
            const useManualQty = stored.use_manual_qty ?? !useCalculatedQty
            if (useCalculatedQty) invertersQty += calculateQtyForLineItem(inv, scope)
            if (useManualQty) invertersQty += stored.qty
          }
        }
      } else {
        invertersQty += calculateQtyForLineItem(inv, scope)
      }
    }

    const enhancedScope: PartialFormulaScope & { inverters_qty?: number } = {
      ...scope,
      panel_wattage: panelWattage,
      panel_qty: panelQty,
      inverters_qty: invertersQty,
    }

    const dcPricingMap = priceItems.filter(i => i.type_value === 'dc_twin_cabling')

    const results: ComputedLineItem[] = []

    // ── Standard price items ──────────────────────────────────
    for (const item of priceItems) {
      const groups = groupsByItemId.get(item.id) ?? []
      const stored = storedByPriceItemId.get(item.id)

      if (stored && stored.length > 0) {
        const sorted = [...stored].sort((a, b) => {
          const aPrimary = a.instance_id === item.id ? 0 : 1
          const bPrimary = b.instance_id === item.id ? 0 : 1
          if (aPrimary !== bPrimary) return aPrimary - bPrimary
          return a.sort_order - b.sort_order
        })
        for (const inst of sorted) {
          results.push(buildFromStored(item, inst, groups, optionById, enhancedScope, dcPricingMap))
        }
      } else {
        results.push(buildVirtualDefault(item, groups, optionById, enhancedScope, dcPricingMap))
      }
    }

    // ── Virtual AC Line Items ─────────────────────────────
    const invToPvdb = buildVirtualAcCabling('AC Inverter to PVDB Cabling', 'ac_inverter_to_pvdb', enhancedScope, acMap || [])
    if (invToPvdb) results.push(invToPvdb)

    const pvdbToMsb = buildVirtualAcCabling('AC PVDB to MSB Cabling', 'ac_pvdb_to_msb', enhancedScope, acMap || [])
    if (pvdbToMsb) results.push(pvdbToMsb)

    // ── Custom items ──────────────────────────────────────────
    const sortedCustom = [...customLineItems].sort((a, b) => a.sort_order - b.sort_order)
    for (const li of sortedCustom) {
      results.push(buildCustomItem(li, enhancedScope))
    }

    // ── Dynamic Markup Adjustment ─────────────────────────────
    const nonRebateItems = results.filter((r) => r.is_included && r.category !== 'Rebates')
    const costSubtotal = nonRebateItems.reduce((sum, r) => sum + r.cost, 0)
    const systemKw = enhancedScope.system_kw || 0

    // Auto-detect optimisers in the selected list
    const hasOptimisers = results.some(
      (r) =>
        r.is_included &&
        (r.code?.toLowerCase().includes('optimiser') ||
          r.name?.toLowerCase().includes('optimiser') ||
          r.type_value?.toLowerCase().includes('optimiser'))
    )

    const finalScope = {
      ...enhancedScope,
      has_optimisers: hasOptimisers,
    }

    const markupSummary = calculateMarkupSummary(costSubtotal, systemKw, finalScope)
    const finalProposedMarkup = markupSummary.proposedMarkup

    results.forEach((r) => {
      if (r.category === 'Rebates') {
        r.sales_rate = r.cost
        r.sale_per_watt = r.cost_per_watt
      } else {
        r.sales_rate = r.cost * finalProposedMarkup
        r.sale_per_watt = r.cost_per_watt * finalProposedMarkup
      }
    })

    return results
  }, [priceItems, lineItems, scope, optionData, acMap])
}

// ── Helpers ──────────────────────────────────────────────────

function inclusionToBoolean(status: InclusionStatus): boolean {
  return status === 'included' || status === 'provisional_sum'
}

/**
 * Apply option modifiers on top of a formula-evaluated total.
 * Groups are applied in sort_order. Within a group, only the selected option fires.
 */
function applyOptionModifiers(
  formulaTotal: number,
  selectedOptions: Record<string, string>,   // groupId → optionId
  groups: PriceItemOptionGroup[],
  optionById: Map<string, PriceItemOption>
): number {
  let total = formulaTotal
  for (const group of groups) {
    const chosenId = selectedOptions[group.id]
    if (!chosenId) {
      // No explicit selection — use the default option if one exists
      const defaultOpt = (group.options ?? []).find((o) => o.is_default)
      if (defaultOpt) {
        total = applyOne(total, defaultOpt)
      }
      continue
    }
    const opt = optionById.get(chosenId)
    if (opt) total = applyOne(total, opt)
  }
  return total
}

function applyOne(total: number, opt: PriceItemOption): number {
  switch (opt.modifier_type) {
    case 'flat':    return total + opt.modifier_value
    case 'percent': return total * (1 + opt.modifier_value / 100)
    case 'replace': return opt.modifier_value
    default:        return total
  }
}

function buildFromStored(
  item: PriceItem,
  inst: QuoteLineItemState,
  groups: PriceItemOptionGroup[],
  optionById: Map<string, PriceItemOption>,
  scope: PartialFormulaScope,
  dcPricingMap: PriceItem[]
): ComputedLineItem {
  const isIncluded = inclusionToBoolean(inst.inclusion_status)
  const isDuplicate = inst.instance_id !== item.id
  const activeFormula = inst.formula_override ?? item.formula

  let effectiveItem = activeFormula !== item.formula
    ? { ...item, formula: activeFormula }
    : { ...item }

  // Inject Dynamic Pricing and Units for Cabling
  applyDynamicCabling(effectiveItem, scope, dcPricingMap)

  const calculatedQty = calculateQtyForLineItem(effectiveItem, scope)
  const useCalculatedQty = inst.use_calculated_qty ?? false
  const useManualQty = inst.use_manual_qty ?? !useCalculatedQty
  let effectiveQty = 0;
  if (useCalculatedQty) effectiveQty += calculatedQty;
  if (useManualQty) effectiveQty += inst.qty;

  let formulaTotal = isIncluded
    ? computeLineItemTotal(effectiveItem, effectiveQty, scope, { type: inst.modifier_type, value: inst.modifier_value })
    : 0

  const computedTotal = isIncluded
    ? applyOptionModifiers(formulaTotal, inst.selected_options, groups, optionById)
    : 0

  const systemKw = scope.system_kw || 0
  const cost = computedTotal
  const cost_per_watt = systemKw > 0 ? (cost / (systemKw * 1000)) : 0
  const sales_rate = item.category === 'Rebates' ? cost : (cost * 1.241452107343087)
  const sale_per_watt = item.category === 'Rebates' ? cost_per_watt : (cost_per_watt * 1.241452107343087)

  return {
    id: inst.instance_id,
    instance_id: inst.instance_id,
    quote_id: '',
    price_item_id: item.id,
    is_custom: false,
    is_duplicate: isDuplicate,
    is_removable: isDuplicate,
    inclusion_status: inst.inclusion_status,
    is_included: isIncluded,
    category: item.category,
    subcategory: item.subcategory === 'Lifting Equipment' ? 'Lifting Equipment/Battery Install' : item.subcategory,
    code: item.code,
    name: item.name,
    unit: item.unit,
    qty: effectiveQty,
    manual_qty: inst.qty,
    calculated_qty: calculatedQty,
    use_calculated_qty: useCalculatedQty,
    use_manual_qty: useManualQty,
    base_unit_price: item.base_price,
    formula: activeFormula,
    default_formula: item.formula,
    formula_override: inst.formula_override,
    active_formula: activeFormula,
    modifier_type: inst.modifier_type,
    modifier_value: inst.modifier_value,
    modifier_note: inst.modifier_note,
    computed_total: computedTotal,
    formula_total: formulaTotal,
    option_groups: groups,
    selected_options: inst.selected_options,
    sort_order: item.sort_order + (isDuplicate ? inst.sort_order * 0.001 : 0),
    specData: item.specData,
    type_value: item.type_value,
    cost,
    cost_per_watt,
    sales_rate,
    sale_per_watt,
  }
}

function buildVirtualDefault(
  item: PriceItem,
  groups: PriceItemOptionGroup[],
  optionById: Map<string, PriceItemOption>,
  scope: PartialFormulaScope,
  dcPricingMap: PriceItem[]
): ComputedLineItem {
  const inclusionStatus: InclusionStatus = 'not_required'
  const isIncluded = false

  const effectiveItem = { ...item }
  applyDynamicCabling(effectiveItem, scope, dcPricingMap)

  const calculatedQty = calculateQtyForLineItem(effectiveItem, scope)
  const useCalculatedQty = false
  const useManualQty = true
  const effectiveQty = useCalculatedQty ? calculatedQty : 1

  let formulaTotal = isIncluded
    ? computeLineItemTotal(item, effectiveQty, scope, { type: 'none', value: 0 })
    : 0

  const computedTotal = isIncluded
    ? applyOptionModifiers(formulaTotal, {}, groups, optionById)
    : 0

  const systemKw = scope.system_kw || 0
  const cost = computedTotal
  const cost_per_watt = systemKw > 0 ? (cost / (systemKw * 1000)) : 0
  const sales_rate = item.category === 'Rebates' ? cost : (cost * 1.241452107343087)
  const sale_per_watt = item.category === 'Rebates' ? cost_per_watt : (cost_per_watt * 1.241452107343087)

  return {
    id: item.id,
    instance_id: item.id,
    quote_id: '',
    price_item_id: item.id,
    is_custom: false,
    is_duplicate: false,
    is_removable: false,
    inclusion_status: inclusionStatus,
    is_included: isIncluded,
    category: item.category,
    subcategory: item.subcategory === 'Lifting Equipment' ? 'Lifting Equipment/Battery Install' : item.subcategory,
    code: item.code,
    name: item.name,
    unit: item.unit,
    qty: effectiveQty,
    manual_qty: 1,
    calculated_qty: calculatedQty,
    use_calculated_qty: useCalculatedQty,
    use_manual_qty: useManualQty,
    base_unit_price: item.base_price,
    formula: item.formula,
    default_formula: item.formula,
    formula_override: null,
    active_formula: item.formula,
    modifier_type: 'none',
    modifier_value: 0,
    modifier_note: '',
    computed_total: computedTotal,
    formula_total: formulaTotal,
    option_groups: groups,
    selected_options: {},
    sort_order: item.sort_order,
    specData: item.specData,
    type_value: item.type_value,
    cost,
    cost_per_watt,
    sales_rate,
    sale_per_watt,
  }
}

function buildCustomItem(li: QuoteLineItemState, scope: PartialFormulaScope): ComputedLineItem {
  const isIncluded = inclusionToBoolean(li.inclusion_status)
  const formulaTotal = isIncluded
    ? computeLineItemTotal(
        { formula: li.custom_formula ?? null, base_price: li.custom_base_price ?? 0 },
        li.qty,
        scope,
        { type: li.modifier_type, value: li.modifier_value }
      )
    : 0

  const systemKw = scope.system_kw || 0
  const cost = formulaTotal
  const cost_per_watt = systemKw > 0 ? (cost / (systemKw * 1000)) : 0
  const isRebate = (li.custom_category ?? 'Custom') === 'Rebates'
  const sales_rate = isRebate ? cost : (cost * 1.241452107343087)
  const sale_per_watt = isRebate ? cost_per_watt : (cost_per_watt * 1.241452107343087)

  return {
    id: li.instance_id,
    instance_id: li.instance_id,
    quote_id: '',
    price_item_id: null,
    is_custom: true,
    is_duplicate: false,
    is_removable: true,
    inclusion_status: li.inclusion_status,
    is_included: isIncluded,
    category: li.custom_category ?? 'Custom',
    subcategory: null,
    code: li.custom_code ?? 'CUST',
    name: li.custom_name ?? 'Custom Item',
    unit: li.custom_unit ?? 'ea',
    qty: li.qty,
    manual_qty: li.qty,
    calculated_qty: li.qty,
    use_calculated_qty: false,
    use_manual_qty: true,
    base_unit_price: li.custom_base_price ?? 0,
    formula: li.custom_formula ?? null,
    default_formula: li.custom_formula ?? null,
    formula_override: null,
    active_formula: li.custom_formula ?? null,
    modifier_type: li.modifier_type,
    modifier_value: li.modifier_value,
    modifier_note: li.modifier_note,
    computed_total: formulaTotal,
    formula_total: formulaTotal,
    option_groups: [],
    selected_options: {},
    sort_order: li.sort_order,
    specData: undefined,
    type_value: undefined,
    cost,
    cost_per_watt,
    sales_rate,
    sale_per_watt,
  }
}

function buildVirtualAcCabling(
  name: string,
  typeValue: string,
  scope: PartialFormulaScope,
  acMap: AcMapRow[]
): ComputedLineItem | null {
  const isInv = typeValue === 'ac_inverter_to_pvdb'
  const materialType = (isInv ? scope.ac_inverter_pvdb_type : scope.ac_pvdb_msb_type) || 'Included - Copper'
  const construction = (isInv ? scope.ac_inverter_pvdb_construction : scope.ac_pvdb_msb_construction) || 'Single Core'
  const lengthM = (isInv ? scope.ac_inverter_pvdb_m : scope.ac_pvdb_msb_m) || 0

  const isIncluded = !materialType.includes('Not Included') && materialType !== 'No Match' && lengthM > 0

  const material = materialType.toLowerCase().includes('alu') ? 'Aluminium' : 'Copper'
  const acKw = (scope.system_kw || 100) 
  const size = calculateAcCableSize(acKw, lengthM, material)

  const mapRow = acMap.find(row => row.size_mm2 == size)
  let basePrice = 0
  if (mapRow) {
    const is4C = construction.includes('4C')
    const price = is4C
      ? (material === 'Copper' ? mapRow.copper_4c_e : mapRow.alu_4c_e)
      : (material === 'Copper' ? mapRow.copper_single_core : mapRow.alu_single_core)
    
    if (price !== null && !isNaN(price)) {
      basePrice = price
    }
  }

  const cost = isIncluded ? (basePrice * lengthM) : 0
  const systemKw = scope.system_kw || 0
  const cost_per_watt = systemKw > 0 ? (cost / (systemKw * 1000)) : 0
  const sales_rate = cost * 1.241452107343087
  const sale_per_watt = cost_per_watt * 1.241452107343087

  return {
    id: `virtual-${typeValue}`,
    instance_id: `virtual-${typeValue}`,
    quote_id: '',
    price_item_id: null,
    is_custom: true,
    is_duplicate: false,
    is_removable: false,
    inclusion_status: isIncluded ? 'included' : 'not_required',
    is_included: isIncluded,
    category: 'AC_Calculation',
    subcategory: 'AC Cabling',
    code: isInv ? 'CAB-AC-INV' : 'CAB-AC-MSB',
    name: `${name} - ${size} mm (${material})`,
    unit: `${size} mm`,
    qty: lengthM,
    manual_qty: lengthM,
    calculated_qty: parseFloat(size) || 0,
    use_calculated_qty: false,
    use_manual_qty: true,
    base_unit_price: basePrice,
    formula: null,
    default_formula: null,
    formula_override: null,
    active_formula: null,
    modifier_type: 'none',
    modifier_value: 0,
    modifier_note: null,
    computed_total: cost,
    formula_total: cost,
    option_groups: [],
    selected_options: {},
    sort_order: isInv ? 40 : 41,
    cost,
    cost_per_watt,
    sales_rate,
    sale_per_watt,
  }
}

function applyDynamicCabling(
  effectiveItem: PriceItem,
  scope: PartialFormulaScope,
  dcPricingMap: PriceItem[]
) {
  if (effectiveItem.type_value === 'dc_twin_cabling' || effectiveItem.subcategory === 'DC Cabling') {
    const dcSize = scope.dc_cable_size || '4 mm'
    const cleanSize = dcSize.replace('mm', '').trim()
    effectiveItem.unit = `${cleanSize} mm`
    
    const mapRow = dcPricingMap.find(row => row.specData?.size_twin_dc_cable_mm == cleanSize || row.specData?.dc_cabling_name === dcSize)
    if (mapRow) {
      const price = parseFloat(mapRow.specData?.twin_dc_cable_price_per_mm)
      if (!isNaN(price)) {
        effectiveItem.base_price = price
      }
    }
  }
}

export function useQuoteTotals(items: ComputedLineItem[], systemKw?: number, complexityScope?: any) {
  return useMemo(() => {
    const includedItems = items.filter((i) => i.is_included)
    const rebateItems = includedItems.filter((i) => i.category === 'Rebates')
    const nonRebateItems = includedItems.filter((i) => i.category !== 'Rebates')

    const costSubtotal = nonRebateItems.reduce((sum, i) => sum + i.cost, 0)

    let resolvedSystemKw = systemKw || 0
    if (!resolvedSystemKw) {
      const itemWithW = items.find((i) => i.cost_per_watt > 0 && i.cost > 0)
      if (itemWithW) {
        resolvedSystemKw = itemWithW.cost / (itemWithW.cost_per_watt * 1000)
      }
    }

    const markupSummary = calculateMarkupSummary(costSubtotal, resolvedSystemKw, complexityScope)

    const subtotal = nonRebateItems.reduce((sum, i) => sum + i.sales_rate, 0)
    const rebateTotal = rebateItems.reduce((sum, i) => sum + i.sales_rate, 0)
    const netBeforeGST = subtotal + rebateTotal
    const gst = netBeforeGST * 0.10
    const total = netBeforeGST + gst

    return {
      subtotal,
      rebateTotal,
      netBeforeGST,
      gst,
      total,
      costSubtotal,
      ...markupSummary,
    }
  }, [items, systemKw, complexityScope])
}
