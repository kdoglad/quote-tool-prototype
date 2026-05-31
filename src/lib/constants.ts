import type { ItemCategory } from '../types/domain.types'

export const CATEGORIES: { value: ItemCategory; label: string; code: string }[] = [
  { value: 'Prelim',        label: 'A. Preliminary',                  code: 'A' },
  { value: 'PV_Components', label: 'B. PV Components',                code: 'B' },
  { value: 'BESS',          label: 'C. Battery Energy Storage',        code: 'C' },
  { value: 'Cabling',       label: 'D. Cabling',                      code: 'D' },
  { value: 'Switchgear',    label: 'E. Switchgear',                   code: 'E' },
  { value: 'Install',       label: 'F. Installation & Logistics',     code: 'F' },
  { value: 'Safety',        label: 'G. Safety & Compliance',          code: 'G' },
  { value: 'Monitoring',    label: 'H. Monitoring & Warranty',        code: 'H' },
  { value: 'AC_Calculation',label: 'I. AC Calculation',                 code: 'I' },
  { value: 'EV',            label: 'J. EV Charging',                  code: 'J' },
  { value: 'Rebates',       label: 'K. Rebates & Incentives',         code: 'K' },
  { value: 'Custom',        label: 'Custom Items',                    code: 'Z' },
]

export const AUSTRALIAN_STATES = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'SA',  label: 'South Australia' },
  { value: 'WA',  label: 'Western Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NT',  label: 'Northern Territory' },
]

export const UNITS = [
  { value: 'ea',  label: 'Each' },
  { value: 'lot', label: 'Lot' },
  { value: 'kW',  label: 'kW' },
  { value: 'kWh', label: 'kWh' },
  { value: 'kVA', label: 'kVA' },
  { value: 'm',   label: 'Metre' },
  { value: 'm2',  label: 'Square Metre' },
  { value: 'hr',  label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'yr',  label: 'Year' },
]

export const INSTALL_TYPES = [
  { value: 'rooftop', label: 'Rooftop' },
  { value: 'ground',  label: 'Ground Mount' },
  { value: 'carport', label: 'Carport / Shade Structure' },
]

export const TRENCH_TYPES = [
  { value: 'none', label: 'No Trenching' },
  { value: 'soft', label: 'Soft Ground' },
  { value: 'hard', label: 'Hard Ground / Concrete / Rock' },
]

// STC zone factors by state (approximate; update quarterly)
export const STC_ZONE_FACTORS: Record<string, number> = {
  NSW: 1.382,
  VIC: 1.185,
  QLD: 1.536,
  SA:  1.382,
  WA:  1.382,
  TAS: 1.000,
  ACT: 1.185,
  NT:  1.690,
}

// Default formula scope defaults (used when a variable is not provided)
export const DEFAULT_SCOPE_VALUES = {
  system_kw:            0,
  system_kva:           0,
  bess_kwh:             0,
  site_state:           '',
  postcode:             '',
  nmi_prefix:           '',
  install_type:         'rooftop' as const,
  has_bess:             false,
  has_ev:               false,
  dc_cable_m:           0,
  ac_cable_m:           20,
  cable_run_m:          20,
  dc_cabling_type:      '',
  ac_inverter_pvdb_type: '',
  ac_pvdb_msb_type:     '',
  cable_tray_type:      '',
  trenching_type:       '',
  trench_m:             0,
  trench_type:          'none' as const,
  trench_depth_m:       0,
  roof_perimeter_m:     0,
  existing_solar_kw:    0,
  dnsp_application_fee: 0,
  dnsp_study_threshold: 30,
  dnsp_study_fee:       0,
  stc_zone_factor:      1.382,
  stc_years:            10,
  stc_price:            38.0,
  lgc_factor:           1.382,
  lgc_price:            45.0,
  veec_count:           0,
  veec_price:           35.0,
  fit_rate:             0,
  fit_hours:            0,
}

export const GST_RATE = 0.10

export const QUOTE_VALIDITY_DAYS = 30

export const AUTOSAVE_INTERVAL_MS = 30_000

export const COMPARISON_SIGNIFICANCE_THRESHOLD = 50 // dollars

