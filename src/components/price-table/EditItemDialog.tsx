import { useState, useEffect } from 'react'
import Dialog from '../ui/Dialog'
import Input from '../ui/Input'
import Button from '../ui/Button'
import { CATALOG_CATEGORY_OPTIONS, PREFIX_MAP } from '../../lib/constants'
import type { PriceItem } from '../../types/domain.types'

interface Props {
  item: PriceItem
  onSave: (updates: Partial<PriceItem>, catalogData?: any, specData?: any, specTable?: string) => void
  onClose: () => void
  saving: boolean
}

const REVERSE = Object.entries(PREFIX_MAP).reduce((a, [cat, pfx]) => ({ ...a, [pfx]: cat }), {} as Record<string, string>)

function cb(label: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-400">
      <input type="checkbox" checked={checked} onChange={onChange} className="rounded border-slate-700 bg-slate-800 text-brand-500" />
      {label}
    </label>
  )
}

export default function EditItemDialog({ item, onSave, onClose, saving }: Props) {
  const [name, setName] = useState(item.name)
  const [fields, setFields] = useState<Record<string, any>>({})

  const category = REVERSE[item.code.split('-')[0]] || 'panels'
  const catObj = CATALOG_CATEGORY_OPTIONS.find(c => c.value === category)!

  // Only show the free-text Name field for spec tables that actually have an item_name or name column
  const NEEDS_NAME = ['panels', 'additional_racking', 'batteries', 'battery_inverter', 'cabling_addons', 'monitoring_addons', 'monitoring_warranty', 'netnada_addons', 'prelim_general', 'safety', 'switch_gear', 'ac_breaker', 'lifting']

  useEffect(() => {
    const d = item.specData as any
    if (!d) return
    setFields(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v ?? ''])))
  }, [item.id, item.specData])

  const sf = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFields(p => ({ ...p, [k]: e.target.value }))
  const sfb = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(p => ({ ...p, [k]: e.target.checked }))
  const fv = (k: string) => { const v = fields[k]; return v === null || v === undefined ? '' : String(v) }
  const fb = (k: string) => Boolean(fields[k])
  const n = (k: string) => parseFloat(fv(k)) || null

  function buildSpecData() {
    const base = { item_id: item.id, item_code: item.code }
    switch (category) {
      case 'prelim_general': return { ...base, item_name: name, item_type: fv('item_type'), price_total: n('price_total') }
      case 'grid_connection': return {
        ...base,
        dnsp: fv('dnsp'),
        state: fv('state'),
        low_size_kva: n('low_size_kva'),
        high_side_kva: n('high_side_kva'),
        app_fee_tech_assessment: n('app_fee_tech_assessment'),
        total_network_fee: n('total_network_fee'),
        additional_cost: n('additional_cost'),
        hv_site_variation: n('hv_site_variation'),
        full_export_variation: n('full_export_variation'),
        is_bess_only: fb('is_bess_only'),
        is_solar_or_solar_bess: fb('is_solar_or_solar_bess'),
        preliminary_enquiry: n('preliminary_enquiry'),
        is_project_needed: fb('is_project_needed'),
        notes: fv('notes')
      }
      case 'witness_injection': return { ...base, dnsp: fv('dnsp'), required_over_kva: n('required_over_kva'), price_total: n('price_total'), solar_solar_bess_price: n('solar_solar_bess_price'), bess_only_price: n('bess_only_price') }
      case 'grid_protection': return { ...base, dnsp: fv('dnsp'), required_over_kva: n('required_over_kva'), is_export_limit_enforced: fb('is_export_limit_enforced') }
      case 'panels': return { ...base, item_name: name, brand: fv('brand'), wattage: n('wattage'), cost_per_watt: n('cost_per_watt'), item_type: 'Panel', product_warranty: n('product_warranty'), performance_warranty: n('performance_warranty'), is_local_stock: fb('is_local_stock'), datasheet_code: fv('datasheet_code'), notes: fv('notes') || null }
      case 'inverters': return { ...base, brand: fv('brand'), model: fv('model'), watt: n('watt'), cost_per_unit: n('cost_per_unit'), warranty_years: n('warranty_years') }
      case 'optimisers': return { ...base, optimiser_name: fv('optimiser_name'), size_va: n('size_va'), price_per_unit: n('price_per_unit') }
      case 'racking': return { ...base, racking_type: fv('racking_type'), cost_per_panel: n('cost_per_panel'), cost_per_watt: n('cost_per_watt') }
      case 'additional_racking': return { ...base, item_name: name, total_added_price: n('total_added_price'), cost_per_watt: n('cost_per_watt'), cost_per_item: n('cost_per_item'), unit: fv('unit') || 'ea' }
      case 'inverter_station': return { ...base, inverter_station: fv('inverter_station'), inverter_station_cost_per_unit: n('inverter_station_cost_per_unit') }
      case 'pvdb': return { ...base, pvdb_type: fv('pvdb_type'), export_limited_price: n('export_limited_price'), full_export_price: n('full_export_price') }
      case 'pfc': return { ...base, pfc_type: fv('pfc_type'), price_per_unit: n('price_per_unit') }
      case 'netnada': return { ...base, plan_type: fv('plan_type'), price: n('price'), payment_plan: fv('payment_plan') }
      case 'netnada_addons': return { ...base, item_name: name, price: n('price'), payment_plan: fv('payment_plan') }
      case 'harm_filtering': return { ...base, item_type: fv('item_type'), price_per_unit: n('price_per_unit') }
      case 'batteries': return { ...base, item_name: name, brand: fv('brand'), nominal_kwh: n('nominal_kwh'), battery_price_fob: n('battery_price_fob'), product_warranty: n('product_warranty'), performance_warranty: n('performance_warranty'), is_pcs_included: fb('is_pcs_included'), pcs_table_ref: fv('pcs_table_ref') || null, suggested_pcs: fv('suggested_pcs') || null, cost_per_kwh_inc_pcs: n('cost_per_kwh_inc_pcs'), notes: fv('notes') || null, is_smartstack_compatible: fb('is_smartstack_compatible') }
      case 'battery_inverter': return { ...base, item_name: name, brand: fv('brand'), kva: n('kva'), pcs_price_excl_gst: n('pcs_price_excl_gst'), notes: fv('notes') || null }
      case 'bessdb': return { ...base, bessdb_type: fv('bessdb_type'), export_limited_price: n('export_limited_price'), full_export_price: n('full_export_price') }
      case 'ac_cabling': return { ...base, conductor_material: fv('conductor_material') || null, single_core_price_per_meter: n('single_core_price_per_meter'), size_mm2: n('size_mm2'), '4c_plus_earth_price_per_meter': n('4c_plus_earth_price_per_meter'), inclusion: fv('inclusion') || null, notes: fv('notes') || null }
      case 'ac_combiner': return { ...base, ac_combiner_name: fv('ac_combiner_name') || null, ac_combiner_price_per_unit: n('ac_combiner_price_per_unit'), notes: fv('notes') || null }
      case 'dc_combiner': return { ...base, dc_combiner_name: fv('dc_combiner_name') || null, dc_combiner_price_per_unit: n('dc_combiner_price_per_unit'), notes: fv('notes') || null }
      case 'dc_cabling': return { ...base, conductor_material: fv('conductor_material') || null, single_core_price_per_meter: n('single_core_price_per_meter'), size_mm2: n('size_mm2'), '4c_plus_earth_price_per_meter': n('4c_plus_earth_price_per_meter'), inclusion: fv('inclusion') || null, notes: fv('notes') || null }
      case 'dc_twin_cabling': return { ...base, size_twin_dc_cable_mm: n('size_twin_dc_cable_mm'), twin_dc_cable_price_per_mm: n('twin_dc_cable_price_per_mm'), notes: fv('notes') || null }
      case 'cabling_addons': return { ...base, addon_type: fv('addon_type') || null, item_name: name, cost_per_meter: n('cost_per_meter') }
      case 'switch_gear': return { ...base, item_name: name, item_type: fv('item_type') || null, total_price: n('total_price') }
      case 'ac_breaker': return { ...base, name, breaker_type: fv('breaker_type') || null, rating_a: n('rating_a'), price_per_breaker: n('price_per_breaker'), is_projects_needed: fb('is_projects_needed') }
      case 'install': return { ...base, install_item: fv('install_item') || null, item_type: fv('item_type') || null, price: n('price'), unit: fv('unit') || 'ea' }
      case 'lifting': return { ...base, name, lifting_type: fv('lifting_type') || null, total_cost: n('total_cost'), set_up_est_price: n('set_up_est_price'), cost_per_time: n('cost_per_time'), time: n('time'), unit: fv('unit') || 'ea', number_of_lifts: n('number_of_lifts'), establishments: n('establishments'), is_battery_install: fb('is_battery_install') }
      case 'travel_accoms_freight': return { ...base, travel_rates: fv('travel_rates') || null, distance_frm_city_center: n('distance_frm_city_center'), travel: n('travel'), accom: n('accom'), freight: n('freight'), total: n('total') }
      case 'safety': return { ...base, item_name: name, item_type: fv('item_type') || null, price: n('price'), unit: fv('unit') || 'ea' }
      case 'monitoring_warranty': return { ...base, item_name: name, item_type: fv('item_type') || null, price: n('price'), unit: fv('unit') || 'ea' }
      case 'monitoring_addons': return { ...base, item_name: name, item_type: fv('item_type') || null, price: n('price'), unit: fv('unit') || 'ea' }
      default: return base
    }
  }

  function getBasePrice() {
    switch (category) {
      case 'panels': return (n('cost_per_watt') || 0) * (n('wattage') || 0)
      case 'batteries': return n('battery_price_fob') || 0
      case 'inverters': return n('cost_per_unit') || 0
      case 'optimisers': case 'pfc': case 'harm_filtering': return n('price_per_unit') || 0
      case 'racking': return n('cost_per_panel') || 0
      case 'additional_racking': return n('cost_per_item') || 0
      case 'inverter_station': return n('inverter_station_cost_per_unit') || 0
      case 'pvdb': case 'bessdb': return n('full_export_price') || 0
      case 'netnada': case 'netnada_addons': case 'safety': case 'monitoring_warranty': case 'monitoring_addons': case 'install': return n('price') || 0
      case 'battery_inverter': return n('pcs_price_excl_gst') || 0
      case 'ac_cabling': return n('4c_plus_earth_price_per_meter') || 0
      case 'dc_cabling': return n('price_per_type') || 0
      case 'dc_twin_cabling': return n('twin_dc_cable_price_per_mm') || 0
      case 'ac_combiner': return n('ac_combiner_price_per_unit') || 0
      case 'cabling_addons': return n('cost_per_meter') || 0
      case 'switch_gear': return n('total_price') || 0
      case 'ac_breaker': return n('price_per_breaker') || 0
      case 'lifting': return (n('cost_per_time') || 0) * Math.max(n('number_of_lifts') || 1, 1) * Math.max(n('establishments') || 1, 1)
      case 'travel_accoms_freight': return (n('travel') || 0) + (n('accom') || 0) + (n('freight') || 0)
      case 'prelim_general': case 'witness_injection': return n('price_total') || 0
      case 'grid_connection': return (n('total_network_fee') || 0) + (n('additional_cost') || 0) + (n('hv_site_variation') || 0) + (n('full_export_variation') || 0) + (n('preliminary_enquiry') || 0)
      default: return item.base_price
    }
  }

  function renderFields() {
    switch (category) {
      case 'prelim_general':
        return <div className="grid grid-cols-2 gap-4"><Input label="Item Type" value={fv('item_type')} onChange={sf('item_type')} placeholder="e.g. Surveying" /><Input label="Price Total ($)" type="number" step="0.01" value={fv('price_total')} onChange={sf('price_total')} prefix="$" /></div>
      case 'grid_connection':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Input label="DNSP" value={fv('dnsp')} onChange={sf('dnsp')} />
              <Input label="State" value={fv('state')} onChange={sf('state')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Low Size (kVA)" type="number" value={fv('low_size_kva')} onChange={sf('low_size_kva')} suffix="kVA" />
              <Input label="High Side (kVA)" type="number" value={fv('high_side_kva')} onChange={sf('high_side_kva')} suffix="kVA" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="App Fee / Tech Assessment ($)" type="number" step="0.01" value={fv('app_fee_tech_assessment')} onChange={sf('app_fee_tech_assessment')} prefix="$" />
              <Input label="Total Network Fee ($)" type="number" step="0.01" value={fv('total_network_fee')} onChange={sf('total_network_fee')} prefix="$" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Additional Cost ($)" type="number" step="0.01" value={fv('additional_cost')} onChange={sf('additional_cost')} prefix="$" />
              <Input label="HV Site Variation ($)" type="number" step="0.01" value={fv('hv_site_variation')} onChange={sf('hv_site_variation')} prefix="$" />
              <Input label="Full Export Variation ($)" type="number" step="0.01" value={fv('full_export_variation')} onChange={sf('full_export_variation')} prefix="$" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Preliminary Enquiry ($)" type="number" step="0.01" value={fv('preliminary_enquiry')} onChange={sf('preliminary_enquiry')} prefix="$" />
              <div className="flex items-center pt-6">
                {cb('Project Needed', fb('is_project_needed'), sfb('is_project_needed'))}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 py-2">
              {cb('BESS Only', fb('is_bess_only'), sfb('is_bess_only'))}
              {cb('Solar or Solar+BESS', fb('is_solar_or_solar_bess'), sfb('is_solar_or_solar_bess'))}
            </div>
            <Input label="Notes" value={fv('notes')} onChange={sf('notes')} />
          </>
        )
      case 'witness_injection':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Input label="DNSP" value={fv('dnsp')} onChange={sf('dnsp')} />
              <Input label="Required Over (kVA)" type="number" value={fv('required_over_kva')} onChange={sf('required_over_kva')} suffix="kVA" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Price Total ($)" type="number" step="0.01" value={fv('price_total')} onChange={sf('price_total')} prefix="$" />
              <Input label="Solar / Solar+BESS Price ($)" type="number" step="0.01" value={fv('solar_solar_bess_price')} onChange={sf('solar_solar_bess_price')} prefix="$" />
              <Input label="BESS Only Price ($)" type="number" step="0.01" value={fv('bess_only_price')} onChange={sf('bess_only_price')} prefix="$" />
            </div>
          </>
        )
      case 'grid_protection':
        return <><div className="grid grid-cols-2 gap-4"><Input label="DNSP" value={fv('dnsp')} onChange={sf('dnsp')} /><Input label="Required Over (kVA)" type="number" value={fv('required_over_kva')} onChange={sf('required_over_kva')} suffix="kVA" /></div>{cb('Export limit enforced', fb('is_export_limit_enforced'), sfb('is_export_limit_enforced'))}</>
      case 'panels':
        return <><div className="grid grid-cols-2 gap-4"><Input label="Brand" value={fv('brand')} onChange={sf('brand')} /><Input label="Datasheet Code" value={fv('datasheet_code')} onChange={sf('datasheet_code')} /></div><div className="grid grid-cols-2 gap-4"><Input label="Wattage (W)" type="number" value={fv('wattage')} onChange={sf('wattage')} suffix="W" /><Input label="Cost/W ($)" type="number" step="0.001" value={fv('cost_per_watt')} onChange={sf('cost_per_watt')} prefix="$" /></div><div className="grid grid-cols-2 gap-4"><Input label="Product Warranty (yrs)" type="number" value={fv('product_warranty')} onChange={sf('product_warranty')} /><Input label="Performance Warranty (yrs)" type="number" value={fv('performance_warranty')} onChange={sf('performance_warranty')} /></div>{cb('Local stock', fb('is_local_stock'), sfb('is_local_stock'))}<Input label="Notes" value={fv('notes')} onChange={sf('notes')} /></>
      case 'inverters':
        return <><div className="grid grid-cols-2 gap-4"><Input label="Brand" value={fv('brand')} onChange={sf('brand')} /><Input label="Model" value={fv('model')} onChange={sf('model')} /></div><div className="grid grid-cols-3 gap-4"><Input label="Power (W)" type="number" value={fv('watt')} onChange={sf('watt')} suffix="W" /><Input label="Cost/Unit ($)" type="number" step="0.01" value={fv('cost_per_unit')} onChange={sf('cost_per_unit')} prefix="$" /><Input label="Warranty (yrs)" type="number" value={fv('warranty_years')} onChange={sf('warranty_years')} /></div></>
      case 'optimisers':
        return <div className="grid grid-cols-3 gap-4"><Input label="Optimiser Name" value={fv('optimiser_name')} onChange={sf('optimiser_name')} /><Input label="Size (VA)" type="number" value={fv('size_va')} onChange={sf('size_va')} suffix="VA" /><Input label="Price/Unit ($)" type="number" step="0.01" value={fv('price_per_unit')} onChange={sf('price_per_unit')} prefix="$" /></div>
      case 'racking':
        return <div className="grid grid-cols-3 gap-4"><Input label="Racking Type" value={fv('racking_type')} onChange={sf('racking_type')} /><Input label="Cost/Panel ($)" type="number" step="0.01" value={fv('cost_per_panel')} onChange={sf('cost_per_panel')} prefix="$" /><Input label="Cost/W ($)" type="number" step="0.001" value={fv('cost_per_watt')} onChange={sf('cost_per_watt')} prefix="$" /></div>
      case 'additional_racking':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Item Name" value={fv('item_name') || item.name} onChange={sf('item_name')} />
              <Input label="Unit" value={fv('unit')} onChange={sf('unit')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Cost/Item ($)" type="number" step="0.01" value={fv('cost_per_item')} onChange={sf('cost_per_item')} prefix="$" />
              <Input label="Cost/W ($)" type="number" step="0.001" value={fv('cost_per_watt')} onChange={sf('cost_per_watt')} prefix="$" />
              <Input label="Total Added Price ($)" type="number" step="0.01" value={fv('total_added_price')} onChange={sf('total_added_price')} prefix="$" />
            </div>
          </>
        )
      case 'inverter_station':
        return <div className="grid grid-cols-2 gap-4"><Input label="Station Description" value={fv('inverter_station')} onChange={sf('inverter_station')} /><Input label="Cost/Unit ($)" type="number" step="0.01" value={fv('inverter_station_cost_per_unit')} onChange={sf('inverter_station_cost_per_unit')} prefix="$" /></div>
      case 'pvdb':
        return <div className="grid grid-cols-3 gap-4"><Input label="PVDB Type" value={fv('pvdb_type')} onChange={sf('pvdb_type')} /><Input label="Export Limited Price ($)" type="number" step="0.01" value={fv('export_limited_price')} onChange={sf('export_limited_price')} prefix="$" /><Input label="Full Export Price ($)" type="number" step="0.01" value={fv('full_export_price')} onChange={sf('full_export_price')} prefix="$" /></div>
      case 'pfc':
        return <div className="grid grid-cols-2 gap-4"><Input label="PFC Type" value={fv('pfc_type')} onChange={sf('pfc_type')} /><Input label="Price/Unit ($)" type="number" step="0.01" value={fv('price_per_unit')} onChange={sf('price_per_unit')} prefix="$" /></div>
      case 'netnada':
        return <div className="grid grid-cols-3 gap-4"><Input label="Plan Type" value={fv('plan_type')} onChange={sf('plan_type')} /><Input label="Payment Plan" value={fv('payment_plan')} onChange={sf('payment_plan')} /><Input label="Price ($)" type="number" step="0.01" value={fv('price')} onChange={sf('price')} prefix="$" /></div>
      case 'netnada_addons':
        return <div className="grid grid-cols-2 gap-4"><Input label="Payment Plan" value={fv('payment_plan')} onChange={sf('payment_plan')} /><Input label="Price ($)" type="number" step="0.01" value={fv('price')} onChange={sf('price')} prefix="$" /></div>
      case 'harm_filtering':
        return <div className="grid grid-cols-2 gap-4"><Input label="Filter Type (item_type)" value={fv('item_type')} onChange={sf('item_type')} /><Input label="Price/Unit ($)" type="number" step="0.01" value={fv('price_per_unit')} onChange={sf('price_per_unit')} prefix="$" /></div>
      case 'batteries':
        return <><div className="grid grid-cols-2 gap-4"><Input label="Brand" value={fv('brand')} onChange={sf('brand')} /><Input label="Suggested PCS" value={fv('suggested_pcs')} onChange={sf('suggested_pcs')} /></div><div className="grid grid-cols-2 gap-4"><Input label="PCS Table Ref" value={fv('pcs_table_ref')} onChange={sf('pcs_table_ref')} /><Input label="Cost/kWh inc. PCS ($)" type="number" step="0.01" value={fv('cost_per_kwh_inc_pcs')} onChange={sf('cost_per_kwh_inc_pcs')} prefix="$" /></div><div className="grid grid-cols-2 gap-4"><Input label="Nominal kWh" type="number" step="0.1" value={fv('nominal_kwh')} onChange={sf('nominal_kwh')} suffix="kWh" /><Input label="Battery Price FOB (Ex.GST)" type="number" step="0.01" value={fv('battery_price_fob')} onChange={sf('battery_price_fob')} prefix="$" /></div><div className="grid grid-cols-2 gap-4"><Input label="Product Warranty (yrs)" type="number" value={fv('product_warranty')} onChange={sf('product_warranty')} /><Input label="Performance Warranty (yrs)" type="number" value={fv('performance_warranty')} onChange={sf('performance_warranty')} /></div><div className="flex flex-wrap gap-x-6 gap-y-2 py-2">{cb('PCS Included', fb('is_pcs_included'), sfb('is_pcs_included'))}{cb('SmartStack Compatible', fb('is_smartstack_compatible'), sfb('is_smartstack_compatible'))}</div><Input label="Notes" value={fv('notes')} onChange={sf('notes')} /></>
      case 'battery_inverter':
        return <><div className="grid grid-cols-2 gap-4"><Input label="Brand" value={fv('brand')} onChange={sf('brand')} /><Input label="kVA" type="number" step="0.1" value={fv('kva')} onChange={sf('kva')} suffix="kVA" /></div><Input label="PCS Price excl. GST ($)" type="number" step="0.01" value={fv('pcs_price_excl_gst')} onChange={sf('pcs_price_excl_gst')} prefix="$" /><Input label="Notes" value={fv('notes')} onChange={sf('notes')} /></>
      case 'bessdb':
        return <div className="grid grid-cols-3 gap-4"><Input label="BESSDB Type" value={fv('bessdb_type')} onChange={sf('bessdb_type')} /><Input label="Export Limited Price ($)" type="number" step="0.01" value={fv('export_limited_price')} onChange={sf('export_limited_price')} prefix="$" /><Input label="Full Export Price ($)" type="number" step="0.01" value={fv('full_export_price')} onChange={sf('full_export_price')} prefix="$" /></div>
      case 'ac_cabling':
        return <><div className="grid grid-cols-3 gap-4"><Input label="Single Core Price/m ($)" type="number" step="0.01" value={fv('single_core_price_per_meter')} onChange={sf('single_core_price_per_meter')} prefix="$" /><Input label="Size (mm²)" type="number" step="0.1" value={fv('size_mm2')} onChange={sf('size_mm2')} suffix="mm²" /><Input label="Conductor Material" value={fv('conductor_material')} onChange={sf('conductor_material')} /></div><div className="grid grid-cols-2 gap-4"><Input label="4C+E Price/m ($)" type="number" step="0.01" value={fv('4c_plus_earth_price_per_meter')} onChange={sf('4c_plus_earth_price_per_meter')} prefix="$" /><Input label="Inclusion" value={fv('inclusion')} onChange={sf('inclusion')} /></div><Input label="Notes" value={fv('notes')} onChange={sf('notes')} /></>
      case 'ac_combiner':
        return <><div className="grid grid-cols-2 gap-4"><Input label="AC Combiner Name" value={fv('ac_combiner_name')} onChange={sf('ac_combiner_name')} /><Input label="Combiner Price ($)" type="number" step="0.01" value={fv('ac_combiner_price_per_unit')} onChange={sf('ac_combiner_price_per_unit')} prefix="$" /></div><Input label="Notes" value={fv('notes')} onChange={sf('notes')} /></>
      case 'dc_combiner':
        return <><div className="grid grid-cols-2 gap-4"><Input label="DC Combiner Name" value={fv('dc_combiner_name')} onChange={sf('dc_combiner_name')} /><Input label="Combiner Price/Unit ($)" type="number" step="0.01" value={fv('dc_combiner_price_per_unit')} onChange={sf('dc_combiner_price_per_unit')} prefix="$" /></div><Input label="Notes" value={fv('notes')} onChange={sf('notes')} /></>
      case 'dc_cabling':
        return <><div className="grid grid-cols-3 gap-4"><Input label="Single Core Price/m ($)" type="number" step="0.01" value={fv('single_core_price_per_meter')} onChange={sf('single_core_price_per_meter')} prefix="$" /><Input label="Size (mm²)" type="number" step="0.1" value={fv('size_mm2')} onChange={sf('size_mm2')} suffix="mm²" /><Input label="Conductor Material" value={fv('conductor_material')} onChange={sf('conductor_material')} /></div><div className="grid grid-cols-2 gap-4"><Input label="4C+E Price/m ($)" type="number" step="0.01" value={fv('4c_plus_earth_price_per_meter')} onChange={sf('4c_plus_earth_price_per_meter')} prefix="$" /><Input label="Inclusion" value={fv('inclusion')} onChange={sf('inclusion')} /></div><Input label="Notes" value={fv('notes')} onChange={sf('notes')} /></>
      case 'dc_twin_cabling':
        return <><div className="grid grid-cols-2 gap-4"><Input label="Twin DC Cable Size (mm)" type="number" step="0.1" value={fv('size_twin_dc_cable_mm')} onChange={sf('size_twin_dc_cable_mm')} suffix="mm" /><Input label="Twin DC Cable Price/mm ($)" type="number" step="0.001" value={fv('twin_dc_cable_price_per_mm')} onChange={sf('twin_dc_cable_price_per_mm')} prefix="$" /></div><Input label="Notes" value={fv('notes')} onChange={sf('notes')} /></>
      case 'cabling_addons':
        return <div className="grid grid-cols-2 gap-4"><Input label="Addon Type" value={fv('addon_type')} onChange={sf('addon_type')} /><Input label="Cost/Metre ($)" type="number" step="0.01" value={fv('cost_per_meter')} onChange={sf('cost_per_meter')} prefix="$" /></div>
      case 'switch_gear':
        return <div className="grid grid-cols-2 gap-4"><Input label="Item Type" value={fv('item_type')} onChange={sf('item_type')} /><Input label="Total Price ($)" type="number" step="0.01" value={fv('total_price')} onChange={sf('total_price')} prefix="$" /></div>
      case 'ac_breaker':
        return <><div className="grid grid-cols-3 gap-4"><Input label="Breaker Type" value={fv('breaker_type')} onChange={sf('breaker_type')} /><Input label="Rating (A)" type="number" value={fv('rating_a')} onChange={sf('rating_a')} suffix="A" /><Input label="Price/Breaker ($)" type="number" step="0.01" value={fv('price_per_breaker')} onChange={sf('price_per_breaker')} prefix="$" /></div>{cb('Projects Needed', fb('is_projects_needed'), sfb('is_projects_needed'))}</>
      case 'install':
        return <div className="grid grid-cols-2 gap-4"><Input label="Install Item" value={fv('install_item')} onChange={sf('install_item')} /><Input label="Item Type" value={fv('item_type')} onChange={sf('item_type')} /><Input label="Price ($)" type="number" step="0.01" value={fv('price')} onChange={sf('price')} prefix="$" /><Input label="Unit" value={fv('unit')} onChange={sf('unit')} /></div>
      case 'lifting':
        return <><div className="grid grid-cols-2 gap-4"><Input label="Lifting Type" value={fv('lifting_type')} onChange={sf('lifting_type')} /><Input label="Unit of Time" value={fv('unit')} onChange={sf('unit')} /></div><div className="grid grid-cols-3 gap-4"><Input label="Cost/Time ($)" type="number" step="0.01" value={fv('cost_per_time')} onChange={sf('cost_per_time')} prefix="$" /><Input label="Time" type="number" step="0.5" value={fv('time')} onChange={sf('time')} /><Input label="Set Up Est. Price ($)" type="number" step="0.01" value={fv('set_up_est_price')} onChange={sf('set_up_est_price')} prefix="$" /></div><div className="grid grid-cols-3 gap-4"><Input label="# Lifts" type="number" value={fv('number_of_lifts')} onChange={sf('number_of_lifts')} /><Input label="Establishments" type="number" value={fv('establishments')} onChange={sf('establishments')} /><Input label="Total Cost ($)" type="number" step="0.01" value={fv('total_cost')} onChange={sf('total_cost')} prefix="$" /></div>{cb('Battery Install', fb('is_battery_install'), sfb('is_battery_install'))}</>
      case 'travel_accoms_freight':
        return <><div className="grid grid-cols-3 gap-4"><Input label="Travel ($)" type="number" step="0.01" value={fv('travel')} onChange={sf('travel')} prefix="$" /><Input label="Accom ($)" type="number" step="0.01" value={fv('accom')} onChange={sf('accom')} prefix="$" /><Input label="Freight ($)" type="number" step="0.01" value={fv('freight')} onChange={sf('freight')} prefix="$" /></div><div className="grid grid-cols-3 gap-4"><Input label="Distance from City (km)" type="number" value={fv('distance_frm_city_center')} onChange={sf('distance_frm_city_center')} suffix="km" /><Input label="Travel Rates" value={fv('travel_rates')} onChange={sf('travel_rates')} /><Input label="Total ($)" type="number" step="0.01" value={fv('total')} onChange={sf('total')} prefix="$" /></div></>
      case 'safety': case 'monitoring_warranty': case 'monitoring_addons':
        return <div className="grid grid-cols-2 gap-4"><Input label="Item Type" value={fv('item_type')} onChange={sf('item_type')} /><Input label="Unit" value={fv('unit')} onChange={sf('unit')} /><Input label="Price ($)" type="number" step="0.01" value={fv('price')} onChange={sf('price')} prefix="$" /></div>
      default: return null
    }
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()} title={`Edit: ${item.name}`} size="xl">
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {NEEDS_NAME.includes(category) && (
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Input label="Name" value={name} onChange={e => setName(e.target.value)} /></div>
            <div>
              <p className="text-xs text-slate-500 font-mono mb-1.5">Code</p>
              <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400 font-mono">{item.code}</div>
            </div>
          </div>
        )}
        {!NEEDS_NAME.includes(category) && (
          <div className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
            <div>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Internal Reference</p>
              <p className="text-sm text-slate-200 font-medium">{item.code}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mb-1">Category</p>
              <p className="text-sm text-brand-400 font-semibold">{catObj.label}</p>
            </div>
          </div>
        )}
        <div className="space-y-4">{renderFields()}</div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={() => onSave({ name, base_price: getBasePrice() }, { item_id: item.id, item_code: item.code, item_name: name, category: catObj.dbCategory, item_type: catObj.dbType }, buildSpecData(), catObj.specTable)}>
            Save Changes
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
