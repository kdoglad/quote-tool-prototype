import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { useQuoteEditorStore } from '../../stores/quoteEditorStore'
import { usePriceItems } from '../../hooks/usePriceItems'
import { usePriceVersions } from '../../hooks/usePriceVersions'
import { useSaveQuote, useQuote } from '../../hooks/useQuotes'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Spinner from '../../components/ui/Spinner'
import type { InclusionStatus, PriceItem } from '../../types/domain.types'
import { calculateQuote, type QuoteInputs, type CatalogDatabase } from '../../lib/quoteEngine'
import { saveQuoteData } from '../../lib/quoteDbService'
import { AUSTRALIAN_STATES } from '../../lib/constants'

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
    quoteId, isDirty, selectedVersionId,
    setSelectedVersion, markSaved, setQuoteId
  } = useQuoteEditorStore()

  const { data: versions = [] } = usePriceVersions()
  const { data: priceItems = [], isLoading: itemsLoading } = usePriceItems(selectedVersionId ?? undefined)
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

  // Item state: itemId -> { status, qty }
  const [itemStates, setItemStates] = useState<Record<string, { status: InclusionStatus; qty: number }>>({})
  const [quotePreview, setQuotePreview] = useState<any>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // Auto-select latest published version
  useEffect(() => {
    if (!selectedVersionId && versions.length > 0) {
      const latest = versions.find((v) => !v.is_draft)
      if (latest) setSelectedVersion(latest.id)
    }
  }, [versions, selectedVersionId, setSelectedVersion])

  // Initialize item states
  useEffect(() => {
    if (priceItems.length > 0) {
      const initial: Record<string, { status: InclusionStatus; qty: number }> = {}
      priceItems.forEach(item => {
        initial[item.id] = { status: 'not_required', qty: 1 }
      })
      setItemStates(initial)
    }
  }, [priceItems])

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, PriceItem[]> = {}
    priceItems.forEach(item => {
      const category = item.category
      if (!groups[category]) groups[category] = []
      groups[category].push(item)
    })
    return groups
  }, [priceItems])

  // Calculate totals
  const totals = useMemo(() => {
    let subtotal = 0
    const includedItems = priceItems.filter(item => itemStates[item.id]?.status === 'included')

    includedItems.forEach(item => {
      const qty = itemStates[item.id]?.qty || 1
      const total = item.base_price * qty
      subtotal += total
    })

    const gst = subtotal * 0.10
    const total = subtotal + gst

    return { subtotal, gst, total }
  }, [priceItems, itemStates])

  // Trigger live calculation
  useEffect(() => {
    if (!selectedVersionId || priceItems.length === 0) return
    const timer = setTimeout(() => { triggerCalculation() }, 500)
    return () => clearTimeout(timer)
  }, [clientInfo, installInfo, itemStates, selectedVersionId, priceItems])

  const triggerCalculation = useCallback(async () => {
    if (!selectedVersionId || priceItems.length === 0) return
    setIsCalculating(true)
    try {
      const inputs: QuoteInputs = {
        client: {
          projectName: projectName || 'Untitled Project',
          contactName: clientInfo.primary_contact,
          email: clientInfo.email_address,
          phone: clientInfo.direct_ph,
          nmi: clientInfo.nmi,
          isOffGrid: clientInfo.is_off_grid,
          state: installInfo.state || clientInfo.state,
          postcode: installInfo.postcode || clientInfo.postcode,
          suburb: installInfo.suburb || clientInfo.suburb,
          billingAddress: clientInfo.billing_address,
          abn: clientInfo.abn,
        },
        system: {
          totalSystemSizeKw: installInfo.total_system_size_kw,
          panelWattage: 440,
          panelQuantity: Math.ceil((installInfo.total_system_size_kw * 1000) / 440),
          inverterSizeKw: installInfo.total_system_size_kw * 1.2,
          inverterQuantity: 1,
          hasBess: false,
          bessCapacityKwh: 0,
          hasEv: false,
          evChargerQuantity: 0,
          isHvCustomer: installInfo.hv_customer,
          hasExistingPv: installInfo.existing_pv_kwp > 0,
          existingPvSizeKw: installInfo.existing_pv_kwp,
        },
        installation: {
          installYear: installInfo.expected_commissioning_year,
          installMonth: new Date().getMonth() + 1,
          siteInspectionConfirmed: installInfo.site_inspection_confirmed,
          hvCustomer: installInfo.hv_customer,
          dnsp: 'Ausgrid',
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
      const catalog: CatalogDatabase = {
        panels: [], inverters: [], batteries: [], racking: [],
        cabling: [], install: [], prelim: [], gridConnection: [],
      }
      const result = calculateQuote(inputs, catalog)
      setQuotePreview(result)
    } catch (error) {
      console.error('Calculation error:', error)
    } finally {
      setIsCalculating(false)
    }
  }, [clientInfo, installInfo, itemStates, projectName, selectedVersionId, priceItems])

  const handleItemStatusChange = useCallback((itemId: string, status: InclusionStatus) => {
    setItemStates(prev => ({ ...prev, [itemId]: { ...prev[itemId], status } }))
  }, [])

  const handleItemQtyChange = useCallback((itemId: string, qty: number) => {
    setItemStates(prev => ({ ...prev, [itemId]: { ...prev[itemId], qty } }))
  }, [])

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }, [])

  async function handleSave() {
    try {
      const inputs: QuoteInputs = {
        client: {
          projectName: projectName || 'Untitled Project',
          contactName: clientInfo.primary_contact,
          email: clientInfo.email_address,
          phone: clientInfo.direct_ph,
          nmi: clientInfo.nmi,
          isOffGrid: clientInfo.is_off_grid,
          state: installInfo.state || clientInfo.state,
          postcode: installInfo.postcode || clientInfo.postcode,
          suburb: installInfo.suburb || clientInfo.suburb,
          billingAddress: clientInfo.billing_address,
          abn: clientInfo.abn,
        },
        system: {
          totalSystemSizeKw: installInfo.total_system_size_kw,
          panelWattage: 440,
          panelQuantity: Math.ceil((installInfo.total_system_size_kw * 1000) / 440),
          inverterSizeKw: installInfo.total_system_size_kw * 1.2,
          inverterQuantity: 1,
          hasBess: false,
          bessCapacityKwh: 0,
          hasEv: false,
          evChargerQuantity: 0,
          isHvCustomer: installInfo.hv_customer,
          hasExistingPv: installInfo.existing_pv_kwp > 0,
          existingPvSizeKw: installInfo.existing_pv_kwp,
        },
        installation: {
          installYear: installInfo.expected_commissioning_year,
          installMonth: new Date().getMonth() + 1,
          siteInspectionConfirmed: installInfo.site_inspection_confirmed,
          hvCustomer: installInfo.hv_customer,
          dnsp: 'Ausgrid',
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
      const catalog: CatalogDatabase = {
        panels: [], inverters: [], batteries: [], racking: [],
        cabling: [], install: [], prelim: [], gridConnection: [],
      }
      const result = calculateQuote(inputs, catalog)
      const saveResult = await saveQuoteData(inputs, result, selectedVersionId!)

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
        <div className="w-[380px] border-r border-slate-800 overflow-y-auto p-6 space-y-6">
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
                const items = groupedItems[category.id] || []
                if (items.length === 0) return null

                // Calculate category total
                const categoryTotal = items
                  .filter(item => itemStates[item.id]?.status === 'included')
                  .reduce((sum, item) => {
                    const qty = itemStates[item.id]?.qty || 1
                    return sum + (item.base_price * qty)
                  }, 0)

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
                        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-850 border-b border-slate-800 text-xs font-medium text-slate-400">
                          <div className="col-span-2">Status</div>
                          <div className="col-span-1">Code</div>
                          <div className="col-span-3">Description</div>
                          <div className="col-span-1">Unit</div>
                          <div className="col-span-1">Qty</div>
                          <div className="col-span-2">Rate</div>
                          <div className="col-span-1">Adj.</div>
                          <div className="col-span-1 text-right">Total</div>
                        </div>

                        {/* Table Rows */}
                        <div className="divide-y divide-slate-800">
                          {items.map((item) => {
                            const state = itemStates[item.id] || { status: 'not_required', qty: 1 }
                            const total = item.base_price * state.qty
                            const isIncluded = state.status === 'included'

                            return (
                              <div key={item.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 hover:bg-slate-850 transition-colors text-sm">
                                {/* Status */}
                                <div className="col-span-2">
                                  <select
                                    value={state.status}
                                    onChange={(e) => handleItemStatusChange(item.id, e.target.value as InclusionStatus)}
                                    className={`w-full bg-slate-800 border rounded text-xs py-1 px-2 focus:outline-none focus:ring-1 ${isIncluded
                                      ? 'border-emerald-600 text-emerald-400 focus:ring-emerald-500'
                                      : 'border-slate-700 text-slate-400 focus:ring-brand-500'
                                      }`}
                                  >
                                    <option value="not_required">Not Required</option>
                                    <option value="included">Included</option>
                                  </select>
                                </div>

                                {/* Code */}
                                <div className="col-span-1 text-slate-500 text-xs truncate">{item.code}</div>

                                {/* Description */}
                                <div className="col-span-3 text-white truncate">{item.name}</div>

                                {/* Unit */}
                                <div className="col-span-1 text-slate-400 text-xs">{item.unit}</div>

                                {/* Qty */}
                                <div className="col-span-1">
                                  <input
                                    type="number"
                                    min="1"
                                    value={state.qty}
                                    onChange={(e) => handleItemQtyChange(item.id, parseInt(e.target.value) || 1)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded text-xs text-white py-1 px-2 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                  />
                                </div>

                                {/* Rate */}
                                <div className="col-span-2 text-slate-300 text-xs">
                                  ${item.base_price.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>

                                {/* Adj. */}
                                <div className="col-span-1 text-slate-500 text-xs">—</div>

                                {/* Total */}
                                <div className={`col-span-1 text-right font-medium ${isIncluded ? 'text-emerald-400' : 'text-slate-500'}`}>
                                  ${total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
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
        <div className="w-[280px] border-l border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quote Summary</h3>

          <div className="space-y-4">
            {/* Subtotal */}
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400">Subtotal (ex GST)</span>
              <span className="text-sm text-white font-medium">
                ${totals.subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Net */}
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-sm text-slate-400">Net (ex GST)</span>
              <span className="text-sm text-white font-medium">
                ${totals.subtotal.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            <div className="flex justify-between items-center py-3 bg-slate-800 -mx-6 px-6 rounded">
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
