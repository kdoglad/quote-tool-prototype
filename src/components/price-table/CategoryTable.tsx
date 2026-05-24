import { Save, Trash2, Check } from 'lucide-react'
import { clsx } from 'clsx'
import type { PriceItem } from '../../types/domain.types'
import { CATALOG_CATEGORY_OPTIONS } from '../../lib/constants'

interface CategoryTableProps {
  typeValue: string // Note: We rename prefix to typeValue
  items: PriceItem[]
  isDraft: boolean
  onEdit: (item: PriceItem) => void
  onDelete: (item: PriceItem) => void
}

export default function CategoryTable({ typeValue, items, isDraft, onEdit, onDelete }: CategoryTableProps) {
  const typeConfig = CATALOG_CATEGORY_OPTIONS.find(c => c.value === typeValue)

  if (!typeConfig) {
    if (items.length === 0) return null
    return (
      <div className="mb-6 last:mb-0 p-4 border border-red-800/50 rounded-xl bg-red-900/10">
        <h3 className="text-red-400 font-semibold mb-2 text-sm">Unmapped Items ({typeValue})</h3>
        <p className="text-xs text-red-300 mb-2">
          {items.length} items could not be mapped to a valid category table configuration.
          This usually happens if the items were saved with legacy item types or unrecognized prefixes.
        </p>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {items.map(i => (
            <div key={i.id} className="text-[10px] font-mono text-red-200 bg-red-950/50 p-2 rounded">
              Code: {i.code} | Name: {i.name}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) return null

  // Only show a Name column for spec tables that actually have item_name or name
  const NEEDS_NAME = ['panels', 'batteries', 'battery_inverter', 'additional_racking', 'ac_combiner', 'cabling_addons', 'monitoring_addons', 'monitoring_warranty', 'netnada_addons', 'prelim_general', 'safety', 'switch_gear', 'ac_breaker', 'lifting']
  const showName = NEEDS_NAME.includes(typeConfig.value)

  function renderHeaders() {
    switch (typeConfig?.value) {
      case 'prelim_general':
        return <><th className="px-4 py-2 text-left">Item Type</th><th className="px-4 py-2 text-right">Price Total</th></>
      case 'witness_injection':
        return (
          <>
            <th className="px-4 py-2 text-left">DNSP</th>
            <th className="px-4 py-2 text-right">Req. Over (kVA)</th>
            <th className="px-4 py-2 text-right">Solar/BESS Price</th>
            <th className="px-4 py-2 text-right">BESS Only Price</th>
            <th className="px-4 py-2 text-right">Price Total</th>
          </>
        )
      case 'grid_connection':
        return (
          <>
            <th className="px-4 py-2 text-left">DNSP</th>
            <th className="px-4 py-2 text-left">State</th>
            <th className="px-4 py-2 text-right">Low (kVA)</th>
            <th className="px-4 py-2 text-right">High (kVA)</th>
            <th className="px-4 py-2 text-right">App Fee</th>
            <th className="px-4 py-2 text-right">Network Fee</th>
            <th className="px-4 py-2 text-right">Add. Cost</th>
            <th className="px-4 py-2 text-right">HV Var.</th>
            <th className="px-4 py-2 text-right">Exp. Var.</th>
            <th className="px-4 py-2 text-right">Prelim. Enq.</th>
            <th className="px-4 py-2 text-center">BESS</th>
            <th className="px-4 py-2 text-center">Solar</th>
            <th className="px-4 py-2 text-center">Enq.</th>
            <th className="px-4 py-2 text-center">Proj.</th>
          </>
        )
      case 'grid_protection':
        return <><th className="px-4 py-2 text-left">DNSP</th><th className="px-4 py-2 text-right">Req. Over (kVA)</th><th className="px-4 py-2 text-center">Export Limit</th></>
      case 'panels':
        return <><th className="px-4 py-2 text-left">Brand</th><th className="px-4 py-2 text-left w-28">Datasheet Code</th><th className="px-4 py-2 text-center w-28">Local Stock</th><th className="px-4 py-2 text-right">Wattage</th><th className="px-4 py-2 text-right">Cost/W</th></>
      case 'inverters':
        return <><th className="px-4 py-2 text-left">Brand</th><th className="px-4 py-2 text-left">Model</th><th className="px-4 py-2 text-right">Power (W)</th><th className="px-4 py-2 text-right">Cost/Unit</th></>
      case 'optimisers':
        return <><th className="px-4 py-2 text-left">Optimiser</th><th className="px-4 py-2 text-right">Size (VA)</th><th className="px-4 py-2 text-right">Price/Unit</th></>
      case 'racking':
        return <><th className="px-4 py-2 text-left">Racking Type</th><th className="px-4 py-2 text-right">Cost/Panel</th><th className="px-4 py-2 text-right">Cost/W</th></>
      case 'additional_racking':
        return <><th className="px-4 py-2 text-right">Cost/Item</th><th className="px-4 py-2 text-right">Cost/W</th><th className="px-4 py-2 text-right">Total Added</th></>

      case 'inverter_station':
        return <><th className="px-4 py-2 text-left">Station Desc.</th><th className="px-4 py-2 text-right">Cost/Unit</th></>
      case 'pvdb':
        return <><th className="px-4 py-2 text-left">PVDB Type</th><th className="px-4 py-2 text-right">Export Limited ($)</th><th className="px-4 py-2 text-right">Full Export ($)</th></>
      case 'pfc':
        return <><th className="px-4 py-2 text-left">PFC Type</th><th className="px-4 py-2 text-right">Price/Unit</th></>
      case 'netnada':
        return <><th className="px-4 py-2 text-left">Plan Type</th><th className="px-4 py-2 text-left">Payment Plan</th><th className="px-4 py-2 text-right">Price</th></>
      case 'netnada_addons':
        return <><th className="px-4 py-2 text-left">Payment Plan</th><th className="px-4 py-2 text-right">Price</th></>
      case 'harm_filtering':
        return <><th className="px-4 py-2 text-left">Filter Type</th><th className="px-4 py-2 text-right">Price/Unit</th></>
      case 'batteries':
        return <><th className="px-4 py-2 text-left">Brand</th><th className="px-4 py-2 text-right">Nominal kWh</th><th className="px-4 py-2 text-right">Battery Price FOB (Ex.GST)</th><th className="px-4 py-2 text-center">PCS Inc.</th></>
      case 'battery_inverter':
        return <><th className="px-4 py-2 text-left">Brand</th><th className="px-4 py-2 text-right">kVA</th><th className="px-4 py-2 text-right">PCS Price</th></>
      case 'bessdb':
        return <><th className="px-4 py-2 text-left">BESSDB Type</th><th className="px-4 py-2 text-right">Export Limited ($)</th><th className="px-4 py-2 text-right">Full Export ($)</th></>
      case 'ac_cabling':
        return <><th className="px-4 py-2 text-right">Single Core Price/m</th><th className="px-4 py-2 text-right">Size (mm²)</th><th className="px-4 py-2 text-left">Material</th><th className="px-4 py-2 text-right">4C+E Price/m</th></>
      case 'ac_combiner':
        return <><th className="px-4 py-2 text-right">Combiner Price</th></>
      case 'dc_combiner':
        return <><th className="px-4 py-2 text-left">Combiner Name</th><th className="px-4 py-2 text-right">Combiner Price/Unit</th></>
      case 'dc_twin_cabling':
        return <><th className="px-4 py-2 text-right">Size (mm)</th><th className="px-4 py-2 text-right">Price/mm</th></>
      case 'cabling_addons':
        return <><th className="px-4 py-2 text-left">Addon Type</th><th className="px-4 py-2 text-right">Cost/Meter</th></>
      case 'switch_gear':
        return <><th className="px-4 py-2 text-left">Item Type</th><th className="px-4 py-2 text-right">Total Price</th></>
      case 'ac_breaker':
        return <><th className="px-4 py-2 text-left">Breaker Type</th><th className="px-4 py-2 text-right">Rating (A)</th><th className="px-4 py-2 text-right">Price/Breaker</th></>
      case 'install':
        return <><th className="px-4 py-2 text-left">Item Type</th><th className="px-4 py-2 text-right">Price</th></>
      case 'lifting':
        return <><th className="px-4 py-2 text-left">Lifting Type</th><th className="px-4 py-2 text-right">Cost/Time</th><th className="px-4 py-2 text-right">Total Cost</th><th className="px-4 py-2 text-center">Batt. Install</th></>
      case 'travel_accoms_freight':
        return <><th className="px-4 py-2 text-right">Travel</th><th className="px-4 py-2 text-right">Accom</th><th className="px-4 py-2 text-right">Freight</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-right">Distance (km)</th></>
      case 'safety': case 'monitoring_warranty': case 'monitoring_addons':
        return <><th className="px-4 py-2 text-left">Item Type</th><th className="px-4 py-2 text-right">Price</th></>
      default:
        return null
    }
  }

  function renderCells(item: PriceItem) {
    const d = item.specData as any || {}
    const r = (val: any, format?: string) => {
      if (val === null || val === undefined) return '-'
      if (format === '$') return `$${parseFloat(val).toFixed(2)}`
      if (format === 'W') return `${val} W`
      if (format === 'kVA') return `${val} kVA`
      if (format === 'kWh') return `${val} kWh`
      if (format === 'VA') return `${val} VA`
      if (format === 'mm2') return `${val} mm²`
      if (format === 'A') return `${val} A`
      if (format === 'km') return `${val} km`
      return val
    }
    const c = (val: any) => (
      val ? <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-brand-500/10 text-brand-400"><Check className="w-3 h-3" /></span> : <span className="text-slate-600">-</span>
    )

    switch (typeConfig?.value) {
      case 'prelim_general': return <><td className="px-4 py-2.5 text-slate-300">{r(d.item_type)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.price_total, '$')}</td></>
      case 'witness_injection':
        return (
          <>
            <td className="px-4 py-2.5 text-slate-300">{r(d.dnsp)}</td>
            <td className="px-4 py-2.5 font-mono text-slate-300 text-xs text-right">{r(d.required_over_kva)}</td>
            <td className="px-4 py-2.5 font-mono text-slate-300 text-xs text-right">{r(d.solar_solar_bess_price, '$')}</td>
            <td className="px-4 py-2.5 font-mono text-slate-300 text-xs text-right">{r(d.bess_only_price, '$')}</td>
            <td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.price_total, '$')}</td>
          </>
        )
      case 'grid_connection':
        return (
          <>
            <td className="px-4 py-2.5 text-slate-300">{r(d.dnsp)}</td>
            <td className="px-4 py-2.5 text-slate-300">{r(d.state)}</td>
            <td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.low_size_kva, 'kVA')}</td>
            <td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.high_side_kva, 'kVA')}</td>
            <td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.app_fee_tech_assessment, '$')}</td>
            <td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.total_network_fee, '$')}</td>
            <td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.additional_cost, '$')}</td>
            <td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.hv_site_variation, '$')}</td>
            <td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.full_export_variation, '$')}</td>
            <td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.preliminary_enquiry, '$')}</td>
            <td className="px-4 py-2.5 text-center">{c(d.is_bess_only)}</td>
            <td className="px-4 py-2.5 text-center">{c(d.is_solar_or_solar_bess)}</td>
            <td className="px-4 py-2.5 text-center">{c(d.is_project_needed)}</td>
          </>
        )
      case 'grid_protection': return <><td className="px-4 py-2.5 text-slate-300">{r(d.dnsp)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.required_over_kva, 'kVA')}</td><td className="px-4 py-2.5 text-center">{c(d.is_export_limit_enforced)}</td></>
      case 'panels': return <><td className="px-4 py-2.5 text-slate-300">{r(d.brand)}</td><td className="px-4 py-2.5 text-slate-400 text-xs">{r(d.datasheet_code)}</td><td className="px-4 py-2.5 text-center">{c(d.is_local_stock)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.wattage, 'W')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.cost_per_watt, '$')}</td></>
      case 'inverters': return <><td className="px-4 py-2.5 text-slate-300">{r(d.brand)}</td><td className="px-4 py-2.5 text-slate-300">{r(d.model)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.watt, 'W')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.cost_per_unit, '$')}</td></>
      case 'optimisers': return <><td className="px-4 py-2.5 text-slate-300">{r(d.optimiser_name)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.size_va, 'VA')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.price_per_unit, '$')}</td></>
      case 'racking': return <><td className="px-4 py-2.5 text-slate-300">{r(d.racking_type)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.cost_per_panel, '$')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.cost_per_watt, '$')}</td></>
      case 'additional_racking': return <><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.cost_per_item, '$')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.cost_per_watt, '$')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.total_added_price, '$')}</td></>
      case 'inverter_station': return <><td className="px-4 py-2.5 text-slate-300">{r(d.inverter_station)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.inverter_station_cost_per_unit, '$')}</td></>
      case 'pvdb': return <><td className="px-4 py-2.5 text-slate-300">{r(d.pvdb_type)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.export_limited_price, '$')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.full_export_price, '$')}</td></>
      case 'pfc': return <><td className="px-4 py-2.5 text-slate-300">{r(d.pfc_type)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.price_per_unit, '$')}</td></>
      case 'netnada': return <><td className="px-4 py-2.5 text-slate-300">{r(d.plan_type)}</td><td className="px-4 py-2.5 text-slate-300">{r(d.payment_plan)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.price, '$')}</td></>
      case 'netnada_addons': return <><td className="px-4 py-2.5 text-slate-300">{r(d.payment_plan)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.price, '$')}</td></>
      case 'harm_filtering': return <><td className="px-4 py-2.5 text-slate-300">{r(d.item_type)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.price_per_unit, '$')}</td></>
      case 'batteries': return <><td className="px-4 py-2.5 text-slate-300">{r(d.brand)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.nominal_kwh, 'kWh')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.battery_price_fob, '$')}</td><td className="px-4 py-2.5 text-center">{c(d.is_pcs_included)}</td></>
      case 'battery_inverter': return <><td className="px-4 py-2.5 text-slate-300">{r(d.brand)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.kva, 'kVA')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.pcs_price_excl_gst, '$')}</td></>
      case 'bessdb': return <><td className="px-4 py-2.5 text-slate-300">{r(d.bessdb_type)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.export_limited_price, '$')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.full_export_price, '$')}</td></>
      case 'ac_cabling': return <><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.single_core_price_per_meter, '$')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.size_mm2, 'mm2')}</td><td className="px-4 py-2.5 text-slate-300">{r(d.conductor_material)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d['4c_plus_earth_price_per_meter'], '$')}</td></>
      case 'ac_combiner': return <><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.ac_combiner_price_per_unit, '$')}</td></>
      case 'dc_combiner': return <><td className="px-4 py-2.5 text-slate-300">{r(d.dc_combiner_name)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.dc_combiner_price_per_unit, '$')}</td></>
      case 'dc_twin_cabling': return <><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.size_twin_dc_cable_mm)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.twin_dc_cable_price_per_mm, '$')}</td></>
      case 'cabling_addons': return <><td className="px-4 py-2.5 text-slate-300">{r(d.addon_type)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.cost_per_meter, '$')}</td></>
      case 'switch_gear': return <><td className="px-4 py-2.5 text-slate-300">{r(d.item_type)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.total_price, '$')}</td></>
      case 'ac_breaker': return <><td className="px-4 py-2.5 text-slate-300">{r(d.breaker_type)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.rating_a, 'A')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.price_per_breaker, '$')}</td></>
      case 'install': return <><td className="px-4 py-2.5 text-slate-300">{r(d.item_type)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.price, '$')}</td></>
      case 'lifting': return <><td className="px-4 py-2.5 text-slate-300">{r(d.lifting_type)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.cost_per_time, '$')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.total_cost, '$')}</td><td className="px-4 py-2.5 text-center">{c(d.is_battery_install)}</td></>
      case 'travel_accoms_freight': return <><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.travel, '$')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.accom, '$')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.freight, '$')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.total, '$')}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.distance_frm_city_center, 'km')}</td></>
      case 'safety': case 'monitoring_warranty': case 'monitoring_addons': return <><td className="px-4 py-2.5 text-slate-300">{r(d.item_type)}</td><td className="px-4 py-2.5 font-mono text-brand-400 text-xs text-right">{r(d.price, '$')}</td></>
      default: return null
    }
  }

  return (
    <div className="mb-6 last:mb-0">
      <h3 className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/30 rounded-t-lg border-b border-slate-800">
        {typeConfig.label}
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-800">
            <th className="px-4 py-2 text-left w-24">Code</th>
            {showName && <th className="px-4 py-2 text-left">Name</th>}
            {renderHeaders()}
            <th className="px-4 py-2 text-left w-16">{typeConfig?.value === 'lifting' ? 'Unit of Time' : 'Unit'}</th>
            <th className="px-4 py-2 text-right w-28">Base Price</th>
            <th className="px-4 py-2 w-16" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={clsx('border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20 group', !item.is_active && 'opacity-40')}>
              <td className="px-4 py-2.5">
                <code className="text-xs text-slate-500 font-mono">{item.code}</code>
              </td>
              {showName && (
                <td className="px-4 py-2.5">
                  <span className="text-slate-200">{item.name}</span>
                  {item.is_optional && <span className="ml-2 text-xs text-slate-600">(optional)</span>}
                </td>
              )}
              {renderCells(item)}
              <td className="px-4 py-2.5 text-slate-500 text-xs">{item.unit || 'ea'}</td>
              <td className="px-4 py-2.5 text-right font-mono text-brand-400 text-xs">
                $${(item.base_price || 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-2.5">
                {isDraft && (
                  <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(item)}
                      className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-slate-700"
                      title="Edit item"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(item)}
                      className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-slate-700"
                      title="Delete item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}