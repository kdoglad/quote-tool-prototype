import { create, all } from 'mathjs'
import type { FormulaScope, FormulaEvalResult, PartialFormulaScope, ModifierType } from '../types/domain.types'
import type { PriceItem } from '../types/domain.types'
import { DEFAULT_SCOPE_VALUES } from './constants'

// Create a restricted mathjs instance
const math = create(all)

// Block unsafe functions
math.import(
  {
    import: () => { throw new Error('disabled') },
    createUnit: () => { throw new Error('disabled') },
    evaluate: () => { throw new Error('disabled') },
    parse: () => { throw new Error('disabled') },
    simplify: () => { throw new Error('disabled') },
    derivative: () => { throw new Error('disabled') },
  },
  { override: true }
)

// Allowed safe math functions injected into scope
const SAFE_FUNCTIONS = {
  abs: Math.abs,
  max: (...args: number[]) => Math.max(...args),
  min: (...args: number[]) => Math.min(...args),
  round: Math.round,
  ceil: Math.ceil,
  floor: Math.floor,
  sqrt: Math.sqrt,
  pow: Math.pow,
}

const FORMULA_TIMEOUT_MS = 100

/**
 * Build a complete formula scope from partial quote inputs + item-level values.
 */
export function buildScope(
  quoteInputs: Partial<PartialFormulaScope>,
  itemOverrides: { base_price: number; qty: number }
): FormulaScope {
  return {
    ...DEFAULT_SCOPE_VALUES,
    ...quoteInputs,
    base_price: itemOverrides.base_price,
    qty: itemOverrides.qty,
  }
}

/**
 * Evaluate a single formula string against a scope.
 * Returns { value, error } — never throws.
 */
export function evaluateFormula(formula: string, scope: FormulaScope): FormulaEvalResult {
  const startTime = Date.now()

  try {
    const node = math.parse(formula)

    // Walk the AST and block unsafe node types
    let unsafe = false
    node.traverse((n: { type: string }) => {
      if (n.type === 'AssignmentNode') unsafe = true
      if (n.type === 'BlockNode') unsafe = true
      if (n.type === 'FunctionAssignmentNode') unsafe = true
    })

    if (unsafe) {
      return { value: 0, error: 'Formula contains unsafe operations (assignment not allowed)' }
    }

    const fullScope = { ...SAFE_FUNCTIONS, ...scope }
    const result = node.evaluate(fullScope)

    if (Date.now() - startTime > FORMULA_TIMEOUT_MS) {
      return { value: 0, error: 'Formula evaluation timed out' }
    }

    if (typeof result !== 'number' || !isFinite(result) || isNaN(result)) {
      return { value: 0, error: `Formula returned non-numeric result: ${result}` }
    }

    // Prices are never negative (rebates use negative base_price intentionally via formula)
    return { value: result, error: null }
  } catch (err) {
    return { value: 0, error: err instanceof Error ? err.message : 'Formula error' }
  }
}

/**
 * Compute the final total for a line item including any modifier.
 */
export function computeLineItemTotal(
  item: Pick<PriceItem, 'formula' | 'base_price'>,
  qty: number,
  scope: PartialFormulaScope,
  modifier: { type: ModifierType; value: number }
): number {
  const fullScope = buildScope(scope, { base_price: item.base_price, qty })

  let raw: number
  if (item.formula && item.formula.trim()) {
    const result = evaluateFormula(item.formula, fullScope)
    raw = result.value
  } else {
    raw = item.base_price * qty
  }

  // Apply modifier
  if (modifier.type === 'flat') {
    raw += modifier.value
  } else if (modifier.type === 'percent') {
    raw *= 1 + modifier.value / 100
  }

  return raw
}

/**
 * Get a human-readable description of what each scope variable resolves to.
 * Used in the FormulaTooltip to help sales staff understand the calculation.
 */
export function describeScope(scope: FormulaScope): Array<{ key: string; value: string | number | boolean }> {
  const entries = Object.entries(scope) as Array<[string, unknown]>
  return entries
    .filter(([key]) => key !== 'base_price' && key !== 'qty') // shown separately
    .map(([key, value]) => ({ key, value: value as string | number | boolean }))
}

/**
 * Validate a formula string without evaluating it.
 * Returns null if valid, or an error message.
 */
export function validateFormula(formula: string): string | null {
  if (!formula || !formula.trim()) return null
  try {
    const node = math.parse(formula)
    let unsafe = false
    node.traverse((n: { type: string }) => {
      if (n.type === 'AssignmentNode') unsafe = true
      if (n.type === 'FunctionAssignmentNode') unsafe = true
    })
    if (unsafe) return 'Assignment operations are not allowed in formulas'
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid formula syntax'
  }
}

/**
 * Automatically calculate quantity for standard line items based on category/type rules and current scope.
 */
export function calculateQtyForLineItem(
  item: { category: string; type_value?: string; unit?: string; specData?: any },
  scope: PartialFormulaScope
): number {
  const systemKw = scope.system_kw || 0
  const panelWatt = scope.panel_wattage || 440 // Default panel wattage if not specified
  const panelQty = scope.panel_qty || Math.floor((systemKw * 1000) / panelWatt)

  switch (item.type_value) {
    case 'panels': {
      const watt = parseFloat(item.specData?.wattage) || panelWatt
      return Math.floor((systemKw * 1000) / watt)
    }
    case 'inverters': {
      const watt = parseFloat(item.specData?.watt) || 50000
      return Math.ceil((systemKw * 800) / watt)
    }
    case 'optimisers': {
      if (
        item.specData?.item_code?.toLowerCase().includes('not-required') ||
        item.specData?.item_name?.toLowerCase().includes('not required')
      ) {
        return 0
      }
      const sizeVa = parseFloat(item.specData?.size_va) || 0
      if (sizeVa > panelWatt * 2) {
        return Math.ceil(panelQty / 2)
      }
      return panelQty
    }
    case 'racking':
    case 'additional_racking': {
      const unit = (item.unit || '').toLowerCase()
      if (unit.includes('panel') || unit === 'ea') {
        return panelQty
      }
      return systemKw
    }
    case 'batteries': {
      const nominalKwh = parseFloat(item.specData?.nominal_kwh) || 100
      const bessKwh = scope.bess_kwh || 0
      return bessKwh > 0 ? Math.ceil(bessKwh / nominalKwh) : 1
    }
    case 'battery_inverter': {
      const kva = parseFloat(item.specData?.kva) || 100
      const systemKva = scope.system_kva || (systemKw * 1.25)
      return Math.ceil(systemKva / kva)
    }
    case 'ac_cabling': {
      return scope.ac_cable_m || scope.cable_run_m || 50
    }
    case 'dc_twin_cabling': {
      return scope.dc_cable_m || scope.cable_run_m || 100
    }
    case 'cabling_addons': {
      return scope.cable_run_m || 50
    }
    case 'install': {
      const unit = (item.unit || '').toLowerCase()
      if (unit.includes('kw')) return systemKw
      if (unit.includes('panel')) return panelQty
      return 1
    }
    case 'safety': {
      const unit = (item.unit || '').toLowerCase()
      if (unit === 'm' || unit.includes('meter') || unit.includes('metre')) {
        return scope.roof_perimeter_m || 100
      }
      return 1
    }
    default:
      return 1
  }
}
