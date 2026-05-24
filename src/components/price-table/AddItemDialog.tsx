import { useState, useEffect } from 'react'
import Dialog from '../ui/Dialog'
import Input from '../ui/Input'
import Button from '../ui/Button'
import Select from '../ui/Select'
import { useToast } from '../ui/Toast'
import { supabase } from '../../lib/supabase'
import { CATALOG_CATEGORY_OPTIONS, PREFIX_MAP } from '../../lib/constants'

interface Props {
  versionId: string
  onClose: () => void
  onCreate: (item: any) => void
  creating?: boolean
}

function cb(label: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-400">
      <input type="checkbox" checked={checked} onChange={onChange} className="rounded border-slate-700 bg-slate-800 text-brand-500" />
      {label}
    </label>
  )
}

export default function AddItemDialog({ versionId, onClose, onCreate }: Props) {
  const { addToast } = useToast()
  const [category, setCategory] = useState('panels')
  const [saving, setSaving] = useState(false)
  const [itemCode, setItemCode] = useState('')
  const [itemName, setItemName] = useState('')
  const [fields, setFields] = useState<Record<string, any>>({})

  const catObj = CATALOG_CATEGORY_OPTIONS.find(c => c.value === category)!

  // Only show the free-text Name field for spec tables that actually have an item_name or name column
  const NEEDS_NAME = ['panels', 'additional_racking', 'batteries', 'battery_inverter', 'cabling_addons', 'monitoring_addons', 'monitoring_warranty', 'netnada_addons', 'prelim_general', 'safety', 'switch_gear', 'ac_breaker', 'lifting']

  useEffect(() => {
    async function generateCode() {
      const prefix = PREFIX_MAP[category] || 'XX'
      try {
        const { data: catData, error: catErr } = await supabase
          .from('catalog_items')
          .select('item_code')
          .ilike('item_code', `${prefix}-%`)
          .order('item_code', { ascending: false })
          .limit(1)

        if (catErr) throw catErr

        let maxNum = 0
        if (catData && catData.length > 0 && catData[0].item_code) {
          const match = catData[0].item_code.match(new RegExp(`${prefix}-.*?(\\d+)`, 'i'))
          if (match && match[1]) {
            maxNum = parseInt(match[1], 10)
          }
        }

        const { data: vRow } = await supabase
          .from('audit_log')
          .select('new_data')
          .eq('audit_id', versionId)
          .single()

        if (vRow) {
          const nd = vRow.new_data as any
          const stagedItems: any[] = nd?.items ?? []
          for (const entry of stagedItems) {
            const code = entry.catalog_data?.item_code
            if (code && typeof code === 'string' && code.toUpperCase().startsWith(`${prefix.toUpperCase()}-`)) {
              const match = code.match(new RegExp(`${prefix}-.*?(\\d+)`, 'i'))
              if (match && match[1]) {
                const num = parseInt(match[1], 10)
                if (num > maxNum) maxNum = num
              }
            }
          }
        }

        setItemCode(`${prefix}-${(maxNum + 1).toString().padStart(3, '0')}`)
      } catch (err) {
        console.error('Failed to generate item code', err)
        setItemCode(`${prefix}-001`)
      }
    }
    generateCode()
  }, [category, versionId])

  const sf = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setFields(p => ({ ...p, [k]: e.target.value }))
  const sfb = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(p => ({ ...p, [k]: e.target.checked }))
  const fv = (k: string) => { const v = fields[k]; return v === null || v === undefined ? '' : String(v) }
  const fb = (k: string) => Boolean(fields[k])
  const n = (k: string) => parseFloat(fv(k)) || null

  const handleSave = async () => {
    if (!itemCode.trim()) { addToast('error', 'Item Code is required'); return }

    setSaving(true)
    try {
      const itemId = crypto.randomUUID()
      let nameToUse = itemName.trim()
      if (!nameToUse) {
        if (category === 'grid_protection') {
          nameToUse = `GPU Threshold: ${fv('dnsp') || 'General'}`
        } else {
          nameToUse = `${fv('brand')} ${itemCode}`.trim()
        }
      }

      const catalogData = {
        item_id: itemId,
        item_code: itemCode.trim(),
        item_name: nameToUse,
        category: catObj.dbCategory,
        item_type: catObj.dbType,
      }

      const baseSpec = { item_id: itemId, item_code: itemCode.trim() }
      let specData: Record<string, unknown> = { ...baseSpec }

      switch (category) {
        case 'prelim_general': specData = { ...baseSpec, item_name: nameToUse, item_type: fv('item_type'), price_total: n('price_total') }; break;
        case 'grid_connection': specData = {
          ...baseSpec,
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
        }; break;
        case 'witness_injection': specData = { ...baseSpec, dnsp: fv('dnsp'), required_over_kva: n('required_over_kva'), price_total: n('price_total'), solar_solar_bess_price: n('solar_solar_bess_price'), bess_only_price: n('bess_only_price') }; break;
        case 'grid_protection': specData = { ...baseSpec, dnsp: fv('dnsp'), required_over_kva: n('required_over_kva'), is_export_limit_enforced: fb('is_export_limit_enforced') }; break;
        case 'panels': specData = { ...baseSpec, item_name: nameToUse, brand: fv('brand'), wattage: n('wattage'), cost_per_watt: n('cost_per_watt'), item_type: 'Panel', product_warranty: n('product_warranty'), performance_warranty: n('performance_warranty'), is_local_stock: fb('is_local_stock'), datasheet_code: fv('datasheet_code'), notes: fv('notes') || null }; break;
        case 'inverters': specData = { ...baseSpec, brand: fv('brand'), model: fv('model'), watt: n('watt'), cost_per_unit: n('cost_per_unit'), warranty_years: n('warranty_years') }; break;
        case 'optimisers': specData = { ...baseSpec, optimiser_name: fv('optimiser_name'), size_va: n('size_va'), price_per_unit: n('price_per_unit') }; break;
        case 'racking': specData = { ...baseSpec, racking_type: fv('racking_type'), cost_per_panel: n('cost_per_panel'), cost_per_watt: n('cost_per_watt') }; break;
        case 'additional_racking': specData = { ...baseSpec, item_name: nameToUse, total_added_price: n('total_added_price'), cost_per_watt: n('cost_per_watt'), cost_per_item: n('cost_per_item'), unit: fv('unit') || 'ea' }; break;
        case 'inverter_station': specData = { ...baseSpec, inverter_station: fv('inverter_station'), inverter_station_cost_per_unit: n('inverter_station_cost_per_unit') }; break;
        case 'pvdb': specData = { ...baseSpec, pvdb_type: fv('pvdb_type'), export_limited_price: n('export_limited_price'), full_export_price: n('full_export_price') }; break;
        case 'pfc': specData = { ...baseSpec, pfc_type: fv('pfc_type'), price_per_unit: n('price_per_unit') }; break;
        case 'netnada': specData = { ...baseSpec, plan_type: fv('plan_type'), price: n('price'), payment_plan: fv('payment_plan') }; break;
        case 'netnada_addons': specData = { ...baseSpec, item_name: nameToUse, price: n('price'), payment_plan: fv('payment_plan') }; break;
        case 'harm_filtering': specData = { ...baseSpec, item_type: fv('item_type'), price_per_unit: n('price_per_unit') }; break;
        case 'batteries': specData = { ...baseSpec, item_name: nameToUse, brand: fv('brand'), nominal_kwh: n('nominal_kwh'), battery_price_fob: n('battery_price_fob'), product_warranty: n('product_warranty'), performance_warranty: n('performance_warranty'), is_pcs_included: fb('is_pcs_included'), pcs_table_ref: fv('pcs_table_ref') || null, suggested_pcs: fv('suggested_pcs') || null, cost_per_kwh_inc_pcs: n('cost_per_kwh_inc_pcs'), notes: fv('notes') || null, is_smartstack_compatible: fb('is_smartstack_compatible') }; break;
        case 'battery_inverter': specData = { ...baseSpec, item_name: nameToUse, brand: fv('brand'), kva: n('kva'), pcs_price_excl_gst: n('pcs_price_excl_gst'), notes: fv('notes') || null }; break;
        case 'bessdb': specData = { ...baseSpec, bessdb_type: fv('bessdb_type'), export_limited_price: n('export_limited_price'), full_export_price: n('full_export_price') }; break;
        case 'ac_cabling': specData = { ...baseSpec, conductor_material: fv('conductor_material') || null, single_core_price_per_meter: n('single_core_price_per_meter'), size_mm2: n('size_mm2'), '4c_plus_earth_price_per_meter': n('4c_plus_earth_price_per_meter'), inclusion: fv('inclusion') || null, notes: fv('notes') || null }; break;
        case 'ac_combiner': specData = { ...baseSpec, ac_combiner_name: fv('ac_combiner_name') || null, ac_combiner_price_per_unit: n('ac_combiner_price_per_unit'), notes: fv('notes') || null }; break;
        case 'dc_combiner': specData = { ...baseSpec, dc_combiner_name: fv('dc_combiner_name') || null, dc_combiner_price_per_unit: n('dc_combiner_price_per_unit'), notes: fv('notes') || null }; break;
        case 'dc_twin_cabling': specData = { ...baseSpec, size_twin_dc_cable_mm: n('size_twin_dc_cable_mm'), twin_dc_cable_price_per_mm: n('twin_dc_cable_price_per_mm'), notes: fv('notes') || null }; break;
        case 'cabling_addons': specData = { ...baseSpec, addon_type: fv('addon_type') || null, item_name: nameToUse, cost_per_meter: n('cost_per_meter') }; break;
        case 'switch_gear': specData = { ...baseSpec, item_name: nameToUse, item_type: fv('item_type') || null, total_price: n('total_price') }; break;
        case 'ac_breaker': specData = { ...baseSpec, name: nameToUse, breaker_type: fv('breaker_type') || null, rating_a: n('rating_a'), price_per_breaker: n('price_per_breaker'), is_projects_needed: fb('is_projects_needed') }; break;
        case 'install': specData = { ...baseSpec, install_item: fv('install_item') || null, item_type: fv('item_type') || null, price: n('price'), unit: fv('unit') || 'ea' }; break;
        case 'lifting': specData = { ...baseSpec, name: nameToUse, lifting_type: fv('lifting_type') || null, total_cost: n('total_cost'), set_up_est_price: n('set_up_est_price'), cost_per_time: n('cost_per_time'), time: n('time'), unit: fv('unit') || 'ea', number_of_lifts: n('number_of_lifts'), establishments: n('establishments'), is_battery_install: fb('is_battery_install') }; break;
        case 'travel_accoms_freight': specData = { ...baseSpec, travel_rates: fv('travel_rates') || null, distance_frm_city_center: n('distance_frm_city_center'), travel: n('travel'), accom: n('accom'), freight: n('freight'), total: n('total') }; break;
        case 'safety': specData = { ...baseSpec, item_name: nameToUse, item_type: fv('item_type') || null, price: n('price'), unit: fv('unit') || 'ea' }; break;
        case 'monitoring_warranty': specData = { ...baseSpec, item_name: nameToUse, item_type: fv('item_type') || null, price: n('price'), unit: fv('unit') || 'ea' }; break;
        case 'monitoring_addons': specData = { ...baseSpec, item_name: nameToUse, item_type: fv('item_type') || null, price: n('price'), unit: fv('unit') || 'ea' }; break;
      }

      const { data: vRow, error: fetchErr } = await supabase
        .from('audit_log')
        .select('new_data')
        .eq('audit_id', versionId)
        .single()
      if (fetchErr) throw fetchErr

      const nd = (vRow.new_data as any) ?? { items: [] }
      const items: any[] = nd.items ?? []
      items.push({
        change_id: crypto.randomUUID(),
        action: 'ADD',
        catalog_data: catalogData,
        spec_data: specData,
        table_name: catObj.specTable,
      })

      const { error: updateErr } = await supabase
        .from('audit_log')
        .update({ new_data: { ...nd, items } })
        .eq('audit_id', versionId)
      if (updateErr) throw updateErr

      addToast('success', `${nameToUse} staged for this version.`)
      onCreate({})
    } catch (err: any) {
      addToast('error', err?.message ?? 'Failed to save item')
      console.error(err)
    } finally {
      setSaving(false)
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
        return <div className="grid grid-cols-2 gap-4"><Input label="Item Name" value={fv('item_name') || itemName} onChange={sf('item_name')} /><Input label="Unit" value={fv('unit')} onChange={sf('unit')} /><Input label="Cost/Item ($)" type="number" step="0.01" value={fv('cost_per_item')} onChange={sf('cost_per_item')} prefix="$" /><Input label="Cost/W ($)" type="number" step="0.001" value={fv('cost_per_watt')} onChange={sf('cost_per_watt')} prefix="$" /><Input label="Total Added Price ($)" type="number" step="0.01" value={fv('total_added_price')} onChange={sf('total_added_price')} prefix="$" /></div>
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
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Add Catalog Item" description="Add a new item to the catalog. All changes are recorded in the audit log." size="xl">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={CATALOG_CATEGORY_OPTIONS.map(c => ({ value: c.value, label: c.label }))} />
          <Input label="Item Code (Auto-generated) *" value={itemCode} readOnly className="bg-slate-800/50 text-slate-400 cursor-not-allowed" />
        </div>
        {NEEDS_NAME.includes(category) && (
          <Input label="Item Name / Description" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Full product name" />
        )}

        <div className="space-y-4">{renderFields()}</div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSave} disabled={!itemCode.trim()}>Add Item</Button>
        </div>
      </div>
    </Dialog>
  )
}
