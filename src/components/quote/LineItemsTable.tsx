import { useState } from 'react'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
import type {
  ComputedLineItem,
  ItemCategory,
  PartialFormulaScope,
  ModifierType,
  InclusionStatus,
} from '../../types/domain.types'
import { CATEGORIES, CATALOG_CATEGORY_OPTIONS } from '../../lib/constants'
import LineItemRow from './LineItemRow'
import Button from '../ui/Button'
import { clsx } from 'clsx'

// Build subcategory ordering from CATALOG_CATEGORY_OPTIONS
const SUBCATEGORY_ORDER = new Map<string, number>(
  CATALOG_CATEGORY_OPTIONS.map((opt, idx) => [opt.label, idx])
)

// Helper to group items by subcategory, ordered to match price table layout
function groupBySubcategory(items: ComputedLineItem[]) {
  const groups = new Map<string, ComputedLineItem[]>()
  items.forEach(item => {
    const subcat = item.subcategory || 'Other'
    if (!groups.has(subcat)) {
      groups.set(subcat, [])
    }
    groups.get(subcat)!.push(item)
  })
  // Sort subcategories based on CATALOG_CATEGORY_OPTIONS order
  return Array.from(groups.entries()).sort((a, b) => {
    const orderA = SUBCATEGORY_ORDER.get(a[0]) ?? 999
    const orderB = SUBCATEGORY_ORDER.get(b[0]) ?? 999
    return orderA - orderB
  })
}

interface LineItemsTableProps {
  items: ComputedLineItem[]
  scope: PartialFormulaScope
  comparisonItems?: ComputedLineItem[]
  showComparison?: boolean
  readOnly?: boolean
  onStatusChange: (instanceId: string, status: InclusionStatus) => void
  onQtyChange: (instanceId: string, qty: number) => void
  onModifierChange: (instanceId: string, type: ModifierType, value: number, note: string) => void
  onDuplicate: (instanceId: string) => void
  onRemove: (instanceId: string) => void
  onOptionChange: (instanceId: string, groupId: string, optionId: string | null) => void
  onFormulaOverride: (instanceId: string, formula: string | null) => void
  onAddCustomItem: () => void
}

export default function LineItemsTable({
  items,
  scope,
  comparisonItems,
  showComparison,
  readOnly,
  onStatusChange,
  onQtyChange,
  onModifierChange,
  onDuplicate,
  onRemove,
  onOptionChange,
  onFormulaOverride,
  onAddCustomItem,
}: LineItemsTableProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<ItemCategory>>(
    new Set(CATEGORIES.map((c) => c.value))
  )
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set())

  function toggleCategory(cat: ItemCategory) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  function toggleSubcategory(key: string) {
    setExpandedSubcategories((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const comparisonMap = new Map(comparisonItems?.map((i) => [i.code, i.computed_total]) ?? [])

  // Group items by category (preserving order from priceItems iteration)
  const categoriesWithItems = CATEGORIES.map(({ value: cat, label }) => ({
    cat,
    label,
    catItems: items.filter((i) => i.category === cat),
  })).filter(({ catItems }) => catItems.length > 0)

  // Also show custom items if any
  const customItems = items.filter((i) => i.category === 'Custom')
  if (customItems.length > 0 && !categoriesWithItems.find((c) => c.cat === 'Custom')) {
    categoriesWithItems.push({ cat: 'Custom', label: 'Custom Items', catItems: customItems })
  }

  return (
    <div className="space-y-2">
      {categoriesWithItems.map(({ cat, label, catItems }) => {
        const isExpanded = expandedCategories.has(cat)
        const catTotal = catItems
          .filter((i) => i.is_included)
          .reduce((sum, i) => sum + (i.sales_rate || 0), 0)

        return (
          <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(cat)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
            >
              {isExpanded
                ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              }
              <span className="font-medium text-slate-200 text-sm flex-1">{label}</span>
              <span className={clsx(
                'text-sm font-mono font-medium',
                catTotal < 0 ? 'text-green-400' : 'text-slate-300'
              )}>
                {catTotal !== 0
                  ? `${catTotal < 0 ? '-' : ''}$${Math.abs(catTotal).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  : '—'
                }
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-800">
                {groupBySubcategory(catItems).map(([subcategory, subcatItems]) => {
                  const subcatKey = `${cat}-${subcategory}`
                  const isSubcatExpanded = expandedSubcategories.has(subcatKey)
                  const subcatTotal = subcatItems
                    .filter((i) => i.is_included)
                    .reduce((sum, i) => sum + (i.sales_rate || 0), 0)

                  return (
                    <div key={subcatKey} className="border-b border-slate-800/50 last:border-b-0">
                      {/* Subcategory header */}
                      <button
                        onClick={() => toggleSubcategory(subcatKey)}
                        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-800/20 transition-colors"
                      >
                        {isSubcatExpanded
                          ? <ChevronDown className="w-3 h-3 text-slate-600 shrink-0" />
                          : <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                        }
                        <span className="text-xs font-medium text-slate-400 flex-1">{subcategory}</span>
                        <span className="text-xs font-mono text-slate-500">
                          {subcatTotal !== 0
                            ? `$${subcatTotal.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                            : '—'
                          }
                        </span>
                      </button>

                      {/* Subcategory items */}
                      {isSubcatExpanded && (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[720px]">
                            <thead>
                              <tr className="text-xs text-slate-600 border-b border-slate-800/50 bg-slate-900/50">
                                <th className="pl-3 pr-2 py-2 text-left w-36">Status</th>
                                <th className="pr-3 py-2 text-left w-20">Code</th>
                                <th className="pr-3 py-2 text-left">Description</th>
                                <th className="pr-3 py-2 text-left w-10">Unit</th>
                                <th className="pr-3 py-2 text-right w-20">Qty</th>
                                <th className="pr-3 py-2 text-right w-24">Rate</th>
                                <th className="pr-3 py-2 text-right w-28">Total</th>
                                {showComparison && (
                                  <th className="pr-3 py-2 text-right w-24 text-amber-600">Δ</th>
                                )}
                                <th className="pr-2 py-2 w-8" />
                              </tr>
                            </thead>
                            <tbody>
                              {subcatItems.map((item) => (
                                <LineItemRow
                                  key={item.instance_id}
                                  item={item}
                                  scope={scope}
                                  comparisonTotal={showComparison ? comparisonMap.get(item.code) : undefined}
                                  readOnly={readOnly}
                                  onStatusChange={(status) => onStatusChange(item.instance_id, status)}
                                  onQtyChange={(qty) => onQtyChange(item.instance_id, qty)}
                                  onModifierChange={(type, value, note) => onModifierChange(item.instance_id, type, value, note)}
                                  onDuplicate={() => onDuplicate(item.instance_id)}
                                  onRemove={item.is_removable ? () => onRemove(item.instance_id) : undefined}
                                  onOptionChange={(groupId, optionId) => onOptionChange(item.instance_id, groupId, optionId)}
                                  onFormulaOverride={(formula) => onFormulaOverride(item.instance_id, formula)}
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Add custom item button */}
      {!readOnly && (
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={onAddCustomItem}
          className="w-full justify-center border border-dashed border-slate-700 hover:border-slate-600"
        >
          Add/Update Item
        </Button>
      )}
    </div>
  )
}

