import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Copy, Trash2, RotateCcw, AlertCircle, CheckCircle, Calculator, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import type { ComputedLineItem, PartialFormulaScope, ModifierType, InclusionStatus } from '../../types/domain.types'
import FormulaTooltip from './FormulaTooltip'
import { getFallbackCostFormulaString, getFallbackQtyFormulaString } from '../../lib/formulaEngine'


const INCLUSION_OPTIONS: { value: InclusionStatus; label: string }[] = [
  { value: 'included', label: 'Included' },
  { value: 'not_required', label: 'Not Required' },
]

function statusStyle(status: InclusionStatus) {
  switch (status) {
    case 'included': return 'bg-emerald-950 border-emerald-800/60 text-emerald-300'
    case 'not_required': return 'bg-slate-900 border-slate-700 text-slate-500'
  }
}

interface LineItemRowProps {
  item: ComputedLineItem
  scope: PartialFormulaScope
  comparisonTotal?: number
  readOnly?: boolean
  onStatusChange: (status: InclusionStatus) => void
  onQtyChange: (qty: number) => void
  onModifierChange: (type: ModifierType, value: number, note: string) => void
  onDuplicate: () => void
  onRemove?: () => void
  onOptionChange: (groupId: string, optionId: string | null) => void
  /** null = revert to price item default */
  onFormulaOverride: (formula: string | null) => void
}

import { InlineFormulaEditor } from './InlineFormulaEditor'

