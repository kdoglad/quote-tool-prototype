// ============================================================
// Domain types for the Smart Commercial Solar Quote Tool
// ============================================================

export type UserRole = 'admin' | 'engineer' | 'sales'

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired'

export type ModifierType = 'none' | 'flat' | 'percent'

// Multi-state inclusion status replaces the old boolean is_included
export type InclusionStatus =
  | 'included'          // Counted in total, shown in inclusions list
  | 'not_required'      // Not counted, shown in exclusions list

export type ItemCategory =
  | 'Prelim'
  | 'PV_Components'
  | 'BESS'
  | 'Cabling'
  | 'Switchgear'
  | 'Install'
  | 'Safety'
  | 'Monitoring'
  | 'EV'
  | 'Rebates'
  | 'Custom'

export type InstallType = 'rooftop' | 'ground' | 'carport'

export type TrenchType = 'soft' | 'hard' | 'none'

// ============================================================
// USER
// ============================================================

export interface UserProfile {
  id: string
  role: UserRole
  full_name: string
  email: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// ============================================================
// PRICE TABLE
// ============================================================

export interface PriceVersion {
  id: string
  version_name: string
  notes: string | null
  is_draft: boolean
  published_at: string | null
  published_by: string | null
  created_at: string
  created_by: string | null
}

export interface PriceItem {
  id: string
  version_id: string
  category: ItemCategory
  subcategory: string | null
  code: string
  name: string
  unit: string
  base_price: number
  formula: string | null
  conditions: Record<string, unknown>
  sort_order: number
  is_optional: boolean
  is_active: boolean
  notes: string | null
  created_at: string
  specData?: Record<string, any>
  type_value?: string
}

// A named selection dimension for a price item (e.g. "Configuration", "Enclosure Type")
export interface PriceItemOptionGroup {
  id: string
  price_item_id: string
  label: string
  sort_order: number
  is_required: boolean
  created_at: string
  // Populated client-side after fetch
  options?: PriceItemOption[]
}

// One selectable choice within a group, with a price modifier
export interface PriceItemOption {
  id: string
  group_id: string
  price_item_id: string
  label: string
  // flat   → add modifier_value to line total
  // percent → multiply line total by (1 + modifier_value/100)
  // replace → set line total to modifier_value
  modifier_type: 'flat' | 'percent' | 'replace'
  modifier_value: number
  sort_order: number
  is_default: boolean
  notes: string | null
  created_at: string
}

// ============================================================
// FORMULA ENGINE
// ============================================================

export interface FormulaScope {
  // System
  system_kw: number
  system_kva: number
  bess_kwh: number
  // Site
  site_state: string
  postcode: string
  nmi_prefix: string
  // Install type
  install_type: InstallType
  // Flags
  has_bess: boolean
  has_ev: boolean
  optimisers?: string
  // Cabling
  dc_cable_m: number
  ac_cable_m: number
  cable_run_m: number
  dc_cabling_type: string
  ac_inverter_pvdb_type: string
  ac_pvdb_msb_type: string
  cable_tray_type: string
  trenching_type: string
  trench_m: number
  trench_type: TrenchType
  trench_depth_m: number
  // Safety
  roof_perimeter_m: number
  // Solar
  existing_solar_kw: number
  // DNSP
  dnsp_application_fee: number
  dnsp_study_threshold: number
  dnsp_study_fee: number
  // Rebates
  stc_zone_factor: number
  stc_years: number
  stc_price: number
  lgc_factor: number
  lgc_price: number
  veec_count: number
  veec_price: number
  fit_rate: number
  fit_hours: number
  panel_wattage?: number
  panel_qty?: number
  // Item-specific (injected per-evaluation)
  base_price: number
  qty: number
}

export type PartialFormulaScope = Omit<FormulaScope, 'base_price' | 'qty'>

export interface FormulaEvalResult {
  value: number
  error: string | null
}

// ============================================================
// COMPUTED LINE ITEM (runtime, not stored)
// ============================================================

export interface ComputedLineItem {
  id: string            // === instance_id
  instance_id: string   // unique per row (uuid; equals price_item_id for original/virtual instances)
  quote_id: string
  price_item_id: string | null
  is_custom: boolean
  is_duplicate: boolean // true when instance_id !== price_item_id (i.e. a duplicated row)
  is_removable: boolean // true for custom items and duplicate instances
  inclusion_status: InclusionStatus
  is_included: boolean  // computed: true for 'included' and 'provisional_sum'
  category: ItemCategory
  subcategory: string | null
  code: string
  name: string
  unit: string
  qty: number
  manual_qty: number
  calculated_qty: number
  use_calculated_qty: boolean
  use_manual_qty: boolean
  base_unit_price: number
  formula: string | null
  modifier_type: ModifierType
  modifier_value: number
  modifier_note: string | null
  computed_total: number        // after formula + all option group modifiers
  formula_total: number         // formula result before option modifiers (for display)
  default_formula: string | null  // formula stored on the price item
  formula_override: string | null // per-quote override (null = using default)
  active_formula: string | null   // whichever is actually being evaluated
  option_groups: PriceItemOptionGroup[]
  selected_options: Record<string, string> // groupId → optionId
  // Comparison
  comparison_total?: number
  delta?: number
  delta_percent?: number
  sort_order: number
  specData?: Record<string, any>
  type_value?: string
  cost: number
  cost_per_watt: number
  sales_rate: number
  sale_per_watt: number
}

// ============================================================
// QUOTE
// ============================================================

export interface Quote {
  id: string
  quote_number: string
  project_name: string
  status: QuoteStatus
  price_version_id: string
  // Customer (legacy)
  customer_name: string
  customer_company: string | null
  customer_email: string | null
  customer_phone: string | null
  customer_abn: string | null
  // Customer (client_info fields)
  primary_contact?: string
  direct_ph?: string
  email_address?: string
  abn?: string
  is_off_grid?: boolean
  billing_address?: string
  // Site
  site_address: string
  site_suburb: string
  site_state: string
  site_postcode: string
  nmi: string | null
  dnsp: string | null
  // System
  system_kw: number | null
  system_kva: number | null
  has_bess: boolean
  has_ev: boolean
  existing_solar_kw: number
  // Meta
  valid_until: string | null
  internal_notes: string | null
  created_by: string
  assigned_to: string | null
  created_at: string
  updated_at: string
}

export interface QuoteInput {
  id: string
  quote_id: string
  key: string
  value: unknown
}

export interface QuoteLineItem {
  id: string
  quote_id: string
  price_item_id: string | null
  is_custom: boolean
  is_included: boolean
  category: ItemCategory
  subcategory: string | null
  code: string
  name: string
  unit: string
  qty: number
  base_unit_price: number
  formula: string | null
  modifier_type: ModifierType
  modifier_value: number
  modifier_note: string | null
  computed_total: number | null
  sort_order: number
  created_at: string
}

export interface QuoteSnapshot {
  id: string
  quote_id: string
  version_number: number
  snapshot: Record<string, unknown>
  change_note: string | null
  created_by: string
  created_at: string
}

// ============================================================
// DNSP
// ============================================================

export interface DNSPRule {
  id: string
  dnsp_name: string
  state: string
  nmi_prefixes: string[]
  application_fee: number
  export_limit_kw: number | null
  notes: string | null
  rules_json: {
    veec_eligible?: boolean
    connection_study_threshold_kw?: number
    connection_study_fee?: number
    testing_fee?: number
    [key: string]: unknown
  }
}

// ============================================================
// QUOTE EDITOR STORE TYPES
// ============================================================

/**
 * Represents the user-configured state of a single line item row.
 * - Standard items: instance_id === price_item_id (first touch), or a new uuid (duplicate)
 * - Custom items: price_item_id is null
 */
export interface QuoteLineItemState {
  instance_id: string           // unique per row
  price_item_id: string | null  // null for custom items
  inclusion_status: InclusionStatus
  qty: number
  use_calculated_qty?: boolean
  use_manual_qty?: boolean
  // groupId → optionId; only groups the user has explicitly chosen are stored
  selected_options: Record<string, string>
  // null = use the price item's default formula; string = per-quote override
  formula_override: string | null
  modifier_type: ModifierType
  modifier_value: number
  modifier_note: string
  sort_order: number
  // Custom item fields (only when price_item_id === null)
  custom_category?: ItemCategory
  custom_code?: string
  custom_name?: string
  custom_unit?: string
  custom_base_price?: number
  custom_formula?: string | null
}

// Kept for CustomLineItemForm compatibility
export interface CustomLineItem {
  id: string          // client-generated uuid
  category: ItemCategory
  code: string
  name: string
  unit: string
  qty: number
  base_unit_price: number
  formula: string | null
  modifier_type: ModifierType
  modifier_value: number
  modifier_note: string
  sort_order: number
}

export interface SiteDetailsFormData {
  project_name: string
  // Legacy fields (kept for backwards compatibility)
  customer_name: string
  customer_company: string
  customer_email: string
  customer_phone: string
  customer_abn: string
  // New client_info table fields
  primary_contact: string
  direct_ph: string
  email_address: string
  abn: string
  is_off_grid: boolean
  billing_address: string
  // Site fields
  site_address: string
  site_suburb: string
  site_state: string
  site_postcode: string
  nmi: string
  dnsp: string
  valid_until: string
  internal_notes: string
  // Cabling type dropdowns
  dc_cabling_type?: string
  ac_inverter_pvdb_type?: string
  ac_pvdb_msb_type?: string
  cable_tray_type?: string
  trenching_type?: string
  optimisers?: string
  // Manual Markups
  manual_target_markup?: number | null
  manual_minimum_markup?: number | null
  manual_proposed_markup?: number | null
}

// ============================================================
// PDF
// ============================================================

export interface PDFLineItem {
  code: string
  name: string
  qty: number
  unit: string
  unit_price: number
  total: number
  modifier_note?: string
  is_provisional?: boolean
}

export interface PDFRebateItem {
  name: string
  value: number
  assumptions: string
}

export interface PDFQuoteData {
  quoteNumber: string
  projectName: string
  customerName: string
  customerCompany: string
  customerAbn: string
  siteAddress: string
  siteSuburb: string
  siteState: string
  systemKw: number
  systemKva: number
  dnsp: string
  validUntil: string
  generatedDate: string
  includedItems: PDFLineItem[]
  excludedItemNames: string[]
  rebates: PDFRebateItem[]
  totals: {
    subtotal: number
    rebateTotal: number
    netBeforeGST: number
    gst: number
    total: number
  }
  priceVersionName: string
}

// ============================================================
// VERSION COMPARISON
// ============================================================

export interface ComparisonRow {
  code: string
  name: string
  category: ItemCategory
  totalA: number
  totalB: number
  delta: number
  deltaPercent: number
  isNew: boolean
  isRemoved: boolean
  isSignificant: boolean
}
