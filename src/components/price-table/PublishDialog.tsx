import { useState } from 'react'
import { AlertTriangle, XCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useToast } from '../ui/Toast'
import Dialog from '../ui/Dialog'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface PublishDialogProps {
  sourceVersionId: string
  sourceVersionName: string
  onClose: () => void
  onPublished: () => void
}

interface SpecError {
  itemCode: string
  table: string
  message: string
}

export default function PublishDialog({
  sourceVersionId,
  sourceVersionName,
  onClose,
  onPublished,
}: PublishDialogProps) {
  const { profile } = useAuthStore()
  const { addToast } = useToast()
  const [newVersionName, setNewVersionName] = useState(sourceVersionName)
  const [notes, setNotes] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [specErrors, setSpecErrors] = useState<SpecError[]>([])

  async function handlePublish() {
    if (!newVersionName.trim() || !profile) return
    setPublishing(true)
    setSpecErrors([])

    try {
      // 1. Fetch the single version row by audit_id
      const { data: versionRow, error: fetchErr } = await supabase
        .from('audit_log')
        .select('*')
        .eq('audit_id', sourceVersionId)
        .single()

      if (fetchErr) throw fetchErr

      const nd = versionRow.new_data as any
      const stagedItems: any[] = nd?.items ?? []

      // 2. Apply all staged item changes, collecting per-row errors
      const failures: SpecError[] = []
      const upsertedItemIds: string[] = []

      for (const entry of stagedItems) {
        if (entry.action === 'ADD' || entry.action === 'UPDATE') {
          if (entry.catalog_data && entry.spec_data && entry.table_name) {
            const code = entry.catalog_data.item_code ?? '(unknown)'

            const { error: catErr } = await supabase.from('catalog_items').upsert(entry.catalog_data)
            if (catErr) {
              failures.push({ itemCode: code, table: 'catalog_items', message: catErr.message })
              continue // skip spec upsert if catalog failed
            }

            if (entry.catalog_data.item_id) {
              upsertedItemIds.push(entry.catalog_data.item_id)
            }

            const specPayload = { ...entry.spec_data }
            if (entry.table_name === 'ac_combiner_specs' && 'ac_combiner_price' in specPayload) {
              specPayload.ac_combiner_price_per_unit = specPayload.ac_combiner_price
              delete specPayload.ac_combiner_price
            }

            const { error: specErr } = await supabase.from(entry.table_name).upsert(specPayload)
            if (specErr) {
              failures.push({ itemCode: code, table: entry.table_name, message: specErr.message })
            }
          }
        } else if (entry.action === 'DELETE') {
          const itemId = entry.catalog_data?.item_id
          const code = entry.catalog_data?.item_code ?? '(unknown)'
          if (itemId) {
            const { error: delErr } = await supabase.from('catalog_items').delete().eq('item_id', itemId)
            if (delErr) failures.push({ itemCode: code, table: 'catalog_items', message: delErr.message })
          }
        }
      }

      if (failures.length > 0) {
        if (upsertedItemIds.length > 0) {
          // Attempt rollback to ensure no partial inserts remain on error
          await supabase.from('catalog_items').delete().in('item_id', upsertedItemIds)
        }
        setSpecErrors(failures)
        addToast('error', `Publish failed — ${failures.length} item(s) had errors. Inserted items were rolled back.`)
        return
      }

      // 3. Mark the single version row as published with the changelog and final name
      const { error: updateErr } = await supabase
        .from('audit_log')
        .update({
          action: 'PUBLISHED',
          published_at: new Date().toISOString(),
          published_by: profile.id,
          notes: notes.trim() || null,
          new_data: { ...nd, version_name: newVersionName.trim() },
          price_version: newVersionName.trim(),
        })
        .eq('audit_id', sourceVersionId)

      if (updateErr) throw updateErr

      // 4. Update the global AC Map so future drafts inherit it
      if (nd?.ac_map && Array.isArray(nd.ac_map) && nd.ac_map.length > 0) {
        const { error: acMapErr } = await supabase
          .from('ac_map_specs')
          .insert({ ac_map: nd.ac_map })
        
        if (acMapErr) {
          console.error('Failed to update global ac_map_specs:', acMapErr)
          // Non-fatal, we still published successfully
        }
      }

      addToast('success', `Version "${newVersionName}" published successfully.`)
      onPublished()
    } catch (err: any) {
      console.error('[PublishDialog] Publish failed:', err)
      const errMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err))
      addToast('error', `Publish failed: ${errMsg}`)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Publish Price Version"
      description={`Publishing "${sourceVersionName}" will create a permanent, immutable snapshot. All future quotes can reference this version.`}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 p-3 bg-amber-900/20 border border-amber-800 rounded-lg text-sm text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            Once published, line item prices and formulas in this version <strong>cannot be edited</strong>.
            Create a new draft version for future changes.
          </div>
        </div>

        <Input
          label="New published version name"
          value={newVersionName}
          onChange={(e) => setNewVersionName(e.target.value)}
          placeholder="e.g. FY25 V23.0"
        />

        <div>
          <label className="block text-sm text-slate-400 mb-1.5">Changelog notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What changed in this version? Which line items were updated and why?"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white
                       placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500
                       px-3 py-2 resize-none"
          />
        </div>

        {/* Per-spec error breakdown */}
        {specErrors.length > 0 && (
          <div className="rounded-lg border border-red-800 bg-red-900/20 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-red-800 bg-red-900/30">
              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm font-semibold text-red-300">
                {specErrors.length} item{specErrors.length > 1 ? 's' : ''} failed to save
              </span>
            </div>
            <div className="divide-y divide-red-900/50 max-h-48 overflow-y-auto">
              {specErrors.map((e, i) => (
                <div key={i} className="px-3 py-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <code className="text-xs font-mono text-slate-400">{e.itemCode}</code>
                    <span className="text-xs text-red-500 font-mono bg-red-900/40 px-1.5 py-0.5 rounded">
                      {e.table}
                    </span>
                  </div>
                  <p className="text-xs text-red-300">{e.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={publishing}>Cancel</Button>
          <Button
            variant="primary"
            loading={publishing}
            disabled={!newVersionName.trim()}
            onClick={handlePublish}
          >
            {specErrors.length > 0 ? 'Retry Publish' : 'Publish Version'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
