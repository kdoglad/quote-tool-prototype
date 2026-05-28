import { useState } from 'react'
import { RotateCcw, AlertCircle, CheckCircle } from 'lucide-react'
import type { ComputedLineItem, PartialFormulaScope } from '../../types/domain.types'
import { validateFormula, evaluateFormula, buildScope } from '../../lib/formulaEngine'
import { DEFAULT_SCOPE_VALUES } from '../../lib/constants'

export function InlineFormulaEditor({
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
