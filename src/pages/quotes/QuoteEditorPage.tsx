import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { useQuoteEditorStore } from '../../stores/quoteEditorStore'
import { usePriceItems } from '../../hooks/usePriceItems'
import { usePriceVersions } from '../../hooks/usePriceVersions'
import { useSaveQuote, useQuote } from '../../hooks/useQuotes'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import type { InclusionStatus, QuoteLineItemState, ItemCategory, ComputedLineItem } from '../../types/domain.types'
import { type QuoteInputs, type CategorySubtotal, type QuoteResult, type LineItem } from '../../lib/quoteEngine'
import { saveQuoteData, updateQuoteData, getQuoteById } from '../../lib/quoteDbService'
import { AUSTRALIAN_STATES, STC_ZONE_FACTORS } from '../../lib/constants'
import { usePriceItemOptions } from '../../hooks/usePriceItemOptions'
import { useComputedLineItems, useQuoteTotals } from '../../hooks/useComputedLineItems'
import { useDNSPRules } from '../../hooks/useDNSPRules'
import { extractNMIPrefix, resolveDNSP, buildDNSPScope, inferStateFromDNSP } from '../../lib/dnspResolver'
import { computeLineItemTotal } from '../../lib/formulaEngine'

const EMPTY_ARRAY: any[] = []

// Category groupings for nested collapsibles
const CATEGORY_STRUCTURE = [
  { id: 'Prelim', label: 'A. Preliminary' },
  { id: 'PV_Components', label: 'B. PV Components' },
  { id: 'BESS', label: 'C. Battery Energy Storage' },
  { id: 'Cabling', label: 'D. Cabling' },
  { id: 'Switchgear', label: 'E. Switchgear' },
  { id: 'Install', label: 'F. Installation & Logistics' },
  { id: 'Safety', label: 'G. Safety & Compliance' },
  { id: 'Monitoring', label: 'H. Monitoring & Warranty' },
  { id: 'EV', label: 'I. EV Charging' },
]

const SPEC_FIELD_MAPPINGS: Record<string, { label: string; key: string }[]> = {
  ac_breaker: [
    { label: 'Rating', key: 'rating_a' },
    { label: 'Name', key: 'name' },
    { label: 'Breaker Type', key: 'breaker_type' }
  ],
  ac_cabling: [
    { label: 'Size', key: 'size_mm2' },
    { label: 'Inclusion', key: 'inclusion' },
    { label: 'Conductor', key: 'conductor_material' }
  ],
  ac_combiner: [
    { label: 'Combiner Name', key: 'ac_combiner_name' },
    { label: 'Notes', key: 'notes' }
  ],
  additional_racking: [
    { label: 'Item Name', key: 'item_name' },
    { label: 'Unit', key: 'unit' }
  ],
  batteries: [
    { label: 'Brand', key: 'brand' },
    { label: 'Item Name', key: 'item_name' },
    { label: 'Nominal kWh', key: 'nominal_kwh' }
  ],
  battery_inverter: [
    { label: 'Brand', key: 'brand' },
    { label: 'kVA', key: 'kva' },
    { label: 'Item Name', key: 'item_name' }
  ],
  bessdb: [
    { label: 'BESSDB Type', key: 'bessdb_type' }
  ],
  cabling_addons: [
    { label: 'Item Name', key: 'item_name' },
    { label: 'Addon Type', key: 'addon_type' }
  ],
  dc_cabling: [
    { label: 'Size', key: 'size_mm2' },
    { label: 'Inclusion', key: 'inclusion' },
    { label: 'Conductor', key: 'conductor_material' }
  ],
  dc_combiner: [
    { label: 'Combiner Name', key: 'dc_combiner_name' },
    { label: 'Notes', key: 'notes' }
  ],
  dc_twin_cabling: [
    { label: 'Size', key: 'size_twin_dc_cable_mm' },
    { label: 'Notes', key: 'notes' }
  ],
  grid_protection: [
    { label: 'DNSP', key: 'dnsp' },
    { label: 'Req. Over', key: 'required_over_kva' },
    { label: 'Export Limit Enforced', key: 'is_export_limit_enforced' }
  ],
  grid_connection: [
    { label: 'DNSP', key: 'dnsp' },
    { label: 'Low Size', key: 'low_size_kva' },
    { label: 'High Size', key: 'high_side_kva' }
  ],
  harm_filtering: [
    { label: 'Item Type', key: 'item_type' }
  ],
  install: [
    { label: 'Item Type', key: 'item_type' },
    { label: 'Install Item', key: 'install_item' },
    { label: 'Unit', key: 'unit' }
  ],
  inverters: [
    { label: 'Brand', key: 'brand' },
    { label: 'Model', key: 'model' },
    { label: 'Warranty Years', key: 'warranty_years' }
  ],
  inverter_station: [
    { label: 'Station', key: 'inverter_station' }
  ],
  lifting: [
    { label: 'Name', key: 'name' },
    { label: 'Lifting Type', key: 'lifting_type' },
    { label: 'Time', key: 'time' }
  ],
  monitoring_addons: [
    { label: 'Item Type', key: 'item_type' },
    { label: 'Item Name', key: 'item_name' },
    { label: 'Unit', key: 'unit' }
  ],
  monitoring_warranty: [
    { label: 'Item Type', key: 'item_type' },
    { label: 'Item Name', key: 'item_name' },
    { label: 'Unit', key: 'unit' }
  ],
  netnada: [
    { label: 'Plan Type', key: 'plan_type' },
    { label: 'Payment Plan', key: 'payment_plan' }
  ],
  netnada_addons: [
    { label: 'Item Name', key: 'item_name' },
    { label: 'Payment Plan', key: 'payment_plan' }
  ],
  optimisers: [
    { label: 'Size VA', key: 'size_va' },
    { label: 'Optimiser Name', key: 'optimiser_name' }
  ],
  panels: [
    { label: 'Brand', key: 'brand' },
    { label: 'Item Type', key: 'item_type' },
    { label: 'Item Name', key: 'item_name' }
  ],
  pfc: [
    { label: 'PFC Type', key: 'pfc_type' }
  ],
  prelim_general: [
    { label: 'Item Type', key: 'item_type' },
    { label: 'Item Name', key: 'item_name' }
  ],
  pvdb: [
    { label: 'PVDB Type', key: 'pvdb_type' }
  ],
  racking: [
    { label: 'Racking Type', key: 'racking_type' }
  ],
  safety: [
    { label: 'Item Type', key: 'item_type' },
    { label: 'Item Name', key: 'item_name' },
    { label: 'Unit', key: 'unit' }
  ],
  switch_gear: [
    { label: 'Item Type', key: 'item_type' },
    { label: 'Item Name', key: 'item_name' }
  ],
  travel_accoms_freight: [
    { label: 'Distance', key: 'distance_frm_city_center' },
    { label: 'Rates', key: 'travel_rates' }
  ],
  witness_injection: [
    { label: 'DNSP', key: 'dnsp' },
    { label: 'Req. Over', key: 'required_over_kva' }
  ]
};