export const CATALOG_CATEGORY_OPTIONS = [
  // Section A - Preliminary
  { value: 'prelim_general', label: 'General Prelims', dbCategory: 'Prelim', dbType: 'General', specTable: 'prelim_specs' },
  { value: 'grid_connection', label: 'Grid Connection', dbCategory: 'Prelim', dbType: 'Grid Connection', specTable: 'grid_connection_app_specs' },
  { value: 'grid_protection', label: 'Grid Protection Rules', dbCategory: 'Prelim', dbType: 'Grid Protection', specTable: 'gpu_req_threshold_specs' },
  { value: 'witness_injection', label: 'Witness & Injection Testing', dbCategory: 'Prelim', dbType: 'Witness Injection Testing', specTable: 'witness_injection_testing_specs' },
  
  // Section B - PV Components
  { value: 'panels', label: 'Solar Panels', dbCategory: 'PV_Components', dbType: 'Panel', specTable: 'panel_specs' },
  { value: 'inverters', label: 'Inverters', dbCategory: 'PV_Components', dbType: 'String Inverter', specTable: 'inverter_specs' },
  { value: 'optimisers', label: 'Optimisers', dbCategory: 'PV_Components', dbType: 'Optimiser', specTable: 'optimiser_specs' },
  { value: 'racking', label: 'Primary Racking', dbCategory: 'PV_Components', dbType: 'Racking', specTable: 'racking_specs' },
  { value: 'additional_racking', label: 'Additional Racking', dbCategory: 'PV_Components', dbType: 'Racking', specTable: 'additional_racking_specs' },
  { value: 'inverter_station', label: 'Inverter Stations', dbCategory: 'PV_Components', dbType: 'Inverter Station', specTable: 'inverter_station_specs' },
  { value: 'pvdb', label: 'PV Distribution Boards', dbCategory: 'PV_Components', dbType: 'PVDB', specTable: 'pvdb_specs' },
  { value: 'pfc', label: 'Power Factor Correction', dbCategory: 'PV_Components', dbType: 'PFC', specTable: 'pfc_specs' },
  { value: 'netnada', label: 'NetNada Base Plans', dbCategory: 'Monitoring', dbType: 'NetNada', specTable: 'netnada_specs' },
  { value: 'netnada_addons', label: 'NetNada Addons', dbCategory: 'Monitoring', dbType: 'NetNada Addon', specTable: 'netnada_addons_specs' },
  { value: 'harm_filtering', label: 'Harm Filtering', dbCategory: 'PV_Components', dbType: 'Harm Filtering', specTable: 'harm_filtering_specs' },

  // Section C - Battery Energy Storage
  { value: 'batteries', label: 'Batteries', dbCategory: 'BESS', dbType: 'Battery', specTable: 'battery_specs' },
  { value: 'battery_inverter', label: 'Battery Inverters (PCS)', dbCategory: 'BESS', dbType: 'Battery Inverter', specTable: 'battery_inverter_specs' },
  { value: 'bessdb', label: 'BESS Distribution Boards', dbCategory: 'BESS', dbType: 'BESSDB', specTable: 'bessdb_specs' },

  // Section D - Cabling
  { value: 'dc_twin_cabling', label: 'Twin DC Cabling', dbCategory: 'Cabling', dbType: 'Twin DC Cabling', specTable: 'dc_twin_cabling_specs' },
  { value: 'cabling_addons', label: 'Cabling Addons', dbCategory: 'Cabling', dbType: 'Cabling Addon', specTable: 'cabling_addons_specs' },

  // Section E - Switchgear
  { value: 'switch_gear', label: 'General Switchgear', dbCategory: 'Switchgear', dbType: 'General', specTable: 'switch_gear_specs' },
  { value: 'ac_combiner', label: 'AC Combiner', dbCategory: 'Switchgear', dbType: 'AC Combiner', specTable: 'ac_combiner_specs' },
  { value: 'dc_combiner', label: 'DC Combiner', dbCategory: 'Switchgear', dbType: 'DC Combiner', specTable: 'dc_combiner_specs' },
  { value: 'ac_breaker', label: 'AC Breakers', dbCategory: 'Switchgear', dbType: 'AC Breaker', specTable: 'ac_breaker_specs' },

  // Section F - Installation & Logistics
  { value: 'install', label: 'Installation Items', dbCategory: 'Install', dbType: 'Installation', specTable: 'install_specs' },
  { value: 'lifting', label: 'Lifting Equipment/Battery Install', dbCategory: 'Install', dbType: 'Lifting', specTable: 'lifting_specs' },
  { value: 'travel_accoms_freight', label: 'Travel/Accoms/Freight', dbCategory: 'Install', dbType: 'Logistics', specTable: 'travel_accoms_freight_specs' },

  // Section G - Safety & Compliance
  { value: 'safety', label: 'Safety Specs', dbCategory: 'Safety', dbType: 'Safety', specTable: 'safety_specs' },

  // Section H - Monitoring & Warranty
  { value: 'monitoring_warranty', label: 'Monitoring/Warranty', dbCategory: 'Monitoring', dbType: 'Warranty', specTable: 'monitoring_warranty_specs' },
  { value: 'monitoring_addons', label: 'Monitoring Addons', dbCategory: 'Monitoring', dbType: 'Monitoring Addon', specTable: 'monitoring_addons_specs' },
];

export const PREFIX_MAP: Record<string, string> = {
  prelim_general: 'PRL',
  grid_connection: 'GRD',
  grid_protection: 'GPU',
  witness_injection: 'WIT',
  panels: 'PNL',
  inverters: 'INV',
  optimisers: 'OPT',
  racking: 'RCK',
  additional_racking: 'ADR',
  inverter_station: 'IST',
  pvdb: 'PVD',
  pfc: 'PFC',
  netnada: 'NET',
  netnada_addons: 'NTA',
  harm_filtering: 'HRM',
  batteries: 'BAT',
  battery_inverter: 'PCS',
  bessdb: 'BDB',
  ac_cabling: 'CAB',
  ac_combiner: 'ACC',
  dc_combiner: 'DCC',
  dc_twin_cabling: 'DTC',
  cabling_addons: 'CBA',
  switch_gear: 'SWG',
  ac_breaker: 'ACB',
  install: 'INS',
  lifting: 'LFT',
  travel_accoms_freight: 'LOG',
  safety: 'SAF',
  monitoring_warranty: 'MON',
  monitoring_addons: 'MOA',
};
