import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  SiteDetailsFormData,
  QuoteLineItemState,
  CustomLineItem,
  InstallType,
  TrenchType,
  PartialFormulaScope,
  InclusionStatus,
} from '../types/domain.types'
import { DEFAULT_SCOPE_VALUES } from '../lib/constants'

interface QuoteEditorState {
  quoteId: string | null
  isDirty: boolean

  // Site and system details
  siteDetails: SiteDetailsFormData
  // Formula scope values (everything the engine needs)
  scope: PartialFormulaScope

  // Price table version
  selectedVersionId: string | null
  comparisonVersionId: string | null

  /**
   * Ordered array of all line item states.
   * - Standard items that the user hasn't touched are "virtual defaults" — not stored here.
   *   Their instance_id === price_item_id when first created from a virtual default.
   * - Duplicate instances have a new random instance_id and the same price_item_id.
   * - Custom items have price_item_id === null.
   */
  lineItems: QuoteLineItemState[]

  // Actions
  setQuoteId: (id: string | null) => void
  setSiteDetails: (data: Partial<SiteDetailsFormData>) => void
  setScope: (updates: Partial<PartialFormulaScope>) => void
  setSystemKw: (kw: number) => void
  setInstallType: (type: InstallType) => void
  setTrenchType: (type: TrenchType) => void
  setSelectedVersion: (id: string | null) => void
  setComparisonVersion: (id: string | null) => void

  /**
   * Update (or create on first touch) a line item state.
   * For virtual defaults, instanceId === price_item_id — calling this persists the item.
   */
  setLineItemState: (instanceId: string, updates: Partial<QuoteLineItemState>) => void
  /** Set a single option group selection without clobbering other groups. */
  setOptionSelection: (instanceId: string, groupId: string, optionId: string | null) => void
  /** Set or clear a per-quote formula override. Pass null to revert to price item default. */
  setFormulaOverride: (instanceId: string, formula: string | null) => void

  /**
   * Duplicate a line item row. Inserts the copy immediately after the original.
   * Works for both stored and virtual items.
   */
  duplicateLineItem: (instanceId: string) => void

  /**
   * Remove a line item row. Only valid for custom items and duplicate instances.
   * Original standard items cannot be removed — use setLineItemState to set not_required.
   */
  removeLineItem: (instanceId: string) => void

  /** Add a custom line item from the CustomLineItemForm. */
  addCustomItem: (item: CustomLineItem) => void

  markSaved: () => void
  resetStore: () => void
}

const defaultSiteDetails: SiteDetailsFormData = {
  project_name: '',
  // Legacy fields
  customer_name: '',
  customer_company: '',
  customer_email: '',
  customer_phone: '',
  customer_abn: '',
  // New client_info fields
  primary_contact: '',
  direct_ph: '',
  email_address: '',
  abn: '',
  is_off_grid: false,
  billing_address: '',
  // Site fields
  site_address: '',
  site_suburb: '',
  site_state: '',
  site_postcode: '',
  nmi: '',
  dnsp: '',
  valid_until: '',
  internal_notes: '',
}

function makeDefaultLineItemState(instanceId: string, overrides: Partial<QuoteLineItemState> = {}): QuoteLineItemState {
  return {
    instance_id: instanceId,
    price_item_id: instanceId,
    inclusion_status: 'not_required' as InclusionStatus, // Changed from 'included' to 'not_required'
    qty: 1,
    selected_options: {},
    formula_override: null,
    modifier_type: 'none',
    modifier_value: 0,
    modifier_note: '',
    sort_order: 0,
    ...overrides,
  }
}

