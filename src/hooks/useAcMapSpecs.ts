import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { AcMapSpecs, AcMapRow } from '../types/domain.types'

export function useAcMapSpecs() {
  return useQuery<AcMapSpecs | null>({
    queryKey: ['ac_map_specs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ac_map_specs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data as AcMapSpecs | null
    },
  })
}

export function useUpdateAcMapSpecs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ac_map: AcMapRow[]) => {
      // We always insert a new row to act as the latest master version
      const { data, error } = await supabase
        .from('ac_map_specs')
        .insert({ ac_map })
        .select()
        .single()

      if (error) throw error
      return data as AcMapSpecs
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ac_map_specs'] })
    },
  })
}