const SPEC_FIELD_MAPPINGS: Record<string, { label: string; key: string }[]> = {
  ac_breaker: [
    { label: 'Rating', key: 'rating_a' },
    { label: 'Name', key: 'name' },
    { label: 'Breaker Type', key: 'breaker_type' }
  ],
  ac_cabling: [
    { label: 'Size', key: 'size_mm2' },
    { label: 'Inclusion', key: 'inclusion' },
    { label: 'Conductor', key: 'conductor_material' }
  ],
  ac_combiner: [
    { label: 'Combiner Name', key: 'ac_combiner_name' },
    { label: 'Notes', key: 'notes' }
  ],
  additional_racking: [
    { label: 'Item Name', key: 'item_name' },
    { label: 'Unit', key: 'unit' }
  ],
  batteries: [
    { label: 'Brand', key: 'brand' },
    { label: 'Item Name', key: 'item_name' },
    { label: 'Nominal kWh', key: 'nominal_kwh' }
  ],
  battery_inverter: [
    { label: 'Brand', key: 'brand' },
    { label: 'kVA', key: 'kva' },
    { label: 'Item Name', key: 'item_name' }
  ],
  bessdb: [
    { label: 'BESSDB Type', key: 'bessdb_type' }
  ],
  cabling_addons: [
    { label: 'Item Name', key: 'item_name' },
    { label: 'Addon Type', key: 'addon_type' }
  ],
  dc_cabling: [
    { label: 'Size', key: 'size_mm2' },
    { label: 'Inclusion', key: 'inclusion' },
    { label: 'Conductor', key: 'conductor_material' }
  ],
  dc_combiner: [
    { label: 'Combiner Name', key: 'dc_combiner_name' },
    { label: 'Notes', key: 'notes' }
  ],
  dc_twin_cabling: [
    { label: 'Cabling Name', key: 'dc_cabling_name' },
    { label: 'Size', key: 'size_twin_dc_cable_mm' },
    { label: 'Notes', key: 'notes' }
  ],
  grid_protection: [
    { label: 'DNSP', key: 'dnsp' },
    { label: 'Req. Over', key: 'required_over_kva' },
    { label: 'Export Limit Enforced', key: 'is_export_limit_enforced' }
  ],
  grid_connection: [
    { label: 'DNSP', key: 'dnsp' },
    { label: 'Low Size', key: 'low_size_kva' },
    { label: 'High Size', key: 'high_side_kva' }
  ],
  harm_filtering: [
    { label: 'Item Type', key: 'item_type' }
  ],
  install: [
    { label: 'Item Type', key: 'item_type' },
    { label: 'Install Item', key: 'install_item' },
    { label: 'Unit', key: 'unit' }
  ],
  inverters: [
    { label: 'Brand', key: 'brand' },
    { label: 'Model', key: 'model' },
    { label: 'Warranty Years', key: 'warranty_years' }
  ],
  inverter_station: [
    { label: 'Station', key: 'inverter_station' }
  ],
  lifting: [
    { label: 'Name', key: 'name' },
    { label: 'Lifting Type', key: 'lifting_type' },
    { label: 'Time', key: 'time' }
  ],
  monitoring_addons: [
    { label: 'Item Type', key: 'item_type' },
    { label: 'Item Name', key: 'item_name' },
    { label: 'Unit', key: 'unit' }
  ],
  monitoring_warranty: [
    { label: 'Item Type', key: 'item_type' },
    { label: 'Item Name', key: 'item_name' },
    { label: 'Unit', key: 'unit' }
  ],
  netnada: [
    { label: 'Plan Type', key: 'plan_type' },
    { label: 'Payment Plan', key: 'payment_plan' }
  ],
  netnada_addons: [
    { label: 'Item Name', key: 'item_name' },
    { label: 'Payment Plan', key: 'payment_plan' }
  ],
  optimisers: [
    { label: 'Size VA', key: 'size_va' },
    { label: 'Optimiser Name', key: 'optimiser_name' }
  ],
  panels: [
    { label: 'Brand', key: 'brand' },
    { label: 'Item Type', key: 'item_type' },
    { label: 'Item Name', key: 'item_name' }
  ],
  pfc: [
    { label: 'PFC Type', key: 'pfc_type' }
  ],
  prelim_general: [
    { label: 'Item Type', key: 'item_type' },
    { label: 'Item Name', key: 'item_name' }
  ],
  pvdb: [
    { label: 'PVDB Type', key: 'pvdb_type' }
  ],
  racking: [
    { label: 'Racking Type', key: 'racking_type' }
  ],
  safety: [
    { label: 'Item Type', key: 'item_type' },
    { label: 'Item Name', key: 'item_name' },
    { label: 'Unit', key: 'unit' }
  ],
  switch_gear: [
    { label: 'Item Type', key: 'item_type' },
    { label: 'Item Name', key: 'item_name' }
  ],
  travel_accoms_freight: [
    { label: 'Distance', key: 'distance_frm_city_center' },
    { label: 'Rates', key: 'travel_rates' }
  ],
  witness_injection: [
    { label: 'DNSP', key: 'dnsp' },
    { label: 'Req. Over', key: 'required_over_kva' }
  ]
};

