import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, ChevronRight, Lock, Edit3, Trash2 } from 'lucide-react'
import { usePriceVersions, useCreateDraftVersion } from '../../hooks/usePriceVersions'
import { supabase } from '../../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Dialog from '../../components/ui/Dialog'
import Input from '../../components/ui/Input'
import type { PriceVersion } from '../../types/domain.types'

export default function VersionListPage() {
  const { data: versions, isLoading } = usePriceVersions()
  const createDraft = useCreateDraftVersion()
  const { addToast } = useToast()
  const qc = useQueryClient()

  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const publishedVersions = versions?.filter((v) => !v.is_draft) ?? []
  const draftVersions = versions?.filter((v) => v.is_draft) ?? []

  async function handleCreate() {
    if (!newName.trim()) return
    try {
      const result = await createDraft.mutateAsync({
        versionName: newName.trim(),
        notes: newNotes.trim(),
        sourceVersionId: sourceId || undefined,
      })
      addToast('success', `Draft "${result?.price_version ?? newName.trim()}" created.`)
      setShowNewDialog(false)
      setNewName('')
      setNewNotes('')
      setSourceId('')
    } catch (err: unknown) {
      const msg = (err as { message?: string; details?: string; hint?: string })
      const detail = [msg.message, msg.details, msg.hint].filter(Boolean).join(' — ')
      addToast('error', detail || 'Failed to create version')
      console.error('[createDraft]', err)
    }
  }

  async function handleDeleteDraft(version: PriceVersion) {
    if (!confirm(`Delete draft "${version.version_name}"? This cannot be undone.`)) return
    setDeletingId(version.id)
    try {
      const { error } = await supabase
        .from('audit_log')
        .delete()
        .eq('audit_id', version.id)
      if (error) throw error
      addToast('success', `Draft "${version.version_name}" deleted.`)
      qc.invalidateQueries({ queryKey: ['price-versions'] })
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to delete draft')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Price Table Versions</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage and publish pricing for all quote calculations.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<PlusCircle className="w-4 h-4" />}
          onClick={() => setShowNewDialog(true)}
        >
          New Draft
        </Button>
      </div>

      {/* Draft versions */}
      {draftVersions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            In Progress (Draft)
          </h2>
          <div className="space-y-2">
            {draftVersions.map((v) => (
              <VersionRow key={v.id} version={v} isDraft onDelete={handleDeleteDraft} deleting={deletingId === v.id} />
            ))}
          </div>
        </div>
      )}

      {/* Published versions */}
      <div>
        <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
          Published
        </h2>
        {publishedVersions.length === 0 ? (
          <div className="text-sm text-slate-500 py-4">No published versions yet.</div>
        ) : (
          <div className="space-y-2">
            {publishedVersions.map((v) => (
              <VersionRow key={v.id} version={v} isDraft={false} />
            ))}
          </div>
        )}
      </div>

      {/* New version dialog */}
      <Dialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        title="Create Draft Version"
        description="Start a new draft price table, optionally copying from an existing published version."
      >
        <div className="space-y-4">
          <Input
            label="Version name"
            placeholder="e.g. FY25 V23.0"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Copy from version (optional)</label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg text-sm text-white py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— Start blank —</option>
              {versions?.map((v) => (
                <option key={v.id} value={v.id}>{v.version_name} {v.is_draft ? '(Draft)' : '(Published)'}</option>
              ))}
            </select>
          </div>
          <Input
            label="Notes / changelog"
            placeholder="What changed in this version?"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={createDraft.isPending}
              disabled={!newName.trim()}
              onClick={handleCreate}
            >
              Create Draft
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function VersionRow({
  version, isDraft, onDelete, deleting,
}: {
  version: PriceVersion
  isDraft: boolean
  onDelete?: (v: PriceVersion) => void
  deleting?: boolean
}) {
  return (
    <div className="relative group">
      <Link
        to={`/price-tables/${version.id}`}
        className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl
                   hover:border-slate-700 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
          {isDraft
            ? <Edit3 className="w-4 h-4 text-amber-400" />
            : <Lock className="w-4 h-4 text-slate-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white text-sm">{version.version_name}</span>
            <Badge variant={isDraft ? 'draft' : 'success'}>
              {isDraft ? 'Draft' : 'Published'}
            </Badge>
          </div>
          {version.notes && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{version.notes}</p>
          )}
        </div>
        <div className="text-xs text-slate-600 shrink-0 mr-8">
          {isDraft
            ? `Created ${new Date(version.created_at).toLocaleDateString('en-AU')}`
            : `Published ${new Date(version.published_at!).toLocaleDateString('en-AU')}`
          }
        </div>
        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
      </Link>
      {isDraft && onDelete && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(version) }}
          disabled={deleting}
          className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete draft"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
