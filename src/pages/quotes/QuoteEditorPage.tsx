import React, { useState, useCallback, useEffect, useMemo, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, ArrowLeft, ChevronDown, ChevronRight, Calculator, TrendingUp, Clock } from 'lucide-react'
import { useQuoteEditorStore } from '../../stores/quoteEditorStore'
import { usePriceItems } from '../../hooks/usePriceItems'
import { usePriceVersions } from '../../hooks/usePriceVersions'
import { useSaveQuote, useQuote } from '../../hooks/useQuotes'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import type { InclusionStatus, QuoteLineItemState, ItemCategory, ComputedLineItem, PartialFormulaScope } from '../../types/domain.types'
import { type QuoteInputs, type CategorySubtotal, type QuoteResult, type LineItem } from '../../lib/quoteEngine'
import { saveQuoteData, updateQuoteData, getQuoteById } from '../../lib/quoteDbService'
import { AUSTRALIAN_STATES, STC_ZONE_FACTORS } from '../../lib/constants'
import { extractNMIPrefix, resolveDNSP, inferStateFromDNSP, buildDNSPScope } from '../../lib/dnspResolver'
import { usePriceItemOptions } from '../../hooks/usePriceItemOptions'
import { useComputedLineItems, useQuoteTotals } from '../../hooks/useComputedLineItems'
import { useDNSPRules } from '../../hooks/useDNSPRules'
import { evaluateFormula } from '../../lib/formulaEngine'
import { InlineFormulaEditor } from '../../components/quote/InlineFormulaEditor'
import LineItemRow from '../../components/quote/LineItemRow'

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

  const [installInfo, setInstallInfo] = useState<Partial<any>>({
    total_system_size_kw: 0, funding_model: 'Capex', install_address: '', suburb: '',
    postcode: '', state: '', stcs_on_first_100kw: true,
    expected_commissioning_year: new Date().getFullYear(),
    expected_commissioning_month: 'January', existing_pv_kwp: 0, existing_pv_kva: 0,
    hv_customer: false, site_inspection_confirmed: false,
    dc_cabling_type: 'No Match', ac_inverter_pvdb_type: 'No Match', ac_pvdb_msb_type: 'No Match',
    cable_tray_type: 'No Match', trenching_type: 'No Match', optimisers: 'No Match',
    client_cooperativeness: 'Very Co-operative',
    switchboard_complexity: 'Not Involved',
    site_complexity: 'None',
    site_complexity2: 'None',
    racking: 'Base Tin Installation',
    racking2: 'Flush Mounted',
    system_complexity: 'Standard',
    builders: 'Not Involved',
    consultants: 'Not Involved',
    architects: 'Not Involved',
    ppa_funders: 'Not Involved',
    stc_lgc_split: 'No',
    transformer: 'Not Required',
    rollout: 'No (1-2 sites)',
    safety: 'Standard',
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

  const complexityScope = useMemo(() => ({
    ...scope,
    client_cooperativeness: installInfo.client_cooperativeness,
    switchboard_complexity: installInfo.switchboard_complexity,
    site_complexity: installInfo.site_complexity,
    site_complexity2: installInfo.site_complexity2,
    racking: installInfo.racking,
    racking2: installInfo.racking2,
    system_complexity: installInfo.system_complexity,
    builders: installInfo.builders,
    consultants: installInfo.consultants,
    architects: installInfo.architects,
    ppa_funders: installInfo.ppa_funders,
    stc_lgc_split: installInfo.stc_lgc_split,
    transformer: installInfo.transformer,
    rollout: installInfo.rollout,
    safety: installInfo.safety,
    hv_customer: installInfo.hv_customer,
  }), [scope, installInfo])

  const totals = useQuoteTotals(computedItems, installInfo.total_system_size_kw, complexityScope)

  const hasProject = installInfo.total_system_size_kw > 0 || totals.costSubtotal > 0



  // Reactive Price Increase Forecast calculations
  const forecastSummary = useMemo(() => {
    const today = new Date()
    const monthMap: Record<string, number> = {
      'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
      'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11
    }
    const monthIndex = monthMap[installInfo.expected_commissioning_month] ?? 8
    const expectedStartDate = new Date(installInfo.expected_commissioning_year, monthIndex, 30)
    const decisionTimeMs = expectedStartDate.getTime() - today.getTime()
    const decisionTimeDays = decisionTimeMs / (1000 * 60 * 60 * 24)
    const dailyIncreaseRate = 0.00056
    const percentPriceIncrease = decisionTimeDays * dailyIncreaseRate
    const systemValueAtStartDate = totals.netBeforeGST * (1 + percentPriceIncrease)
    return { decisionTimeDays, percentPriceIncrease, systemValueAtStartDate }
  }, [installInfo.expected_commissioning_year, installInfo.expected_commissioning_month, totals.netBeforeGST])

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

            {/* Project Complexity Modifiers */}
            <div className="pt-4 border-t border-slate-800 mt-6">
              <h3 className="text-sm font-medium text-slate-300 mb-3 uppercase tracking-wider">Project Complexity Modifiers</h3>
              <div className="space-y-3">
                <Select label="Client Co-operativeness" value={installInfo.client_cooperativeness || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, client_cooperativeness: e.target.value }))}
                  options={['Very Co-operative', 'Average', 'Difficult', 'Very Difficult', 'CUB', 'No Match'].map(v => ({ value: v, label: v }))} />
                <Select label="Racking Type" value={installInfo.racking || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, racking: e.target.value }))}
                  options={['Base Tin Installation', 'Base Tile Installation', 'Ground Mounted (Fixed Tilt)', 'Ground Mounted (Single Axis)', 'Concrete Roof Mounted (not including waterproofing)', 'Ballasted System', 'Floating (ex. Anchors and Extras)', 'Carpark', 'No Match'].map(v => ({ value: v, label: v }))} />
                <Select label="Racking 2 (Additional)" value={installInfo.racking2 || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, racking2: e.target.value }))}
                  options={['Flush Mounted', 'Frameless', 'Klip Lock Addition', 'Tilt Legs Addition', 'Wind Zone C/D', 'Klip Lock + Tilt Legs Addition', 'Klip Lock Addition + Wind Zone C/D', 'Tilt Legs + Wind Zone C/D Addition', 'Klip Lock + Tilt Legs Addition +  Wind Zone C/D Addition', 'No Match'].map(v => ({ value: v, label: v }))} />
                <Select label="System Complexity" value={installInfo.system_complexity || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, system_complexity: e.target.value }))}
                  options={['Standard', 'Complex', 'Multi Roof', 'Large Scale Roof', 'Ground mounted mechanical + electrical', 'No Match'].map(v => ({ value: v, label: v }))} />
                <Select label="Switchboard" value={installInfo.switchboard_complexity || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, switchboard_complexity: e.target.value }))}
                  options={['Appears to be Adequate', 'May Require Upgrade (Excluded from quote)', 'Requires extension/New cabinet', 'Not Involved', 'Involved', 'Heavily or Continuously Involved', 'No Match'].map(v => ({ value: v, label: v }))} />
                <Select label="Site Complexity 1" value={installInfo.site_complexity || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, site_complexity: e.target.value }))}
                  options={['None', 'DA', 'Mine Site', 'Tricky Cable Run', 'AFC Not In Scope', 'Building Certification', 'Carport (SCP)', 'Carport (Other)', 'Building Height >20m', 'GSES', 'Generator on site'].map(v => ({ value: v, label: v }))} />
                <Select label="Site Complexity 2" value={installInfo.site_complexity2 || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, site_complexity2: e.target.value }))}
                  options={['None', 'DA', 'Mine Site', 'Tricky Cable Run', 'AFC Not In Scope', 'Building Certification', 'Carport (SCP)', 'Carport (Other)', 'Building Height >20m', 'GSES', 'Generator on site'].map(v => ({ value: v, label: v }))} />
                <Select label="Builders" value={installInfo.builders || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, builders: e.target.value }))}
                  options={['Not Involved', 'Involved', 'Heavily or Continuously Involved'].map(v => ({ value: v, label: v }))} />
                <Select label="Consultants" value={installInfo.consultants || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, consultants: e.target.value }))}
                  options={['Not Involved', 'Involved'].map(v => ({ value: v, label: v }))} />
                <Select label="Architects" value={installInfo.architects || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, architects: e.target.value }))}
                  options={['Not Involved', 'Involved'].map(v => ({ value: v, label: v }))} />
                <Select label="PPA Funders" value={installInfo.ppa_funders || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, ppa_funders: e.target.value }))}
                  options={['Not Involved', 'Clearsky', 'Solarbay/Green Peak'].map(v => ({ value: v, label: v }))} />
                <Select label="STC/LGC Split" value={installInfo.stc_lgc_split || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, stc_lgc_split: e.target.value }))}
                  options={['No', 'Yes'].map(v => ({ value: v, label: v }))} />
                <Select label="Transformer" value={installInfo.transformer || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, transformer: e.target.value }))}
                  options={['Not Required', 'Required'].map(v => ({ value: v, label: v }))} />
                <Select label="Rollout" value={installInfo.rollout || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, rollout: e.target.value }))}
                  options={['No (1-2 sites)', 'Yes (3-5 sites)', 'Yes (5-20 sites)', 'Yes (20+ sites)'].map(v => ({ value: v, label: v }))} />
                <Select label="Safety" value={installInfo.safety || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, safety: e.target.value }))}
                  options={['Standard', 'Rigorous', 'Very Rigorous', 'No Match'].map(v => ({ value: v, label: v }))} />
                <Select label="Optimisers" value={installInfo.optimisers || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, optimisers: e.target.value }))}
                  options={[
                    { value: 'No Match', label: 'No Match' },
                    { value: 'SolarEdge', label: 'SolarEdge' },
                    { value: 'Tigo', label: 'Tigo' },
                    { value: 'Enphase', label: 'Enphase' }
                  ]} />
              </div>
            </div>

            {/* Cabling Details */}
            <div className="pt-4 border-t border-slate-800 mt-6">
              <h3 className="text-sm font-medium text-slate-300 mb-3 uppercase tracking-wider">Cabling Details</h3>
              <div className="space-y-3">
                <Select label="DC Cabling Type" value={installInfo.dc_cabling_type || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, dc_cabling_type: e.target.value }))}
                  options={[
                    { value: 'No Match', label: 'No Match' },
                    { value: '4mm2', label: '4mm2' },
                    { value: '6mm2', label: '6mm2' }
                  ]} />
                <Select label="AC Inverter to PVDB Type" value={installInfo.ac_inverter_pvdb_type || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, ac_inverter_pvdb_type: e.target.value }))}
                  options={[{ value: 'No Match', label: 'No Match' }, { value: 'Standard', label: 'Standard' }]} />
                <Select label="AC PVDB to MSB Type" value={installInfo.ac_pvdb_msb_type || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, ac_pvdb_msb_type: e.target.value }))}
                  options={[{ value: 'No Match', label: 'No Match' }, { value: 'Standard', label: 'Standard' }]} />
                <Select label="Cable Tray Type" value={installInfo.cable_tray_type || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, cable_tray_type: e.target.value }))}
                  options={[{ value: 'No Match', label: 'No Match' }, { value: 'Standard', label: 'Standard' }]} />
              </div>
            </div>

            {/* Trenching */}
            <div className="pt-4 border-t border-slate-800 mt-6">
              <h3 className="text-sm font-medium text-slate-300 mb-3 uppercase tracking-wider">Trenching</h3>
              <div className="space-y-3">
                <Select label="Trenching Type" value={installInfo.trenching_type || ''} onChange={(e) => setInstallInfo(prev => ({ ...prev, trenching_type: e.target.value }))}
                  options={[
                    { value: 'No Match', label: 'No Match' },
                    { value: 'Soft Ground', label: 'Soft Ground' },
                    { value: 'Hard Ground', label: 'Hard Ground' }
                  ]} />
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

                const categoryTotal = allCategoryItems
                  .filter(item => item.is_included)
                  .reduce((sum, item) => sum + item.computed_total, 0)

                return (
                  <div key={category.id} className="border border-slate-700 rounded-lg overflow-hidden">
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

                    {isExpanded && (
                      <div className="bg-slate-900">
                        <table className="w-full text-left border-collapse table-fixed">
                          <thead>
                            <tr className="bg-slate-850 border-b border-slate-800 text-xs font-medium text-slate-400">
                              <th className="font-medium px-4 py-3 w-36 whitespace-nowrap">Status</th>
                              <th className="font-medium pr-3 py-3 w-20 whitespace-nowrap">Code</th>
                              <th className="font-medium pr-3 py-3 w-full">Description</th>
                              <th className="font-medium pr-3 py-3 w-24 text-right whitespace-nowrap">Calc Qty</th>
                              <th className="font-medium pr-3 py-3 w-20 text-right whitespace-nowrap">Qty</th>
                              <th className="font-medium pr-3 py-3 w-24 text-right whitespace-nowrap">Cost</th>
                              <th className="font-medium pr-3 py-3 w-28 text-right whitespace-nowrap">$/W Cost</th>
                              <th className="font-medium pr-3 py-3 w-24 text-right whitespace-nowrap">Sales Rate</th>
                              <th className="font-medium pr-4 py-3 w-28 text-right whitespace-nowrap">Sale $/W</th>
                              <th className="font-medium pr-2 py-3 w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {Object.entries(subcategories).map(([subcatName, items]) => {
                              const subcatKey = `${category.id}-${subcatName}`
                              const isSubcatExpanded = expandedSubcategories.has(subcatKey)

                              const subcatTotal = items
                                .filter(item => item.is_included)
                                .reduce((sum, item) => sum + item.computed_total, 0)

                              return (
                                <Fragment key={subcatKey}>
                                  <tr className="bg-slate-850 hover:bg-slate-800 transition-colors cursor-pointer group"
                                    onClick={() => {
                                      const next = new Set(expandedSubcategories)
                                      if (next.has(subcatKey)) {
                                        next.delete(subcatKey)
                                      } else {
                                        next.add(subcatKey)
                                      }
                                      setExpandedSubcategories(next)
                                    }}
                                  >
                                    <td colSpan={10} className="px-4 py-2">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          {isSubcatExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                                          <span className="text-xs font-medium text-slate-300">{subcatName}</span>
                                        </div>
                                        {subcatTotal > 0 && (
                                          <span className="text-xs text-emerald-400 font-medium">
                                            ${subcatTotal.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>

                                  {isSubcatExpanded && items.map((item) => (
                                    <LineItemRow
                                      key={item.instance_id}
                                      item={item}
                                      scope={scope as PartialFormulaScope}
                                      onStatusChange={(status) => handleItemStatusChange(item.instance_id, status)}
                                      onQtyChange={(qty) => handleItemQtyChange(item.instance_id, qty)}
                                      onUseCalcQtyChange={(useCalc) => {
                                        const store = useQuoteEditorStore.getState()
                                        store.setLineItemState(item.instance_id, { use_calculated_qty: useCalc })
                                      }}
                                      onOptionChange={(groupId, optionId) => {
                                        const store = useQuoteEditorStore.getState()
                                        store.setOptionSelection(item.instance_id, groupId, optionId)
                                      }}
                                      onFormulaOverride={(formula) => {
                                        const store = useQuoteEditorStore.getState()
                                        store.setFormulaOverride(item.instance_id, formula)
                                      }}
                                      onModifierChange={() => { }}
                                      onDuplicate={() => {
                                        const store = useQuoteEditorStore.getState()
                                        store.duplicateLineItem(item.instance_id)
                                      }}
                                      onRemove={() => {
                                        const store = useQuoteEditorStore.getState()
                                        store.removeLineItem(item.instance_id)
                                      }}
                                    />
                                  ))}
                                </Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT SIDE: Quote Summary Cards */}
        <div className="w-[320px] border-l border-slate-800 bg-slate-900/40 shrink-0 overflow-y-auto p-4 space-y-4">
          
          {/* Quote Summary Card */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-brand-400" />
              Quote Summary
            </h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400 text-xs">Cost Subtotal</span>
                <span className="text-slate-300 font-mono text-xs">
                  {hasProject ? `$${totals.costSubtotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400 text-xs">Sales Subtotal</span>
                <span className="text-slate-300 font-mono text-xs">
                  {hasProject ? `$${totals.subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
              {totals.rebateTotal !== 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                  <span className="text-slate-400 text-xs">Rebates & Incentives</span>
                  <span className="text-green-400 font-mono text-xs">
                    {totals.rebateTotal < 0 ? '-' : ''}${Math.abs(totals.rebateTotal).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-slate-300 text-xs font-medium">Net (ex GST)</span>
                <span className="text-white font-mono font-medium text-xs">
                  {hasProject ? `$${totals.netBeforeGST.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400 text-xs">GST (10%)</span>
                <span className="text-slate-300 font-mono text-xs">
                  {hasProject ? `$${totals.gst.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 bg-slate-800/80 -mx-4 px-4 rounded-b-xl shadow-inner mt-2 border-t border-slate-700/50">
                <span className="text-sm font-semibold text-white">Total (inc GST)</span>
                <span className="text-base font-bold font-mono text-emerald-400">
                  {hasProject ? `$${totals.total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
              {installInfo.total_system_size_kw > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">System size</span>
                    <span className="text-slate-300 font-mono">{installInfo.total_system_size_kw} kWp</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Price / kW (net ex GST)</span>
                    <span className="text-slate-300 font-mono">
                      ${installInfo.total_system_size_kw > 0 ? (totals.netBeforeGST / installInfo.total_system_size_kw).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'}/kW
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Markup Analysis Card */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Markup Analysis
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-xs text-slate-400">Proposed Markup</span>
                <span className="text-xs text-emerald-400 font-mono font-bold">
                  {hasProject && totals.proposedMarkup > 0 ? `${((totals.proposedMarkup - 1) * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-xs text-slate-400">Target Markup</span>
                <span className="text-xs text-brand-400 font-mono font-bold">
                  {hasProject && totals.targetMarkup > 0 ? `${((totals.targetMarkup - 1) * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-xs text-slate-400">Minimum Markup</span>
                <span className="text-xs text-amber-400 font-mono font-bold">
                  {hasProject && totals.minimumMarkup > 0 ? `${((totals.minimumMarkup - 1) * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-xs text-slate-400">Mid Point</span>
                <span className="text-xs text-slate-300 font-mono">
                  {hasProject && totals.midPoint > 0 ? `${((totals.midPoint - 1) * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-xs text-slate-400">Eng Hours</span>
                <span className="text-xs text-slate-300 font-mono">
                  {hasProject ? `${totals.engHours.toFixed(1)} hrs` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-xs text-slate-400">PM Hours</span>
                <span className="text-xs text-slate-300 font-mono">
                  {hasProject ? `${totals.pmHours.toFixed(1)} hrs` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 bg-slate-800/80 -mx-4 px-4 rounded-b-xl shadow-inner mt-2 border-t border-slate-700/50">
                <span className="text-xs font-semibold text-white">Sales Total</span>
                <span className="text-sm font-bold font-mono text-emerald-400">
                  {hasProject ? `$${totals.netBeforeGST.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Price Increase Forecast Card */}
          <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Price Forecast
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-xs text-slate-400">Days to Start</span>
                <span className="text-xs text-slate-300 font-mono">
                  {forecastSummary.decisionTimeDays.toFixed(0)} days
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-xs text-slate-400">Today's Value</span>
                <span className="text-xs text-slate-300 font-mono">
                  {hasProject ? `$${totals.netBeforeGST.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/60">
                <span className="text-xs text-slate-400">Value at Start Date</span>
                <span className="text-xs text-slate-300 font-mono">
                  {hasProject ? `$${forecastSummary.systemValueAtStartDate.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 bg-slate-800/80 -mx-4 px-4 rounded-b-xl shadow-inner mt-2 border-t border-slate-700/50">
                <span className="text-xs font-semibold text-white">% Price Increase</span>
                <span className={`text-sm font-bold font-mono ${forecastSummary.percentPriceIncrease < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {(forecastSummary.percentPriceIncrease * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
