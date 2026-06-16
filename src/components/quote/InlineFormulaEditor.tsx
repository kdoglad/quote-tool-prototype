import { useState } from 'react'
import { RotateCcw, AlertCircle, CheckCircle } from 'lucide-react'
import { parse } from 'mathjs'
import type { ComputedLineItem, PartialFormulaScope } from '../../types/domain.types'
import { validateFormula, evaluateFormula, buildScope } from '../../lib/formulaEngine'
import { DEFAULT_SCOPE_VALUES } from '../../lib/constants'

export function InlineFormulaEditor({
  item,
  scope,
  onSave,
  onClose,
  isReadOnly = false,
  title = "Formula",
  defaultPlaceholder = "e.g. base_price * system_kw * qty"
}: {
  item: ComputedLineItem
  scope: PartialFormulaScope
  onSave: (formula: string | null) => void
  onClose: () => void
  isReadOnly?: boolean
  title?: string
  defaultPlaceholder?: string
}) {
  const [draft, setDraft] = useState(item.formula_override ?? item.default_formula ?? '')
  const isOverridden = item.formula_override !== null
  const validationError = draft.trim() ? validateFormula(draft) : null

  const preview = (() => {
    if (!draft.trim() || validationError) return { result: null, variables: [] }
    const fullScope = buildScope(
      { ...DEFAULT_SCOPE_VALUES, ...scope },
      { base_price: item.base_unit_price, qty: item.qty }
    )

    const usedVars: Array<{ name: string, value: any }> = []
    try {
      const node = parse(draft)
      const varNames = new Set<string>()
      node.traverse((n: any) => {
        if (n.isSymbolNode && !['abs', 'max', 'min', 'round', 'ceil', 'floor', 'sqrt', 'pow'].includes(n.name)) {
          varNames.add(n.name)
        }
      })
      varNames.forEach(name => {
        if (fullScope[name as keyof typeof fullScope] !== undefined) {
          usedVars.push({ name, value: fullScope[name as keyof typeof fullScope] })
        }
      })
    } catch (e) {
      // Ignore parse error, validationError handles it
    }

    return {
      result: evaluateFormula(draft, fullScope),
      variables: usedVars
    }
  })()

  function handleSave() {
    // If draft equals the default, treat as "no override"
    const override = draft.trim() === (item.default_formula ?? '').trim() ? null : draft.trim() || null
    onSave(override)
    onClose()
  }

  return (
    <div className="mt-2 bg-slate-800/80 border border-slate-700 rounded-lg p-3 space-y-2 min-w-[300px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-400">{title}</span>
        {isOverridden && !isReadOnly && (
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
        rows={Math.max(2, Math.min(5, (draft || defaultPlaceholder).split('\n').length))}
        placeholder={defaultPlaceholder}
        disabled={isReadOnly}
        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white
                   font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500
                   resize-none disabled:opacity-70 disabled:cursor-not-allowed"
        spellCheck={false}
        autoFocus={!isReadOnly}
      />

      {/* Validation + live preview */}
      {draft.trim() && (
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            {validationError
              ? <><AlertCircle className="w-3 h-3 text-red-400" /><span className="text-red-400">{validationError}</span></>
              : preview?.result?.error
                ? <><AlertCircle className="w-3 h-3 text-red-400" /><span className="text-red-400">{preview.result.error}</span></>
                : preview?.result !== null && preview?.result !== undefined
                  ? <><CheckCircle className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">
                      = ${preview.result.value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-slate-600">(live scope)</span>
                  </>
                  : null
            }
          </div>
          {preview?.variables && preview.variables.length > 0 && !validationError && !preview?.result?.error && (
            <div className="text-[10px] text-slate-500 font-mono bg-slate-900/50 rounded px-2 py-1">
              <span className="text-slate-600">Variables: </span>
              {preview.variables.map((v, i) => (
                <span key={v.name}>
                  {i > 0 && <span className="text-slate-600 mx-1">•</span>}
                  <span className="text-brand-300">{v.name}</span>
                  <span className="text-slate-400">({typeof v.value === 'number' ? Number(v.value.toFixed(4)).toString() : String(v.value)})</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!!validationError || isReadOnly}
          className="text-xs bg-brand-700 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed
                     text-white rounded px-2.5 py-1 transition-colors"
        >
          {isReadOnly ? 'Close' : 'Apply'}
        </button>
        {!isReadOnly && (
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
