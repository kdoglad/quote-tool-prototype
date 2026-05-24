import { useMemo } from 'react'
import type {
  PriceItem,
  ComputedLineItem,
  QuoteLineItemState,
  PriceItemOptionGroup,
  PriceItemOption,
  PartialFormulaScope,
  InclusionStatus,
} from '../types/domain.types'
import { computeLineItemTotal } from '../lib/formulaEngine'
import type { GroupedOptions } from './usePriceItemOptions'

export function useComputedLineItems(
  priceItems: PriceItem[],
  lineItems: QuoteLineItemState[],
  scope: PartialFormulaScope,
  optionData: GroupedOptions = { groups: [], options: [] }
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
          results.push(buildFromStored(item, inst, groups, optionById, scope))
        }
      } else {
        results.push(buildVirtualDefault(item, groups, optionById, scope))
      }
    }

    // ── Custom items ──────────────────────────────────────────
    const sortedCustom = [...customLineItems].sort((a, b) => a.sort_order - b.sort_order)
    for (const li of sortedCustom) {
      results.push(buildCustomItem(li, scope))
    }

    return results
  }, [priceItems, lineItems, scope, optionData])
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
  scope: PartialFormulaScope
): ComputedLineItem {
  const isIncluded = inclusionToBoolean(inst.inclusion_status)
  const isDuplicate = inst.instance_id !== item.id
  const activeFormula = inst.formula_override ?? item.formula

  const effectiveItem = activeFormula !== item.formula
    ? { ...item, formula: activeFormula }
    : item

  const formulaTotal = isIncluded
    ? computeLineItemTotal(effectiveItem, inst.qty, scope, { type: inst.modifier_type, value: inst.modifier_value })
    : 0

  const computedTotal = isIncluded
    ? applyOptionModifiers(formulaTotal, inst.selected_options, groups, optionById)
    : 0

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
    subcategory: item.subcategory,
    code: item.code,
    name: item.name,
    unit: item.unit,
    qty: inst.qty,
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
  }
}

function buildVirtualDefault(
  item: PriceItem,
  groups: PriceItemOptionGroup[],
  optionById: Map<string, PriceItemOption>,
  scope: PartialFormulaScope
): ComputedLineItem {
  const inclusionStatus: InclusionStatus = 'not_required'
  const isIncluded = false

  const formulaTotal = isIncluded
    ? computeLineItemTotal(item, 1, scope, { type: 'none', value: 0 })
    : 0

  const computedTotal = isIncluded
    ? applyOptionModifiers(formulaTotal, {}, groups, optionById)
    : 0

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
    subcategory: item.subcategory,
    code: item.code,
    name: item.name,
    unit: item.unit,
    qty: 1,
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
  }
}

export function useQuoteTotals(items: ComputedLineItem[]) {
  return useMemo(() => {
    const includedItems = items.filter((i) => i.is_included)
    const rebateItems = includedItems.filter((i) => i.category === 'Rebates')
    const nonRebateItems = includedItems.filter((i) => i.category !== 'Rebates')

    const subtotal = nonRebateItems.reduce((sum, i) => sum + i.computed_total, 0)
    const rebateTotal = rebateItems.reduce((sum, i) => sum + i.computed_total, 0)
    const netBeforeGST = subtotal + rebateTotal
    const gst = netBeforeGST * 0.10
    const total = netBeforeGST + gst

    return { subtotal, rebateTotal, netBeforeGST, gst, total }
  }, [items])
}
