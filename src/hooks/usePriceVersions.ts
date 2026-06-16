import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { AcMapRow } from '../types/domain.types'

export interface PriceVersion {
  id: string           // audit_id (UUID) — used as route param
  version_name: string
  notes: string | null
  is_draft: boolean
  published_at: string | null
  published_by: string | null
  created_at: string
  created_by: string | null
  ac_map?: AcMapRow[]
}

/** Fetch all versions. Each audit_log row with action DRAFT or PUBLISHED is one version. */
export function usePriceVersions() {
  return useQuery<PriceVersion[]>({
    queryKey: ['price-versions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .in('action', ['DRAFT', 'PUBLISHED'])
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data ?? []).map((row) => {
        const nd = row.new_data as any
        return {
          id: row.audit_id,
          version_name: nd?.version_name ?? row.price_version ?? row.audit_id,
          notes: row.notes,
          is_draft: !row.published_at,
          published_at: row.published_at,
          published_by: row.published_by,
          created_at: row.created_at,
          created_by: row.created_by,
          ac_map: nd?.ac_map,
        }
      })
    },
  })
}

export function useLatestPublishedVersion() {
  return useQuery<PriceVersion | null>({
    queryKey: ['price-versions', 'latest-published'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('action', 'PUBLISHED')
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      const nd = data.new_data as any
      return {
        id: data.audit_id,
        version_name: nd?.version_name ?? data.price_version ?? data.audit_id,
        notes: data.notes,
        is_draft: false,
        published_at: data.published_at,
        published_by: data.published_by,
        created_at: data.created_at,
        created_by: data.created_by,
        ac_map: nd?.ac_map,
      }
    },
  })
}

/** Fetch a single version by its audit_id (UUID). */
export function usePriceVersion(id: string | undefined) {
  return useQuery<PriceVersion | null>({
    queryKey: ['price-versions', id],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('audit_id', id)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      const nd = data.new_data as any
      return {
        id: data.audit_id,
        version_name: nd?.version_name ?? data.price_version ?? data.audit_id,
        notes: data.notes,
        is_draft: !data.published_at,
        published_at: data.published_at,
        published_by: data.published_by,
        created_at: data.created_at,
        created_by: data.created_by,
        ac_map: nd?.ac_map,
      }
    },
    enabled: !!id,
  })
}

/** Create a new draft version — inserts a single audit_log row with items: [] */
export function useCreateDraftVersion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      versionName,
      notes,
      sourceVersionId,
    }: {
      versionName: string
      notes: string
      sourceVersionId?: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? null

      // If copying from a source version, fetch its items
      let copiedItems: any[] = []
      if (sourceVersionId) {
        const { data: sourceRow } = await supabase
          .from('audit_log')
          .select('new_data')
          .eq('audit_id', sourceVersionId)
          .single()

        if (sourceRow) {
          const sourceNd = sourceRow.new_data as any
          const sourceItems: any[] = sourceNd?.items ?? []

          // Copy all non-DELETE items, resetting change_id but keeping catalog/spec data intact
          copiedItems = sourceItems
            .filter((e: any) => e.action !== 'DELETE')
            .map((e: any) => ({
              ...e,
              change_id: crypto.randomUUID(),
              // Keep original action type (ADD or UPDATE) so publish knows how to apply them
            }))
        }
      }

      // Fetch the latest ac_map
      const { data: acMapRow } = await supabase
        .from('ac_map_specs')
        .select('ac_map')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const { data, error } = await supabase
        .from('audit_log')
        .insert({
          action: 'DRAFT',
          price_version: versionName,
          new_data: { 
            version_name: versionName, 
            items: copiedItems,
            ac_map: acMapRow?.ac_map || [] 
          },
          notes: notes || null,
          created_by: userId,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['price-versions'] })
    },
  })
}
