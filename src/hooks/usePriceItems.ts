import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { PriceItem, ItemCategory } from '../types/domain.types'
import { CATALOG_CATEGORY_OPTIONS, PREFIX_MAP } from '../lib/constants'

// ── Shared item-building helper ──────────────────────────────────────────────

function mapLegacyCategory(oldCat: string, oldType: string): ItemCategory {
  if (oldCat === 'Solar') return 'PV_Components'
  if (oldCat === 'BESS') return 'BESS'
  if (oldCat === 'Electrical') {
    if (oldType === 'AC Cabling' || oldType === 'DC Cabling') return 'Cabling'
    return 'Switchgear'
  }
  if (oldCat === 'Installation') return 'Install'
  if (oldCat === 'Monitoring' || oldCat === 'Software') return 'Monitoring'
  return oldCat as ItemCategory
}

function buildPriceItem(
  versionId: string,
  catalogData: any,
  specData: any,
  sortOrder: number
): PriceItem | null {
  const prefix = catalogData.item_code?.split('-')[0]?.toUpperCase()
  const oldCat = catalogData.category
  const oldType = catalogData.item_type

  // Find category config by prefix
  const REVERSE_MAP = Object.entries(PREFIX_MAP).reduce((acc, [cat, pfx]) => {
    acc[pfx.toUpperCase()] = cat
    return acc
  }, {} as Record<string, string>)

  const categoryValue = prefix ? REVERSE_MAP[prefix] : undefined
  let catConfig = categoryValue ? CATALOG_CATEGORY_OPTIONS.find(c => c.value === categoryValue) : undefined

  const mappedCat = mapLegacyCategory(oldCat, oldType)

  if (!catConfig) {
    // Fallback: try matching by category and type
    catConfig = CATALOG_CATEGORY_OPTIONS.find(c => c.dbCategory === mappedCat && c.dbType === oldType)

    // Last resort fallback: just use the first config for this category
    if (!catConfig) {
      catConfig = CATALOG_CATEGORY_OPTIONS.find(c => c.dbCategory === mappedCat)
    }
  }

  if (!catConfig) {
    // Absolute fallback if everything fails
    return {
      id: catalogData.item_id,
      version_id: versionId,
      category: mappedCat,
      subcategory: catalogData.subcategory || oldType || null,
      code: catalogData.item_code || 'N/A',
      name: catalogData.item_name || 'Unknown Item',
      unit: 'ea',
      base_price: 0,
      formula: null,
      conditions: {},
      sort_order: sortOrder,
      is_optional: false,
      is_active: true,
      notes: null,
      created_at: catalogData.created_at ?? new Date().toISOString(),
      specData,
      type_value: undefined,
    }
  }

  const n = (k: string) => parseFloat(specData?.[k]) || 0

  let basePrice = 0
  switch (catConfig.value) {
    case 'panels': basePrice = n('cost_per_watt') * n('wattage'); break;
    case 'batteries': basePrice = n('battery_price_fob'); break;
    case 'inverters': basePrice = n('cost_per_unit'); break;
    case 'optimisers': case 'pfc': case 'harm_filtering': basePrice = n('price_per_unit'); break;
    case 'racking': basePrice = n('cost_per_panel'); break;
    case 'additional_racking': basePrice = n('cost_per_item'); break;
    case 'inverter_station': basePrice = n('inverter_station_cost_per_unit'); break;
    case 'pvdb': case 'bessdb': basePrice = n('full_export_price'); break;
    case 'netnada': case 'netnada_addons': case 'safety': case 'monitoring_warranty': case 'monitoring_addons': case 'install': basePrice = n('price'); break;
    case 'battery_inverter': basePrice = n('pcs_price_excl_gst'); break;
    case 'ac_cabling': basePrice = n('4c_plus_earth_price_per_meter'); break;
    case 'dc_twin_cabling': basePrice = n('twin_dc_cable_price_per_mm'); break;
    case 'ac_combiner': basePrice = n('ac_combiner_price_per_unit'); break;
    case 'dc_combiner': basePrice = n('dc_combiner_price_per_unit'); break;
    case 'cabling_addons': basePrice = n('cost_per_meter'); break;
    case 'switch_gear': basePrice = n('total_price'); break;
    case 'ac_breaker': basePrice = n('price_per_breaker'); break;
    case 'lifting': basePrice = n('cost_per_time') * Math.max(n('number_of_lifts'), 1) * Math.max(n('establishments'), 1); break;
    case 'travel_accoms_freight': basePrice = n('travel') + n('accom') + n('freight'); break;
    case 'prelim_general': case 'witness_injection': basePrice = n('price_total'); break;
    case 'grid_connection': basePrice = (n('total_network_fee') || 0) + (n('additional_cost') || 0) + (n('hv_site_variation') || 0) + (n('full_export_variation') || 0) + (n('preliminary_enquiry') || 0); break;
  }
  let finalSubcategory = catalogData.subcategory || catConfig.label || null
  if (finalSubcategory === 'Lifting Equipment') {
    finalSubcategory = 'Lifting Equipment/Battery Install'
  }

  return {
    id: catalogData.item_id,
    version_id: versionId,
    category: (catConfig.dbCategory || mapLegacyCategory(oldCat, oldType)) as ItemCategory,
    subcategory: finalSubcategory,
    code: catalogData.item_code,
    name: catalogData.item_name || specData?.item_name || `${catConfig.label} Item`,
    unit: catalogData.unit || specData?.unit || 'ea',
    base_price: basePrice,
    formula: null,
    conditions: {},
    sort_order: sortOrder,
    is_optional: false,
    is_active: true,
    notes: specData?.notes ?? null,
    created_at: catalogData.created_at ?? new Date().toISOString(),
    specData,
    type_value: catConfig.value,
  }
}

// ── usePriceItems ─────────────────────────────────────────────────────────────

export function usePriceItems(versionId: string | undefined) {
  return useQuery<PriceItem[]>({
    queryKey: ['price-items', versionId],
    queryFn: async () => {
      if (!versionId) return []

      // Fetch the single audit_log row for this version (by audit_id)
      const { data: versionRow, error: verErr } = await supabase
        .from('audit_log')
        .select('*')
        .eq('audit_id', versionId)
        .maybeSingle()

      if (verErr) throw verErr
      if (!versionRow) return []

      const nd = versionRow.new_data as any
      const stagedItems: any[] = nd?.items ?? []

      const priceItems: PriceItem[] = []
      let sortOrder = 0

      // Build PriceItem list from the items array in new_data
      for (const entry of stagedItems) {
        if (entry.action === 'DELETE') continue // skip deleted items

        const catalogData = entry.catalog_data
        const specData = entry.spec_data

        const item = buildPriceItem(versionId, catalogData, specData, sortOrder++)
        if (item) priceItems.push(item)
      }

      return priceItems
    },
    enabled: !!versionId,
  })
}

// ── Stubs (mutations now handled directly in VersionEditorPage) ───────────────

export function useUpdatePriceItem() {
  return useMutation({
    mutationFn: async () => { throw new Error('Use specific update hooks for new architecture') }
  })
}

export function useCreatePriceItem() {
  return useMutation({
    mutationFn: async () => { throw new Error('Use specific insert hooks for new architecture') }
  })
}

export function useDeletePriceItem() {
  return useMutation({
    mutationFn: async () => { throw new Error('Delete not supported in this view') }
  })
}