export default function LineItemRow({
  item,
  scope,
  comparisonTotal,
  readOnly,
  onStatusChange,
  onQtyChange,
  onDuplicate,
  onRemove,
  onOptionChange,
  onFormulaOverride,
  onUseCalcQtyChange,
}: LineItemRowProps & { onUseCalcQtyChange?: (val: boolean) => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [formulaOpen, setFormulaOpen] = useState(false)
  const [qtyFormulaOpen, setQtyFormulaOpen] = useState(false)
  const [descOpen, setDescOpen] = useState(false)
  const [qtyStr, setQtyStr] = useState(String(item.qty))
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQtyStr(String(item.qty))
  }, [item.qty])

  const showDelta = comparisonTotal !== undefined
  const hasModifier = item.modifier_type !== 'none' && item.modifier_value !== 0
  const isExcluded = !item.is_included
  const hasOptions = item.option_groups.length > 0
  const isFormulaOverridden = item.formula_override !== null

  // Keys to exclude from spec display
  const EXCLUDED_KEYS = new Set(['created_at', 'updated_at', 'id', 'price_item_id', 'version_id', 'item_id'])

  // Primary descriptor key per type_value (shown as the main tag)
  const MAIN_DESCRIPTOR_KEYS: Record<string, string[]> = {
    panels: ['item_name', 'brand', 'item_type'],
    inverters: ['model', 'brand', 'item_name'],
    optimisers: ['optimiser_name', 'brand', 'item_name'],
    batteries: ['item_name', 'brand', 'nominal_kwh'],
    battery_inverter: ['item_name', 'brand', 'kva'],
    racking: ['racking_type', 'item_name'],
    additional_racking: ['item_name', 'unit'],
    ac_cabling: ['size_mm2', 'inclusion', 'conductor_material'],
    dc_cabling: ['size_mm2', 'inclusion', 'conductor_material'],
    dc_twin_cabling: ['dc_cabling_name', 'size_twin_dc_cable_mm'],
    ac_combiner: ['ac_combiner_name', 'notes'],
    dc_combiner: ['dc_combiner_name', 'notes'],
    inverter_station: ['inverter_station'],
    bessdb: ['bessdb_type'],
    pvdb: ['pvdb_type'],
    ac_breaker: ['name', 'rating_a', 'breaker_type'],
    switch_gear: ['item_name', 'item_type'],
    install: ['install_item', 'item_type', 'unit'],
    safety: ['item_name', 'item_type'],
    monitoring_warranty: ['item_name', 'item_type'],
    monitoring_addons: ['item_name', 'item_type'],
    netnada: ['plan_type', 'payment_plan'],
    netnada_addons: ['item_name', 'payment_plan'],
    prelim_general: ['item_name', 'item_type'],
    grid_protection: ['dnsp', 'required_over_kva'],
    grid_connection: ['dnsp', 'low_size_kva', 'high_side_kva'],
    witness_injection: ['dnsp', 'required_over_kva'],
    harm_filtering: ['item_type'],
    pfc: ['pfc_type'],
    lifting: ['lifting_type', 'name'],
    travel_accoms_freight: ['travel_rates', 'distance_frm_city_center'],
    cabling_addons: ['item_name', 'addon_type'],
  }

  // Get main descriptor value for this item
  const mainDescriptor = (() => {
    if (!item.specData || !item.type_value) return null
    const keys = MAIN_DESCRIPTOR_KEYS[item.type_value] || []
    const specFields = SPEC_FIELD_MAPPINGS[item.type_value] || []

    for (const k of keys) {
      const val = item.specData[k]
      if (val !== undefined && val !== null && val !== '') {
        const field = specFields.find(f => f.key === k)
        return {
          key: k,
          label: field ? field.label : k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)
        }
      }
    }
    // Fallback: first non-excluded, non-empty value
    for (const [k, v] of Object.entries(item.specData)) {
      if (!EXCLUDED_KEYS.has(k) && v !== undefined && v !== null && v !== '') {
        const field = specFields.find(f => f.key === k)
        return {
          key: k,
          label: field ? field.label : k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)
        }
      }
    }
    return null
  })()

  // All remaining spec fields (excluding the main descriptor and excluded keys)
  const allSpecFields = (() => {
    if (!item.specData) return []
    const specFields = SPEC_FIELD_MAPPINGS[item.type_value] || []
    
    return Object.keys(item.specData)
      .filter((key) => {
        if (EXCLUDED_KEYS.has(key)) return false
        if (mainDescriptor && mainDescriptor.key === key) return false
        const val = item.specData?.[key]
        return val !== undefined && val !== null && val !== ''
      })
      .map((key) => {
        const field = specFields.find(f => f.key === key)
        return {
          key,
          label: field ? field.label : key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        }
      })
  })()

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <tr
      className={clsx(
        'border-b border-slate-800/50 last:border-0 group text-sm',
        item.is_duplicate && 'bg-slate-900/40',
      )}
    >
      {/* Inclusion status */}
      <td className="pl-3 pr-2 py-2 w-36 align-top relative">
        <div className="flex flex-col gap-1.5">
          <select
            value={item.inclusion_status}
            onChange={(e) => onStatusChange(e.target.value as InclusionStatus)}
            disabled={readOnly}
            className={clsx(
              'w-full text-xs rounded px-1.5 py-1 border focus:outline-none focus:ring-1 focus:ring-brand-500',
              'cursor-pointer transition-colors appearance-none shrink-0',
              statusStyle(item.inclusion_status),
              readOnly && 'opacity-60 cursor-default'
            )}
          >
            {INCLUSION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.is_custom && (
              <span className="text-[10px] leading-none text-amber-500 bg-amber-900/30 px-1 py-1 rounded text-center">custom</span>
            )}
            <FormulaTooltip item={item} scope={scope} />
          </div>
        </div>
      </td>

      {/* Code */}
      <td className="pr-3 py-2 w-20 align-top pt-2.5">
        <code className="text-xs text-slate-600 font-mono">{item.code}</code>
        {item.is_duplicate && (
          <span className="block text-xs text-slate-700 font-mono">(copy)</span>
        )}
      </td>

      {/* Name + formula editor + option group selectors */}
      <td className="pr-3 py-2 align-top">

        {/* Spec fields — box descriptor + collapsible extras */}
        {item.specData && mainDescriptor ? (
          <div className="w-full flex items-start gap-1.5">
            {/* Card wrapper */}
            <div className="flex-1 bg-slate-900/80 border border-slate-700/60 rounded-lg p-3 min-w-0 transition-colors hover:border-slate-600/80">
              {/* Clickable Header */}
              <button
                onClick={() => setDescOpen((v) => !v)}
                className="w-full flex flex-col text-left focus:outline-none group"
              >
                <span className="text-[10px] font-medium text-slate-500 mb-1">Item Name:</span>
                <div className="flex items-end justify-between w-full">
                  <span className="font-semibold text-slate-200 text-xs pr-4 leading-tight">
                    {mainDescriptor.value !== item.name ? `${item.name} (${mainDescriptor.value})` : item.name}
                  </span>
                  
                  {allSpecFields.length > 0 && (
                    <span className="flex items-center text-[10px] font-semibold text-slate-500 shrink-0 uppercase tracking-widest group-hover:text-slate-400">
                      {descOpen ? 'Hide' : 'Show'}
                      <ChevronDown className={clsx("w-3.5 h-3.5 ml-1 transition-transform", descOpen && "rotate-180")} />
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded spec tags */}
              {descOpen && allSpecFields.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-800/80">
                  {allSpecFields.map((field) => {
                    const val = item.specData?.[field.key]
                    if (val === undefined || val === null || val === '') return null
                    const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)
                    // Match the highlight in the screenshot (e.g. green or white)
                    const isNameOrCode = field.key.includes('name') || field.key.includes('code')
                    
                    return (
                      <div key={field.key} className="flex items-center text-[10.5px] bg-slate-800/80 rounded px-1.5 py-0.5 border border-slate-700/50">
                        <span className="text-slate-400 mr-1.5">{field.label}:</span>
                        <span className={clsx(
                          "font-medium", 
                          isNameOrCode ? "text-brand-400" : "text-slate-200"
                        )}>
                          {displayVal}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Fallback for items with no specData — show name */
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm text-slate-200">
              {item.name}
            </span>
          </div>
        )}

        {/* Option group selectors */}
        {hasOptions && !formulaOpen && (
          <div className="mt-1.5 space-y-1">
            {item.option_groups.map((group) => {
              const selectedId = item.selected_options[group.id] ?? ''
              const defaultOpt = (group.options ?? []).find((o) => o.is_default)
              return (
                <div key={group.id} className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-600 shrink-0 min-w-[60px]">{group.label}:</span>
                  <select
                    value={selectedId}
                    onChange={(e) => onOptionChange(group.id, e.target.value || null)}
                    disabled={readOnly}
                    className="text-xs bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5
                               text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500
                               max-w-[240px] flex-1"
                  >
                    <option value="">
                      {defaultOpt ? `${defaultOpt.label} (default)` : '— Select —'}
                    </option>
                    {(group.options ?? []).map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                        {opt.modifier_value !== 0
                          ? ` (${opt.modifier_type === 'percent'
                            ? `${opt.modifier_value > 0 ? '+' : ''}${opt.modifier_value}%`
                            : `${opt.modifier_value > 0 ? '+' : ''}$${Math.abs(opt.modifier_value).toLocaleString('en-AU', { maximumFractionDigits: 0 })}`})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}

        {hasModifier && item.modifier_note && (
          <p className="text-xs text-amber-400/70 mt-0.5 truncate max-w-[300px]" title={item.modifier_note}>
            ↳ {item.modifier_note}
          </p>
        )}
      </td>



      {/* Calc Qty */}
      <td className="pr-3 py-2 w-24 align-top text-right pt-2 relative">
        <div className="flex items-center justify-end gap-2">
          {((!item.id.startsWith('virtual-') && item.type_value !== 'dc_twin_cabling' && item.type_value !== 'cable_tray' && !item.is_custom) || item.id.startsWith('virtual-ac_')) && (
            <button
              onClick={() => setQtyFormulaOpen((v) => !v)}
              title="View Calc Qty logic"
              className={clsx(
                'relative flex items-center justify-center w-5 h-5 rounded-full transition-all duration-200',
                'border border-slate-700/50 shadow-sm hover:scale-105 hover:shadow-md shrink-0',
                qtyFormulaOpen
                  ? 'bg-brand-600 border-brand-500 text-white shadow-brand-900/20'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600'
              )}
            >
              <span className="font-serif italic text-[9px] leading-none font-bold">fx</span>
            </button>
          )}
          <span className="text-xs text-slate-400 font-mono">
            {(item.type_value === 'dc_twin_cabling' || item.type_value === 'cable_tray')
              ? 'N/A'
              : (item.calculated_qty !== undefined ? item.calculated_qty.toLocaleString('en-AU', { maximumFractionDigits: 2 }) : '-')}
          </span>
          {(!item.id.startsWith('virtual-') && item.type_value !== 'dc_twin_cabling' && item.type_value !== 'cable_tray') && (
            <input
              type="checkbox"
              checked={item.use_calculated_qty ?? true}
            onChange={(e) => onUseCalcQtyChange?.(e.target.checked)}
            disabled={readOnly || isExcluded}
            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500 cursor-pointer disabled:opacity-40"
              title="Use calculated quantity instead of manual"
            />
          )}
        </div>
        {qtyFormulaOpen && !readOnly && (
          <div className="absolute right-0 top-[calc(100%-4px)] z-50">
            <InlineFormulaEditor
              item={item}
              scope={scope}
              onSave={() => {}} // Read-only, no save action
              onClose={() => setQtyFormulaOpen(false)}
              isReadOnly={true}
              title="Quantity Formula (Preview)"
              defaultPlaceholder={getFallbackQtyFormulaString(item)}
            />
          </div>
        )}
      </td>

      {/* Qty (Manual) */}
      <td className="pr-3 py-2 w-20 align-top">
        <div className="relative flex items-center">
          <input
            type="number"
            min="0"
            step="0.01"
            value={qtyStr}
            onChange={(e) => {
              const val = e.target.value;
              setQtyStr(val);
              const parsed = parseFloat(val);
              if (!isNaN(parsed)) {
                onQtyChange(parsed);
                if (item.use_calculated_qty ?? true) {
                  onUseCalcQtyChange?.(false);
                }
              } else {
                onQtyChange(0);
              }
            }}
            onBlur={() => {
              if (qtyStr.trim() === '') {
                setQtyStr(String(item.qty));
              }
            }}
            disabled={readOnly || isExcluded}
            className={clsx(
              "w-full bg-slate-800 border rounded py-1 text-xs font-mono text-right focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-40",
              (item.type_value === 'dc_twin_cabling' || item.type_value === 'cable_tray') ? "pr-6 pl-2" : "px-2",
              (item.use_calculated_qty ?? true) ? "border-slate-700 text-slate-500" : "border-brand-500/50 text-white"
            )}
          />
          {(item.type_value === 'dc_twin_cabling' || item.type_value === 'cable_tray') && (
            <span className="absolute right-2 text-xs text-slate-500 font-mono pointer-events-none">m</span>
          )}
        </div>
      </td>

      {/* Cost */}
      <td className="pr-3 py-2 text-right font-mono text-xs w-24 align-top pt-2 relative">
        <div className="flex items-center justify-end gap-2">
          {!readOnly && (
            <button
              onClick={() => setFormulaOpen((v) => !v)}
              title={isFormulaOverridden ? 'Formula overridden for this quote — click to edit' : 'Edit formula for this quote'}
              className={clsx(
                'relative flex items-center justify-center w-5 h-5 rounded-full transition-all duration-200',
                'border border-slate-700/50 shadow-sm hover:scale-105 hover:shadow-md shrink-0',
                formulaOpen
                  ? 'bg-brand-600 border-brand-500 text-white shadow-brand-900/20'
                  : isFormulaOverridden
                    ? 'bg-amber-900/40 border-amber-500/50 text-amber-400 hover:bg-amber-800/60 hover:border-amber-500'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-600'
              )}
            >
              <span className="font-serif italic text-[9px] leading-none font-bold">fx</span>
              {isFormulaOverridden && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500"></span>}
            </button>
          )}
          <span className="text-slate-400 pt-0.5">
            {item.is_included ? `$${(item.computed_total || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '—'}
          </span>
        </div>
        {formulaOpen && !readOnly && (
          <div className="absolute right-0 top-[calc(100%-4px)] z-50">
            <InlineFormulaEditor
              item={item}
              scope={scope}
              onSave={onFormulaOverride}
              onClose={() => setFormulaOpen(false)}
              title="Cost Formula"
              defaultPlaceholder={getFallbackCostFormulaString(item)}
            />
          </div>
        )}
      </td>

      {/* $/W Cost */}
      <td className="pr-3 py-2 text-right font-mono text-xs w-28 align-top pt-2.5 text-slate-400">
        {item.is_included && item.cost_per_watt ? `$${(item.cost_per_watt).toLocaleString('en-AU', { minimumFractionDigits: 4 })}` : '—'}
      </td>

      {/* Sales Rate */}
      <td className="pr-3 py-2 text-right font-mono text-xs w-24 align-top pt-2.5 text-brand-400">
        {item.is_included && item.sales_rate ? `$${(item.sales_rate).toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '—'}
      </td>

      {/* Sale $/W */}
      <td className="pr-4 py-2 text-right font-mono text-xs w-28 align-top pt-2.5 text-brand-400">
        {item.is_included && item.sale_per_watt ? `$${(item.sale_per_watt).toLocaleString('en-AU', { minimumFractionDigits: 4 })}` : '—'}
      </td>

      {/* Context menu */}
      <td className="pr-2 py-2 w-8 align-top">
        {!readOnly && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-slate-300
                         opacity-0 group-hover:opacity-100 transition-opacity"
              title="More actions"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-50 bg-slate-800 border border-slate-700
                              rounded-lg shadow-2xl py-1 min-w-[160px]">
                <button
                  onClick={() => { onDuplicate(); setMenuOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700
                             flex items-center gap-2 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  Duplicate row
                </button>
                {isFormulaOverridden && (
                  <button
                    onClick={() => { onFormulaOverride(null); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs text-amber-400 hover:bg-slate-700
                               flex items-center gap-2 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    Reset formula
                  </button>
                )}
                {item.is_removable && onRemove && (
                  <button
                    onClick={() => { onRemove(); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-slate-700
                               flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    Remove row
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
