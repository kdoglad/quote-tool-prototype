import { useState, useRef, useEffect } from 'react'
import { MoreVertical, Copy, Trash2, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react'
import { clsx } from 'clsx'
import type { ComputedLineItem, PartialFormulaScope, ModifierType, InclusionStatus } from '../../types/domain.types'
import FormulaTooltip from './FormulaTooltip'
import { validateFormula, evaluateFormula, buildScope } from '../../lib/formulaEngine'
import { DEFAULT_SCOPE_VALUES } from '../../lib/constants'

const INCLUSION_OPTIONS: { value: InclusionStatus; label: string }[] = [
  { value: 'included', label: 'Included' },
  { value: 'not_required', label: 'Not Required' },
  { value: 'provisional_sum', label: 'Provisional Sum' },
  { value: 'appears_adequate', label: 'Appears Adequate' },
]

function statusStyle(status: InclusionStatus) {
  switch (status) {
    case 'included': return 'bg-emerald-950 border-emerald-800/60 text-emerald-300'
    case 'not_required': return 'bg-slate-900 border-slate-700 text-slate-500'
    case 'provisional_sum': return 'bg-amber-950 border-amber-800/60 text-amber-300'
    case 'appears_adequate': return 'bg-blue-950 border-blue-800/60 text-blue-300'
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

/** Compact inline formula editor shown when the ƒ button is expanded. */
function InlineFormulaEditor({
  item,
  scope,
  onSave,
  onClose,
}: {
  item: ComputedLineItem
  scope: PartialFormulaScope
  onSave: (formula: string | null) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(item.formula_override ?? item.default_formula ?? '')
  const isOverridden = item.formula_override !== null
  const validationError = draft.trim() ? validateFormula(draft) : null

  const preview = (() => {
    if (!draft.trim() || validationError) return null
    const fullScope = buildScope(
      { ...DEFAULT_SCOPE_VALUES, ...scope },
      { base_price: item.base_unit_price, qty: item.qty }
    )
    return evaluateFormula(draft, fullScope)
  })()

  function handleSave() {
    // If draft equals the default, treat as "no override"
    const override = draft.trim() === (item.default_formula ?? '').trim() ? null : draft.trim() || null
    onSave(override)
    onClose()
  }

  return (
    <div className="mt-2 bg-slate-800/80 border border-slate-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-400">Formula</span>
        {isOverridden && (
          <button
            onClick={() => { onSave(null); onClose() }}
            className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            title="Revert to price table default"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to default
          </button>
        )}
      </div>

      {/* Default formula hint */}
      {item.default_formula && (
        <div className="text-xs text-slate-600 font-mono bg-slate-900/60 rounded px-2 py-1">
          <span className="text-slate-500 not-italic">Default: </span>
          <span
            className="cursor-pointer hover:text-slate-400 transition-colors"
            onClick={() => setDraft(item.default_formula ?? '')}
            title="Click to restore"
          >
            {item.default_formula}
          </span>
        </div>
      )}

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        placeholder="e.g. base_price * system_kw * qty"
        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white
                   font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500
                   resize-none"
        spellCheck={false}
        autoFocus
      />

      {/* Validation + live preview */}
      {draft.trim() && (
        <div className="flex items-center gap-1.5 text-xs">
          {validationError
            ? <><AlertCircle className="w-3 h-3 text-red-400" /><span className="text-red-400">{validationError}</span></>
            : preview?.error
              ? <><AlertCircle className="w-3 h-3 text-red-400" /><span className="text-red-400">{preview.error}</span></>
              : preview !== null
                ? <><CheckCircle className="w-3 h-3 text-green-400" />
                  <span className="text-green-400">
                    = ${preview.value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-slate-600">(live scope)</span>
                </>
                : null
          }
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!!validationError}
          className="text-xs bg-brand-700 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed
                     text-white rounded px-2.5 py-1 transition-colors"
        >
          Apply
        </button>
        <button
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

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
}: LineItemRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [formulaOpen, setFormulaOpen] = useState(false)
  const [qtyStr, setQtyStr] = useState(String(item.qty))
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQtyStr(String(item.qty))
  }, [item.qty])

  const showDelta = comparisonTotal !== undefined
  const delta = showDelta ? item.computed_total - comparisonTotal! : 0
  const hasModifier = item.modifier_type !== 'none' && item.modifier_value !== 0
  const isExcluded = !item.is_included
  const hasOptions = item.option_groups.length > 0
  const isFormulaOverridden = item.formula_override !== null
  const optionDelta = item.computed_total - item.formula_total

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
        isExcluded && 'opacity-50',
        item.is_duplicate && 'bg-slate-900/40',
      )}
    >
      {/* Inclusion status */}
      <td className="pl-3 pr-2 py-2 w-36 align-top">
        <select
          value={item.inclusion_status}
          onChange={(e) => onStatusChange(e.target.value as InclusionStatus)}
          disabled={readOnly}
          className={clsx(
            'w-full text-xs rounded px-1.5 py-1 border focus:outline-none focus:ring-1 focus:ring-brand-500',
            'cursor-pointer transition-colors appearance-none',
            statusStyle(item.inclusion_status),
            readOnly && 'opacity-60 cursor-default'
          )}
        >
          {INCLUSION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
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
        {/* Name row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={clsx(
            'text-slate-200',
            isExcluded && 'line-through text-slate-500',
            item.inclusion_status === 'appears_adequate' && 'italic',
          )}>
            {item.name}
          </span>
          {item.inclusion_status === 'provisional_sum' && (
            <span className="text-xs font-semibold text-amber-400 bg-amber-900/40 px-1.5 py-0.5 rounded shrink-0">PS</span>
          )}
          {item.inclusion_status === 'appears_adequate' && (
            <span className="text-xs text-blue-400 bg-blue-900/30 px-1 rounded shrink-0">appears adequate</span>
          )}
          {item.is_custom && (
            <span className="text-xs text-amber-500 bg-amber-900/30 px-1 rounded shrink-0">custom</span>
          )}

          {/* Formula toggle button — always shown, overridden state highlighted */}
          {!readOnly && !isExcluded && (
            <button
              onClick={() => setFormulaOpen((v) => !v)}
              title={isFormulaOverridden ? 'Formula overridden for this quote — click to edit' : 'Edit formula for this quote'}
              className={clsx(
                'text-xs px-1.5 py-0.5 rounded font-mono transition-colors',
                formulaOpen
                  ? 'bg-brand-800 text-brand-200'
                  : isFormulaOverridden
                    ? 'bg-amber-900/50 text-amber-400 hover:bg-amber-900/70'
                    : 'bg-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-700'
              )}
            >
              ƒ{isFormulaOverridden ? '*' : ''}
            </button>
          )}

          <FormulaTooltip item={item} scope={scope} />
        </div>

        {/* Spec fields render */}
        {item.specData && SPEC_FIELD_MAPPINGS[item.type_value || ''] && (
          <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1 text-[11px] text-slate-400">
            {SPEC_FIELD_MAPPINGS[item.type_value || ''].map((field) => {
              const val = item.specData?.[field.key];
              if (val === undefined || val === null || val === '') return null;
              const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
              return (
                <span key={field.key} className="bg-slate-800/40 px-1.5 py-0.5 rounded border border-slate-750/30">
                  <span className="text-slate-500 font-medium">{field.label}:</span> {displayVal}
                </span>
              );
            })}
          </div>
        )}

        {/* Inline formula editor */}
        {formulaOpen && !readOnly && (
          <InlineFormulaEditor
            item={item}
            scope={scope}
            onSave={onFormulaOverride}
            onClose={() => setFormulaOpen(false)}
          />
        )}

        {/* Option group selectors */}
        {hasOptions && !isExcluded && !formulaOpen && (
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

      {/* Unit */}
      <td className="pr-3 py-2 text-slate-500 text-xs w-10 align-top pt-2.5">{item.unit}</td>

      {/* Qty */}
      <td className="pr-3 py-2 w-20 align-top">
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
          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono
                     focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-40 text-right"
        />
      </td>

      {/* Base unit rate */}
      <td className="pr-3 py-2 text-right font-mono text-slate-400 text-xs w-24 align-top pt-2.5">
        ${item.base_unit_price.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
      </td>

      {/* Total */}
      <td className="pr-3 py-2 text-right font-mono text-sm w-28 align-top pt-2.5">
        {item.is_included ? (
          <div>
            <span className={clsx(
              item.computed_total < 0 ? 'text-green-400' : 'text-slate-200',
              hasModifier && 'text-amber-300',
              item.inclusion_status === 'provisional_sum' && 'text-amber-300',
            )}>
              ${item.computed_total.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </span>
            {hasOptions && optionDelta !== 0 && (
              <div className="text-xs text-slate-600 mt-0.5">
                base {item.formula_total < 0 ? '-' : ''}${Math.abs(item.formula_total).toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                {' '}{optionDelta > 0 ? '+' : ''}${optionDelta.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
              </div>
            )}
          </div>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>

      {/* Comparison delta */}
      {showDelta && (
        <td className="pr-3 py-2 text-right font-mono text-xs w-24 align-top pt-2.5">
          {item.is_included && delta !== 0 ? (
            <span className={delta > 0 ? 'text-red-400' : 'text-green-400'}>
              {delta > 0 ? '+' : ''}${delta.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="text-slate-700">—</span>
          )}
        </td>
      )}

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
 