interface QuoteItemRowProps {
  computedItem: ComputedLineItem
  scope: any
  handleItemStatusChange: (instanceId: string, status: InclusionStatus) => void
  handleItemQtyChange: (instanceId: string, qty: number) => void
}

function QuoteItemRow({
  computedItem,
  scope,
  handleItemStatusChange,
  handleItemQtyChange
}: QuoteItemRowProps) {
  const [qtyStr, setQtyStr] = useState(String(computedItem.qty))
  const isIncluded = computedItem.is_included

  useEffect(() => {
    setQtyStr(String(computedItem.qty))
  }, [computedItem.qty])

  const unitRate = useMemo(() => {
    if (isIncluded && computedItem.qty > 0) {
      return computedItem.computed_total / computedItem.qty
    }
    const mockItem = { formula: computedItem.formula, base_price: computedItem.base_unit_price }
    try {
      return computeLineItemTotal(mockItem, 1, scope, { type: 'none', value: 0 })
    } catch {
      return computedItem.base_unit_price
    }
  }, [isIncluded, computedItem.qty, computedItem.computed_total, computedItem.formula, computedItem.base_unit_price, scope])

  const total = computedItem.computed_total

  const nameKeys = ['item_name', 'name', 'ac_combiner_name', 'dc_combiner_name', 'optimiser_name', 'install_item'];
  const hasNameSpec = !!(computedItem.specData && nameKeys.some(key => {
    const val = computedItem.specData?.[key];
    return val !== undefined && val !== null && val !== '';
  }));

  const isNameRedundant = computedItem.name.trim().toUpperCase() === computedItem.code.trim().toUpperCase();
  const shouldHideMainDescription = isNameRedundant || hasNameSpec;

  return (
    <div className="grid grid-cols-11 gap-2 px-4 py-2.5 hover:bg-slate-850 transition-colors text-sm">
      {/* Status */}
      <div className="col-span-2">
        <select
          value={computedItem.inclusion_status}
          onChange={(e) => handleItemStatusChange(computedItem.instance_id, e.target.value as InclusionStatus)}
          className={`w-full bg-slate-800 border rounded text-[13px] py-1 px-2.5 focus:outline-none focus:ring-1 ${isIncluded
            ? 'border-emerald-600 text-emerald-400 focus:ring-emerald-500 font-medium'
            : 'border-slate-700 text-slate-400 focus:ring-brand-500'
            }`}
        >
          <option value="not_required">Not Required</option>
          <option value="included">Included</option>
        </select>
      </div>

      {/* Code */}
      <div className="col-span-1 text-slate-400 text-[13px] font-mono truncate pt-1">{computedItem.code}</div>

      {/* Description */}
      <div className="col-span-3">
        {!shouldHideMainDescription && (
          <div className="text-white text-[13px] font-medium break-words leading-relaxed">{computedItem.name}</div>
        )}
        
        {/* Spec fields render */}
        {computedItem.specData && SPEC_FIELD_MAPPINGS[computedItem.type_value || ''] && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {SPEC_FIELD_MAPPINGS[computedItem.type_value || ''].map((field) => {
              const val = computedItem.specData?.[field.key];
              if (val === undefined || val === null || val === '') return null;
              const displayVal = typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val);
              return (
                <span key={field.key} className="bg-slate-800 border border-slate-500 px-2.5 py-0.5 rounded text-[12px] text-white whitespace-nowrap inline-flex items-center shadow-sm">
                  <span className="text-slate-400 font-semibold mr-1">{field.label}:</span> {displayVal}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Unit */}
      <div className="col-span-1 text-slate-300 text-[13px] pt-1">{computedItem.unit}</div>

      {/* Qty */}
      <div className="col-span-1">
        <input
          type="number"
          min="0"
          value={qtyStr}
          onChange={(e) => {
            const val = e.target.value;
            setQtyStr(val);
            const parsed = parseInt(val, 10);
            if (!isNaN(parsed)) {
              handleItemQtyChange(computedItem.instance_id, parsed);
            } else {
              handleItemQtyChange(computedItem.instance_id, 0);
            }
          }}
          onBlur={() => {
            if (qtyStr.trim() === '') {
              setQtyStr(String(computedItem.qty));
            }
          }}
          className="w-full bg-slate-800 border border-slate-700 rounded text-[13px] text-white py-1 px-2 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono text-right"
        />
      </div>

      {/* Rate */}
      <div className="col-span-2 text-slate-200 text-[13px] font-mono pt-1">
        ${unitRate.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>

      {/* Total */}
      <div className={`col-span-1 text-right font-semibold text-[13px] pt-1 ${isIncluded ? 'text-emerald-400' : 'text-slate-500'}`}>
        ${total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  )
}

export default function QuoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const isNew = !id || id === 'new'
  const { data: existingQuote } = useQuote(isNew ? undefined : id)

  const {
    isDirty, selectedVersionId, scope, lineItems,
    setSelectedVersion, markSaved, setQuoteId, setSiteDetails, setScope, setLineItems, setLineItemState, resetStore
  } = useQuoteEditorStore()

  const { data: versions = EMPTY_ARRAY } = usePriceVersions()
  const { data: priceItems = EMPTY_ARRAY, isLoading: itemsLoading } = usePriceItems(selectedVersionId ?? undefined)
  const saveQuote = useSaveQuote()

  // Local state for form fields
  const [clientInfo, setClientInfo] = useState({
    abn: '', primary_contact: '', direct_ph: '', email_address: '', nmi: '',
    is_off_grid: false, billing_address: '', suburb: '', postcode: '', state: '',
  })

  const [installInfo, setInstallInfo] = useState({
    total_system_size_kw: 0, funding_model: 'Capex', install_address: '', suburb: '',
    postcode: '', state: '', stcs_on_first_100kw: true,
    expected_commissioning_year: new Date().getFullYear(),
    expected_commissioning_month: 'January', existing_pv_kwp: 0, existing_pv_kva: 0,
    hv_customer: false, site_inspection_confirmed: false,
  })

  const [projectName, setProjectName] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Prelim']))
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set())

  // Loading state tracking
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)
  const [loadedDbItems, setLoadedDbItems] = useState<any[] | null>(null)
  const [hasMappedItems, setHasMappedItems] = useState(false)

  // DNSP and price option hooks
  const { data: dnspRules = EMPTY_ARRAY } = useDNSPRules()
  const priceItemIds = useMemo(() => priceItems.map((pi) => pi.id), [priceItems])
  const { data: optionData = { groups: [], options: [] } } = usePriceItemOptions(priceItemIds)

  // Dynamic formula-evaluated items & totals
  const computedItems = useComputedLineItems(priceItems, lineItems, scope, optionData)
  const totals = useQuoteTotals(computedItems)

  // Reset mapping flag when quote ID changes
  useEffect(() => {
    setLoadedDbItems(null)
    setHasMappedItems(false)
  }, [id])

  // Auto-select latest published version if not selected
  useEffect(() => {
    if (!selectedVersionId && versions.length > 0) {
      const latest = versions.find((v) => !v.is_draft)
      if (latest) setSelectedVersion(latest.id)
    }
  }, [versions, selectedVersionId, setSelectedVersion])

  // Load existing quote data from database
  useEffect(() => {
    if (isNew) {
      resetStore()
      setProjectName('')
      setClientInfo({
        abn: '', primary_contact: '', direct_ph: '', email_address: '', nmi: '',
        is_off_grid: false, billing_address: '', suburb: '', postcode: '', state: '',
      })
      setInstallInfo({
        total_system_size_kw: 0, funding_model: 'Capex', install_address: '', suburb: '',
        postcode: '', state: '', stcs_on_first_100kw: true,
        expected_commissioning_year: new Date().getFullYear(),
        expected_commissioning_month: 'January', existing_pv_kwp: 0, existing_pv_kva: 0,
        hv_customer: false, site_inspection_confirmed: false,
      })
      return
    }

    setIsLoadingQuote(true)
    getQuoteById(id).then((res) => {
      if (res.success && res.data) {
        const { quote, items } = res.data
        setQuoteId(quote.id)
        setSelectedVersion(quote.price_version_id)
        setProjectName(quote.project_name || '')

        const cInfo = quote.client_info || {}
        setClientInfo({
          abn: cInfo.abn || '',
          primary_contact: cInfo.primary_contact || '',
          direct_ph: cInfo.direct_ph || '',
          email_address: cInfo.email_address || '',
          nmi: quote.nmi || cInfo.nmi || '',
          is_off_grid: cInfo.is_off_grid || false,
          billing_address: cInfo.billing_address || '',
          suburb: cInfo.suburb || '',
          postcode: cInfo.postcode || '',
          state: cInfo.state || '',
        })

        setInstallInfo({
          total_system_size_kw: quote.system_kw || 0,
          funding_model: quote.internal_notes?.includes('PPA') ? 'PPA' : 'Capex',
          install_address: quote.site_address || '',
          suburb: quote.site_suburb || '',
          postcode: quote.site_postcode || '',
          state: quote.site_state || '',
          stcs_on_first_100kw: true,
          expected_commissioning_year: new Date().getFullYear(),
          expected_commissioning_month: 'January',
          existing_pv_kwp: quote.existing_solar_kw || 0,
          existing_pv_kva: quote.existing_solar_kw || 0,
          hv_customer: false,
          site_inspection_confirmed: false,
        })

        setLoadedDbItems(items || [])
      } else {
        addToast('error', res.error || 'Failed to load quote details')
      }
    }).finally(() => {
      setIsLoadingQuote(false)
    })
  }, [id, isNew, setQuoteId, setSelectedVersion, addToast, resetStore])

  // Map loaded database items & standard items to Zustand store's lineItems
  useEffect(() => {
    if (!isNew && loadedDbItems && priceItems.length > 0 && !hasMappedItems) {
      const mappedLineItems: QuoteLineItemState[] = []

      // Map standard items
      priceItems.forEach(item => {
        const matchingDbItems = loadedDbItems.filter((i: any) => i.catalog_id === item.id)
        if (matchingDbItems.length > 0) {
          matchingDbItems.forEach((dbItem: any, idx: number) => {
            const isPrimary = idx === 0
            const loadedStatus = dbItem.status || (dbItem.total_line_amount !== undefined && Number(dbItem.total_line_amount) !== 0 ? 'included' : 'not_required')
            mappedLineItems.push({
              instance_id: isPrimary ? item.id : (dbItem.id || crypto.randomUUID()),
              price_item_id: item.id,
              inclusion_status: loadedStatus as InclusionStatus,
              qty: dbItem.qty || 1,
              selected_options: {},
              formula_override: null,
              modifier_type: 'none',
              modifier_value: 0,
              modifier_note: '',
              sort_order: item.sort_order + (isPrimary ? 0 : idx * 0.5)
            })
          })
        } else {
          // Excluded standard item
          mappedLineItems.push({
            instance_id: item.id,
            price_item_id: item.id,
            inclusion_status: 'not_required' as InclusionStatus,
            qty: 1,
            selected_options: {},
            formula_override: null,
            modifier_type: 'none',
            modifier_value: 0,
            modifier_note: '',
            sort_order: item.sort_order
          })
        }
      })

      // Map custom items
      loadedDbItems.filter((i: any) => !i.catalog_id).forEach((dbItem: any) => {
        const loadedStatus = dbItem.status || (dbItem.total_line_amount !== undefined && Number(dbItem.total_line_amount) !== 0 ? 'included' : 'not_required')
        mappedLineItems.push({
          instance_id: dbItem.id || crypto.randomUUID(),
          price_item_id: null,
          inclusion_status: loadedStatus as InclusionStatus,
          qty: dbItem.qty || 1,
          selected_options: {},
          formula_override: null,
          modifier_type: 'none',
          modifier_value: 0,
          modifier_note: '',
          sort_order: dbItem.sort_order || 100,
          custom_category: dbItem.category as ItemCategory,
          custom_code: dbItem.item_code,
          custom_name: dbItem.item_name,
          custom_unit: dbItem.unit,
          custom_base_price: dbItem.quoted_cost || dbItem.quoted_sales_cost || 0,
          custom_formula: null
        })
      })

      setLineItems(mappedLineItems)
      setHasMappedItems(true)
    }
  }, [isNew, loadedDbItems, priceItems, hasMappedItems, setLineItems])

  // Synchronize local form inputs to Zustand store's siteDetails and scope dynamically
  useEffect(() => {
    if (isLoadingQuote) return

    const nmiPrefix = extractNMIPrefix(clientInfo.nmi)
    const resolvedDnsp = resolveDNSP(nmiPrefix, dnspRules)
    const inferredState = inferStateFromDNSP(resolvedDnsp)
    const activeState = installInfo.state || clientInfo.state || inferredState || 'NSW'

    const stcZoneFactor = STC_ZONE_FACTORS[activeState] || 1.382
    const stcYears = Math.max(0, 2031 - installInfo.expected_commissioning_year)
    const dnspScope = buildDNSPScope(resolvedDnsp, installInfo.total_system_size_kw)

    const nextScope = {
      system_kw: installInfo.total_system_size_kw,
      system_kva: installInfo.total_system_size_kw * 1.25,
      site_state: activeState,
      postcode: installInfo.postcode || clientInfo.postcode || '',
      nmi_prefix: nmiPrefix,
      existing_solar_kw: installInfo.existing_pv_kwp || 0,
      stc_zone_factor: stcZoneFactor,
      stc_years: stcYears,
      ...dnspScope,
    }

    const nextSiteDetails = {
      project_name: projectName,
      primary_contact: clientInfo.primary_contact,
      direct_ph: clientInfo.direct_ph,
      email_address: clientInfo.email_address,
      abn: clientInfo.abn,
      nmi: clientInfo.nmi,
      is_off_grid: clientInfo.is_off_grid,
      billing_address: clientInfo.billing_address,
      site_address: installInfo.install_address,
      site_suburb: installInfo.suburb,
      site_state: activeState,
      site_postcode: installInfo.postcode,
      dnsp: resolvedDnsp ? resolvedDnsp.dnsp_name : '',
    }

    const currentStore = useQuoteEditorStore.getState()

    const hasScopeChanged = Object.keys(nextScope).some(
      (key) => (currentStore.scope as any)[key] !== (nextScope as any)[key]
    )

    const hasSiteDetailsChanged = Object.keys(nextSiteDetails).some(
      (key) => (currentStore.siteDetails as any)[key] !== (nextSiteDetails as any)[key]
    )

    if (hasScopeChanged) {
      setScope(nextScope)
    }

    if (hasSiteDetailsChanged) {
      setSiteDetails(nextSiteDetails)
    }
  }, [
    projectName,
    clientInfo,
    installInfo,
    dnspRules,
    setScope,
    setSiteDetails,
    isLoadingQuote
  ])

  // Group computed items by category and subcategory dynamically
  const groupedItems = useMemo(() => {
    const groups: Record<string, Record<string, ComputedLineItem[]>> = {}
    computedItems.forEach(item => {
      const category = item.category
      const subcategory = item.subcategory || 'Other'
      if (!groups[category]) groups[category] = {}
      if (!groups[category][subcategory]) groups[category][subcategory] = []
      groups[category][subcategory].push(item)
    })
    return groups
  }, [computedItems])

  const handleItemStatusChange = useCallback((instanceId: string, status: InclusionStatus) => {
    setLineItemState(instanceId, { inclusion_status: status })
  }, [setLineItemState])

  const handleItemQtyChange = useCallback((instanceId: string, qty: number) => {
    setLineItemState(instanceId, { qty })
  }, [setLineItemState])

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }, [])

  async function handleSave() {
    if (!selectedVersionId) {
      addToast('error', 'Please select a price table version first.')
      return
    }

    try {
      const nmiPrefix = extractNMIPrefix(clientInfo.nmi)
      const resolvedDnsp = resolveDNSP(nmiPrefix, dnspRules)
      const inferredState = inferStateFromDNSP(resolvedDnsp)
      const activeState = installInfo.state || clientInfo.state || inferredState || 'NSW'

      const stcZoneFactor = STC_ZONE_FACTORS[activeState] || 1.382
      const stcYears = Math.max(0, 2031 - installInfo.expected_commissioning_year)
      const stcQty = Math.ceil(installInfo.total_system_size_kw * stcZoneFactor * stcYears)
      const stcDiscount = stcQty * 38.0

      const inputs: QuoteInputs = {
        client: {
          projectName: projectName || 'Untitled Project',
          contactName: clientInfo.primary_contact,
          email: clientInfo.email_address,
          phone: clientInfo.direct_ph,
          nmi: clientInfo.nmi,
          isOffGrid: clientInfo.is_off_grid,
          state: activeState,
          postcode: installInfo.postcode || clientInfo.postcode,
          suburb: installInfo.suburb || clientInfo.suburb,
          billingAddress: clientInfo.billing_address,
          abn: clientInfo.abn,
        },
        system: {
          totalSystemSizeKw: installInfo.total_system_size_kw,
          panelWattage: 440,
          panelQuantity: Math.ceil((installInfo.total_system_size_kw * 1000) / 440),
          inverterSizeKw: installInfo.total_system_size_kw * 1.25,
          inverterQuantity: 1,
          hasBess: scope.has_bess || false,
          bessCapacityKwh: scope.bess_kwh || 0,
          hasEv: scope.has_ev || false,
          evChargerQuantity: 0,
          isHvCustomer: installInfo.hv_customer,
          hasExistingPv: installInfo.existing_pv_kwp > 0,
          existingPvSizeKw: installInfo.existing_pv_kwp,
        },
        installation: {
          installYear: installInfo.expected_commissioning_year,
          installMonth: 1,
          siteInspectionConfirmed: installInfo.site_inspection_confirmed,
          hvCustomer: installInfo.hv_customer,
          dnsp: resolvedDnsp ? resolvedDnsp.dnsp_name : 'Ausgrid',
          isPpaOrCapex: installInfo.funding_model as 'PPA' | 'Capex',
        },
        pricing: {
          proposedMarkup: 0.25,
          targetMarkup: 0.30,
          minimumMarkup: 0.20,
          contingencyBudget: 5000,
          stcPrice: 38.0,
          veecTraderFee: 0,
        },
      }

      // Group and construct subtotals for the DB matching what's evaluated by our dynamic formulas
      const subtotals: CategorySubtotal[] = []
      const categories = Array.from(new Set(computedItems.map(i => i.category)))

      categories.forEach(cat => {
        const catItems = computedItems.filter(i => i.category === cat && i.is_included)
        if (catItems.length === 0) return

        const lineItems: LineItem[] = catItems.map(comp => {
          const totalAmount = comp.computed_total
          const rate = comp.qty > 0 ? comp.computed_total / comp.qty : 0

          return {
            category: comp.category,
            item: comp.name,
            type: comp.subcategory || comp.category,
            quantity: comp.qty,
            unitCost: comp.base_unit_price,
            totalCost: totalAmount,
            costPerWatt: totalAmount / (installInfo.total_system_size_kw * 1000 || 1),
            salesRate: rate,
            salePerWatt: totalAmount / (installInfo.total_system_size_kw * 1000 || 1),
            status: comp.inclusion_status as any,
            catalog_id: comp.price_item_id,
            item_code: comp.code,
            unit: comp.unit,
          }
        })

        const catTotalCost = lineItems.reduce((sum, li) => sum + li.totalCost, 0)

        subtotals.push({
          category: cat,
          totalCost: catTotalCost,
          totalSale: catTotalCost,
          costPerWatt: catTotalCost / (installInfo.total_system_size_kw * 1000 || 1),
          salePerWatt: catTotalCost / (installInfo.total_system_size_kw * 1000 || 1),
          items: lineItems,
        })
      })

      const quoteResult: QuoteResult = {
        quoteNumber: existingQuote?.quote_number || `Q-${Date.now()}`,
        projectName: projectName || 'Untitled Project',
        systemSizeKw: installInfo.total_system_size_kw,
        subtotals,
        totalInstallCost: totals.subtotal,
        costPerWatt: totals.subtotal / (installInfo.total_system_size_kw * 1000 || 1),
        markup: 0.25,
        salePrice: totals.subtotal,
        salePricePerWatt: totals.subtotal / (installInfo.total_system_size_kw * 1000 || 1),
        profitMargin: 0,
        grossProfitPercent: 0,
        rebates: {
          claimedStcCapacityKwp: installInfo.total_system_size_kw,
          deemingPeriodYears: stcYears,
          stcQuantity: stcQty,
          stcDiscountExGst: stcDiscount,
          veecTraderFeeExGst: 0,
          upfrontVeecDiscountExGst: 0,
          totalUpfrontRebateExGst: Math.abs(totals.rebateTotal),
        },
        totalSystemValueExGst: totals.subtotal,
        gst: totals.gst,
        totalSystemValueIncGst: totals.subtotal + totals.gst,
        netSystemValueExGst: totals.netBeforeGST,
        netSystemValueIncGst: totals.total,
        calculatedAt: new Date(),
      }

      let saveResult
      if (isNew) {
        saveResult = await saveQuoteData(inputs, quoteResult, selectedVersionId!)
      } else {
        saveResult = await updateQuoteData(id, inputs, quoteResult, 'Updated quote details and dynamic line items')
      }

      if (saveResult.success && saveResult.quoteId) {
        setQuoteId(saveResult.quoteId)
        markSaved()
        addToast('success', `Quote saved successfully.`)
        if (isNew) navigate(`/quotes/${saveResult.quoteId}`, { replace: true })
      } else {
        addToast('error', saveResult.error || 'Failed to save quote')
      }
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save quote')
    }
  }

  const publishedVersions = versions.filter((v) => !v.is_draft)

  if (isLoadingQuote) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900 shrink-0">
        <button onClick={() => navigate('/quotes')} className="text-slate-500 hover:text-white transition-colors p-1">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-white text-sm">
            {isNew ? 'New Quote' : existingQuote?.quote_number ?? 'Loading…'}
          </span>
          {projectName && <span className="text-slate-400 text-sm ml-2 truncate">— {projectName}</span>}
          {isDirty && <span className="ml-2 text-xs text-amber-400">Unsaved</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500 hidden sm:block">Price table:</span>
          <select
            value={selectedVersionId ?? ''}
            onChange={(e) => setSelectedVersion(e.target.value || null)}
            className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-white py-1.5 pl-2 pr-6 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">— Select version —</option>
            {publishedVersions.map((v) => (<option key={v.id} value={v.id}>{v.version_name}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="primary" size="sm" loading={saveQuote.isPending} icon={<Save className="w-3.5 h-3.5" />}
            onClick={handleSave} disabled={!selectedVersionId}>
            Save Quote
          </Button>
        </div>
      </div>

      {/* Main layout: Left (form) + Middle (items) + Right (summary) */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDE: Information Tab */}
        <div className="w-[300px] border-r border-slate-800 overflow-y-auto p-4 space-y-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Quote Information</h2>
            <div className="mb-6">
              <Input label="Project Name" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Enter project name" />
            </div>

            {/* Client Info Section */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-300 mb-3 uppercase tracking-wider">Client Information</h3>
              <div className="space-y-3">
                <Input label="Primary Contact" value={clientInfo.primary_contact} onChange={(e) => setClientInfo(prev => ({ ...prev, primary_contact: e.target.value }))} placeholder="Contact name" />
                <Input label="Direct Phone" value={clientInfo.direct_ph} onChange={(e) => setClientInfo(prev => ({ ...prev, direct_ph: e.target.value }))} placeholder="Phone number" />
                <Input label="Email Address" type="email" value={clientInfo.email_address} onChange={(e) => setClientInfo(prev => ({ ...prev, email_address: e.target.value }))} placeholder="email@example.com" />
                <Input label="ABN" value={clientInfo.abn} onChange={(e) => setClientInfo(prev => ({ ...prev, abn: e.target.value }))} placeholder="XX XXX XXX XXX" />
                <Input label="NMI" value={clientInfo.nmi} onChange={(e) => setClientInfo(prev => ({ ...prev, nmi: e.target.value.toUpperCase() }))} placeholder="e.g. 6123456789" />
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="is_off_grid" checked={clientInfo.is_off_grid} onChange={(e) => setClientInfo(prev => ({ ...prev, is_off_grid: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500" />
                  <label htmlFor="is_off_grid" className="text-sm text-slate-300">Off-grid installation</label>
                </div>
                <Input label="Billing Address" value={clientInfo.billing_address} onChange={(e) => setClientInfo(prev => ({ ...prev, billing_address: e.target.value }))} placeholder="Street address" />
                <div className="grid grid-cols-3 gap-3">
                  <Input label="Suburb" value={clientInfo.suburb} onChange={(e) => setClientInfo(prev => ({ ...prev, suburb: e.target.value }))} />
                  <Input label="Postcode" value={clientInfo.postcode} onChange={(e) => setClientInfo(prev => ({ ...prev, postcode: e.target.value }))} maxLength={4} />
                  <Select label="State" value={clientInfo.state} onChange={(e) => setClientInfo(prev => ({ ...prev, state: e.target.value }))} options={AUSTRALIAN_STATES} placeholder="State" />
                </div>
              </div>
            </div>

            {/* Installation Info Section */}
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-3 uppercase tracking-wider">Installation Details</h3>
              <div className="space-y-3">
                <Input label="Total System Size (kW)" type="number" step="0.5" value={installInfo.total_system_size_kw || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, total_system_size_kw: parseFloat(e.target.value) || 0 }))} suffix="kW" />
                <Select label="Funding Model" value={installInfo.funding_model} onChange={(e) => setInstallInfo(prev => ({ ...prev, funding_model: e.target.value }))}
                  options={[{ value: 'Capex', label: 'Capex' }, { value: 'PPA', label: 'PPA' }]} />
                <Input label="Install Address" value={installInfo.install_address} onChange={(e) => setInstallInfo(prev => ({ ...prev, install_address: e.target.value }))} placeholder="Installation site address" />
                <div className="grid grid-cols-3 gap-3">
                  <Input label="Suburb" value={installInfo.suburb} onChange={(e) => setInstallInfo(prev => ({ ...prev, suburb: e.target.value }))} />
                  <Input label="Postcode" value={installInfo.postcode} onChange={(e) => setInstallInfo(prev => ({ ...prev, postcode: e.target.value }))} maxLength={4} />
                  <Select label="State" value={installInfo.state} onChange={(e) => setInstallInfo(prev => ({ ...prev, state: e.target.value }))} options={AUSTRALIAN_STATES} placeholder="State" />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input type="checkbox" id="stcs_on_first_100kw" checked={installInfo.stcs_on_first_100kw} onChange={(e) => setInstallInfo(prev => ({ ...prev, stcs_on_first_100kw: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500" />
                  <label htmlFor="stcs_on_first_100kw" className="text-sm text-slate-300">STCs on first 100kW</label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Commissioning Year" type="number" value={installInfo.expected_commissioning_year || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, expected_commissioning_year: parseInt(e.target.value) || new Date().getFullYear() }))} />
                  <Select label="Commissioning Month" value={installInfo.expected_commissioning_month} onChange={(e) => setInstallInfo(prev => ({ ...prev, expected_commissioning_month: e.target.value }))}
                    options={['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => ({ value: m, label: m }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Existing PV (kWp)" type="number" step="0.5" value={installInfo.existing_pv_kwp || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, existing_pv_kwp: parseFloat(e.target.value) || 0 }))} suffix="kWp" />
                  <Input label="Existing PV (kVA)" type="number" step="0.5" value={installInfo.existing_pv_kva || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, existing_pv_kva: parseFloat(e.target.value) || 0 }))} suffix="kVA" />
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={installInfo.hv_customer} onChange={(e) => setInstallInfo(prev => ({ ...prev, hv_customer: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500" />
                    <span className="text-sm text-slate-300">HV Customer</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={installInfo.site_inspection_confirmed} onChange={(e) => setInstallInfo(prev => ({ ...prev, site_inspection_confirmed: e.target.checked }))}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500" />
                    <span className="text-sm text-slate-300">Site Inspection Confirmed</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE: Item Selection with Table Layout */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Item Selection</h2>
          </div>

          {itemsLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : !selectedVersionId ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              Select a price table version in the top bar to load items.
            </div>
          ) : (
            <div className="space-y-2">
              {CATEGORY_STRUCTURE.map((category) => {
                const isExpanded = expandedCategories.has(category.id)
                const subcategories = groupedItems[category.id] || {}
                const allCategoryItems = Object.values(subcategories).flat()
                if (allCategoryItems.length === 0) return null

                // Calculate category total dynamically using dynamic evaluations
                const categoryTotal = allCategoryItems
                  .filter(item => item.is_included)
                  .reduce((sum, item) => sum + item.computed_total, 0)

                return (
                  <div key={category.id} className="border border-slate-700 rounded-lg overflow-hidden">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 transition-colors"
                    >
                      <span className="font-medium text-white text-sm">{category.label}</span>
                      <div className="flex items-center gap-3">
                        {categoryTotal > 0 && (
                          <span className="text-sm text-emerald-400 font-medium">
                            ${categoryTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>

                    {/* Category Content - Table */}
                    {isExpanded && (
                      <div className="bg-slate-900">
                        {/* Table Header */}
                        <div className="grid grid-cols-11 gap-2 px-4 py-2 bg-slate-850 border-b border-slate-800 text-xs font-medium text-slate-400">
                          <div className="col-span-2">Status</div>
                          <div className="col-span-1">Code</div>
                          <div className="col-span-3">Description</div>
                          <div className="col-span-1">Unit</div>
                          <div className="col-span-1">Qty</div>
                          <div className="col-span-2">Rate</div>
                          <div className="col-span-1 text-right">Total</div>
                        </div>

                        {/* Subcategories */}
                        <div className="divide-y divide-slate-800">
                          {Object.entries(subcategories).map(([subcatName, items]) => {
                            const subcatKey = `${category.id}-${subcatName}`
                            const isSubcatExpanded = expandedSubcategories.has(subcatKey)

                            // Calculate subcategory total dynamically
                            const subcatTotal = items
                              .filter(item => item.is_included)
                              .reduce((sum, item) => sum + item.computed_total, 0)

                            return (
                              <div key={subcatKey}>
                                {/* Subcategory Header */}
                                <button
                                  onClick={() => {
                                    const next = new Set(expandedSubcategories)
                                    next.has(subcatKey) ? next.delete(subcatKey) : next.add(subcatKey)
                                    setExpandedSubcategories(next)
                                  }}
                                  className="w-full flex items-center justify-between px-4 py-2 bg-slate-850 hover:bg-slate-800 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    {isSubcatExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                                    <span className="text-xs font-medium text-slate-300">{subcatName}</span>
                                  </div>
                                  {subcatTotal > 0 && (
                                    <span className="text-xs text-emerald-400">
                                      ${subcatTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </button>

                                {/* Subcategory Items */}
                                {isSubcatExpanded && items.map((item) => {
                                  return (
                                    <QuoteItemRow
                                      key={item.id}
                                      computedItem={item}
                                      scope={scope}
                                      handleItemStatusChange={handleItemStatusChange}
                                      handleItemQtyChange={handleItemQtyChange}
                                    />
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT SIDE: Quote Summary */}
        <div className="w-[220px] border-l border-slate-800 bg-slate-900 p-4 shrink-0">
          <h3 className="text-lg font-semibold text-white mb-4">Quote Summary</h3>

          <div className="space-y-4">
            {/* Subtotal */}
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400">Subtotal (ex GST)</span>
              <span className="text-sm text-white font-medium">
                ${totals.subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Rebates */}
            {totals.rebateTotal !== 0 && (
              <div className="flex justify-between items-center py-2 border-b border-slate-800 text-emerald-400">
                <span className="text-sm">Rebates (ex GST)</span>
                <span className="text-sm font-medium">
                  ${totals.rebateTotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Net */}
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400">Net (ex GST)</span>
              <span className="text-sm text-white font-medium">
                ${totals.netBeforeGST.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* GST */}
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400">GST (10%)</span>
              <span className="text-sm text-white font-medium">
                ${totals.gst.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center py-3 bg-slate-800 -mx-4 px-4 rounded">
              <span className="text-base font-semibold text-white">Total (inc GST)</span>
              <span className="text-lg font-bold text-emerald-400">
                ${totals.total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
 
