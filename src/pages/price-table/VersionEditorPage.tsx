import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Send, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { usePriceVersion } from '../../hooks/usePriceVersions'
import { usePriceItems, useUpdatePriceItem } from '../../hooks/usePriceItems'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'

import CategoryTable from '../../components/price-table/CategoryTable'
import PublishDialog from '../../components/price-table/PublishDialog'
import AddItemDialog from '../../components/price-table/AddItemDialog'
import EditItemDialog from '../../components/price-table/EditItemDialog'
import AcPricingMapEditor from '../../components/price-table/AcPricingMapEditor'
import { useToast } from '../../components/ui/Toast'
import { CATEGORIES } from '../../lib/constants'
import type { PriceItem } from '../../types/domain.types'

import { supabase } from '../../lib/supabase'

// ── Main page ────────────────────────────────────────────────

export default function VersionEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const { data: version, isLoading: vLoading } = usePriceVersion(id)
  const { data: items = [], isLoading: iLoading } = usePriceItems(id)
  const updateItem = useUpdatePriceItem()

  const qc = useQueryClient()

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Prelim', 'PV_Components'])
  )
  const [editingItem, setEditingItem] = useState<PriceItem | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showPublishDialog, setShowPublishDialog] = useState(false)

  const isDraft = version?.is_draft ?? false

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  async function handleSaveItem(item: PriceItem, _updates: Partial<PriceItem>, catalogData?: any, specData?: any, specTable?: string) {
    try {
      // Fetch current version row
      const { data: vRow, error: fetchErr } = await supabase
        .from('audit_log')
        .select('new_data')
        .eq('audit_id', id)
        .single()
      if (fetchErr) throw fetchErr

      const nd = (vRow.new_data as any) ?? { items: [] }
      const items: any[] = nd.items ?? []

      // Find existing entry by item_id and replace it, or push a new UPDATE entry
      const existingIdx = items.findIndex((e: any) => e.catalog_data?.item_id === item.id)
      const newEntry = {
        change_id: existingIdx >= 0 ? items[existingIdx].change_id : crypto.randomUUID(),
        action: existingIdx >= 0 ? items[existingIdx].action : 'UPDATE',
        catalog_data: catalogData ?? { item_id: item.id, item_code: item.code },
        spec_data: specData ?? {},
        table_name: specTable ?? null,
        old_catalog_data: existingIdx >= 0 ? items[existingIdx].old_catalog_data : { item_id: item.id, item_code: item.code },
        old_spec_data: existingIdx >= 0 ? items[existingIdx].old_spec_data : item.specData,
      }

      if (existingIdx >= 0) {
        items[existingIdx] = newEntry
      } else {
        items.push(newEntry)
      }

      const { error: updateErr } = await supabase
        .from('audit_log')
        .update({ new_data: { ...nd, items } })
        .eq('audit_id', id)
      if (updateErr) throw updateErr

      addToast('success', 'Item saved.')
      qc.invalidateQueries({ queryKey: ['price-items', id] })
      setEditingItem(null)
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save item')
    }
  }

  async function handleDelete(item: PriceItem) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    try {
      const { data: vRow, error: fetchErr } = await supabase
        .from('audit_log')
        .select('new_data')
        .eq('audit_id', id)
        .single()
      if (fetchErr) throw fetchErr

      const nd = (vRow.new_data as any) ?? { items: [] }
      const items: any[] = nd.items ?? []

      // If the item was staged as ADD in this draft, just remove it entirely
      const existingIdx = items.findIndex((e: any) => e.catalog_data?.item_id === item.id)
      if (existingIdx >= 0 && items[existingIdx].action === 'ADD') {
        items.splice(existingIdx, 1)
      } else {
        // Mark as DELETE
        const deleteEntry = {
          change_id: crypto.randomUUID(),
          action: 'DELETE',
          catalog_data: { item_id: item.id, item_code: item.code },
          spec_data: item.specData ?? {},
          table_name: null,
          old_catalog_data: { item_id: item.id, item_code: item.code },
          old_spec_data: item.specData,
        }
        if (existingIdx >= 0) {
          items[existingIdx] = deleteEntry
        } else {
          items.push(deleteEntry)
        }
      }

      const { error: updateErr } = await supabase
        .from('audit_log')
        .update({ new_data: { ...nd, items } })
        .eq('audit_id', id)
      if (updateErr) throw updateErr

      addToast('success', 'Item removed from draft.')
      qc.invalidateQueries({ queryKey: ['price-items', id] })
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to delete item')
    }
  }

  if (vLoading || iLoading) {
    return <div className="flex items-center justify-center h-64"><Spinner /></div>
  }

  if (!version) {
    return <div className="p-6 text-slate-400">Version not found.</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900 shrink-0">
        <button
          onClick={() => navigate('/price-tables')}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-white">{version.version_name}</h1>
            <Badge variant={isDraft ? 'draft' : 'success'}>{isDraft ? 'Draft' : 'Published'}</Badge>
          </div>
          {version.notes && <p className="text-xs text-slate-500 mt-0.5">{version.notes}</p>}
        </div>
        {isDraft && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setShowAddDialog(true)}
            >
              Add Item
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Send className="w-3.5 h-3.5" />}
              onClick={() => setShowPublishDialog(true)}
            >
              Publish Version
            </Button>
          </div>
        )}
        {!isDraft && (
          <Badge variant="info">Read-only — published versions cannot be edited</Badge>
        )}
      </div>

      {/* Item count summary */}
      <div className="px-6 py-2 bg-slate-950/50 border-b border-slate-800 shrink-0 flex items-center gap-4">
        <span className="text-xs text-slate-500">{items.length} items across {CATEGORIES.length} categories</span>
        {isDraft && items.length === 0 && (
          <span className="text-xs text-amber-400">
            Import a CSV or add items individually to get started.
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {CATEGORIES.map(({ value: cat, label }) => {
          const catItems = items.filter((i) => i.category === cat)
          if (catItems.length === 0 && !isDraft) return null
          const isExpanded = expandedCategories.has(cat)

          return (
            <div key={cat} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
              >
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-slate-500" />
                  : <ChevronRight className="w-4 h-4 text-slate-500" />
                }
                <span className="font-medium text-slate-200 text-sm">{label}</span>
                <span className="text-xs text-slate-600 ml-auto">{catItems.length} items</span>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-800">
                  {catItems.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-600">No items in this category.</div>
                  ) : (
                    <div className="p-4 space-y-6">
                      {(() => {
                        // Group by type_value to render specific tables
                        const itemsByTypeValue = catItems.reduce((acc, item) => {
                          const typeValue = item.type_value || 'legacy_unknown'
                          if (!acc[typeValue]) acc[typeValue] = []
                          acc[typeValue].push(item)
                          return acc
                        }, {} as Record<string, PriceItem[]>)
                        
                        console.log(`cat=${cat}, itemsByTypeValue:`, itemsByTypeValue)
                        
                        return Object.entries(itemsByTypeValue).map(([typeValue, pItems]) => (
                          <CategoryTable
                            key={typeValue}
                            typeValue={typeValue}
                            items={pItems}
                            isDraft={isDraft}
                            onEdit={setEditingItem}
                            onDelete={handleDelete}
                          />
                        ))
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* AC Pricing Map Editor */}
        <AcPricingMapEditor isDraft={isDraft} />
      </div>

      {/* Edit item dialog */}
      {editingItem && (
        <EditItemDialog
          item={editingItem}
          onSave={(updates, catalogData, specData, specTable) => handleSaveItem(editingItem, updates, catalogData, specData, specTable)}
          onClose={() => setEditingItem(null)}
          saving={updateItem.isPending}
        />
      )}

      {/* Add item dialog */}
      {showAddDialog && id && (
        <AddItemDialog
          versionId={id}
          onClose={() => setShowAddDialog(false)}
          onCreate={async () => {
            qc.invalidateQueries({ queryKey: ['price-items', id] })
            setShowAddDialog(false)
          }}
        />
      )}

      {/* Publish dialog */}
      {showPublishDialog && id && (
        <PublishDialog
          sourceVersionId={id}
          sourceVersionName={version.version_name}
          onClose={() => setShowPublishDialog(false)}
          onPublished={() => {
            setShowPublishDialog(false)
            navigate('/price-table')
          }}
        />
      )}
    </div>
  )
}