export const useQuoteEditorStore = create<QuoteEditorState>()(
  persist(
    (set) => ({
      quoteId: null,
      isDirty: false,
      siteDetails: { ...defaultSiteDetails },
      scope: { ...DEFAULT_SCOPE_VALUES },
      selectedVersionId: null,
      comparisonVersionId: null,
      lineItems: [],

      setQuoteId: (id) => set({ quoteId: id }),

      setSiteDetails: (data) =>
        set((s) => ({
          siteDetails: { ...s.siteDetails, ...data },
          isDirty: true,
        })),

      setScope: (updates) =>
        set((s) => ({
          scope: { ...s.scope, ...updates },
          isDirty: true,
        })),

      setSystemKw: (kw) =>
        set((s) => ({
          scope: { ...s.scope, system_kw: kw, system_kva: Math.round(kw * 1.25 * 100) / 100 },
          isDirty: true,
        })),

      setInstallType: (type) =>
        set((s) => ({
          scope: { ...s.scope, install_type: type },
          isDirty: true,
        })),

      setTrenchType: (type) =>
        set((s) => ({
          scope: { ...s.scope, trench_type: type },
          isDirty: true,
        })),

      setSelectedVersion: (id) =>
        set({ selectedVersionId: id, isDirty: true }),

      setComparisonVersion: (id) =>
        set({ comparisonVersionId: id }),

      setLineItemState: (instanceId, updates) =>
        set((s) => {
          const idx = s.lineItems.findIndex((li) => li.instance_id === instanceId)
          if (idx >= 0) {
            // Update existing entry
            return {
              lineItems: s.lineItems.map((li, i) =>
                i === idx ? { ...li, ...updates } : li
              ),
              isDirty: true,
            }
          } else {
            // First touch of a virtual default — create persisted entry
            // instanceId === price_item_id for virtual items
            const newItem = makeDefaultLineItemState(instanceId, updates)
            return {
              lineItems: [...s.lineItems, newItem],
              isDirty: true,
            }
          }
        }),

      duplicateLineItem: (instanceId) =>
        set((s) => {
          const existing = s.lineItems.find((li) => li.instance_id === instanceId)

          if (!existing) {
            // Virtual item — create the base entry and a duplicate
            const base = makeDefaultLineItemState(instanceId)
            const duplicate: QuoteLineItemState = {
              ...base,
              instance_id: crypto.randomUUID(),
              sort_order: 0.5,
            }
            return { lineItems: [...s.lineItems, base, duplicate], isDirty: true }
          }

          // Count siblings to pick an appropriate sort_order for the duplicate
          const siblings = s.lineItems.filter(
            (li) => li.price_item_id === existing.price_item_id || li.instance_id === existing.price_item_id
          )
          const maxSortOrder = siblings.length > 0
            ? Math.max(...siblings.map((li) => li.sort_order))
            : existing.sort_order

          const duplicate: QuoteLineItemState = {
            ...existing,
            instance_id: crypto.randomUUID(),
            sort_order: maxSortOrder + 0.5,
          }

          // Insert immediately after the found item
          const insertIdx = s.lineItems.indexOf(existing) + 1
          const next = [
            ...s.lineItems.slice(0, insertIdx),
            duplicate,
            ...s.lineItems.slice(insertIdx),
          ]
          return { lineItems: next, isDirty: true }
        }),

      removeLineItem: (instanceId) =>
        set((s) => ({
          lineItems: s.lineItems.filter((li) => li.instance_id !== instanceId),
          isDirty: true,
        })),

      setOptionSelection: (instanceId, groupId, optionId) =>
        set((s) => {
          const idx = s.lineItems.findIndex((li) => li.instance_id === instanceId)
          if (idx >= 0) {
            const li = s.lineItems[idx]
            const next = { ...li.selected_options }
            if (optionId === null) delete next[groupId]
            else next[groupId] = optionId
            return {
              lineItems: s.lineItems.map((l, i) =>
                i === idx ? { ...l, selected_options: next } : l
              ),
              isDirty: true,
            }
          } else {
            // First touch of virtual item
            const next: Record<string, string> = {}
            if (optionId !== null) next[groupId] = optionId
            const newItem = makeDefaultLineItemState(instanceId, { selected_options: next })
            return { lineItems: [...s.lineItems, newItem], isDirty: true }
          }
        }),

      setFormulaOverride: (instanceId, formula) =>
        set((s) => {
          const idx = s.lineItems.findIndex((li) => li.instance_id === instanceId)
          if (idx >= 0) {
            return {
              lineItems: s.lineItems.map((li, i) =>
                i === idx ? { ...li, formula_override: formula } : li
              ),
              isDirty: true,
            }
          } else {
            const newItem = makeDefaultLineItemState(instanceId, { formula_override: formula })
            return { lineItems: [...s.lineItems, newItem], isDirty: true }
          }
        }),

      addCustomItem: (item) =>
        set((s) => {
          const newItem: QuoteLineItemState = {
            instance_id: item.id,
            price_item_id: null,
            inclusion_status: 'not_required', // Changed from 'included' to 'not_required'
            qty: item.qty,
            selected_options: {},
            formula_override: null,
            modifier_type: item.modifier_type,
            modifier_value: item.modifier_value,
            modifier_note: item.modifier_note,
            sort_order: item.sort_order,
            custom_category: item.category,
            custom_code: item.code,
            custom_name: item.name,
            custom_unit: item.unit,
            custom_base_price: item.base_unit_price,
            custom_formula: item.formula,
          }
          return { lineItems: [...s.lineItems, newItem], isDirty: true }
        }),

      markSaved: () => set({ isDirty: false }),

      resetStore: () =>
        set({
          quoteId: null,
          isDirty: false,
          siteDetails: { ...defaultSiteDetails },
          scope: { ...DEFAULT_SCOPE_VALUES },
          selectedVersionId: null,
          comparisonVersionId: null,
          lineItems: [],
        }),
    }),
    {
      name: 'quote-editor-draft',
      // Version 4: formula_override added to QuoteLineItemState.
      // Version 3: selected_option_id replaced with selected_options Record<groupId, optionId>.
      // Version 2: replaced overrides+customItems with lineItems array.
      // Bumping the version causes Zustand to discard any v1 localStorage
      // data rather than merging it (which would bring in stale overrides).
      version: 4,
      migrate: () => ({
        // Return an empty state — the user will start fresh.
        // (Their actual quote data is persisted in Supabase, not just localStorage.)
      }),
      partialize: (state) => ({
        quoteId: state.quoteId,
        siteDetails: state.siteDetails,
        scope: state.scope,
        selectedVersionId: state.selectedVersionId,
        lineItems: state.lineItems,
      }),
    }
  )
)
