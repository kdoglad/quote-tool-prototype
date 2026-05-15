// Signs in as admin and reads column names for all spec tables via REST API
const https = require('https');
const fs = require('fs');
const path = require('path');

const envVars = {};
fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) envVars[k.trim()] = v.join('=').trim();
});

const SUPABASE_URL = envVars['VITE_SUPABASE_URL'];
const KEY = envVars['VITE_SUPABASE_ANON_KEY'];
const HOST = SUPABASE_URL.replace('https://', '');
const EMAIL = 'admin@sce.com';
const PASSWORD = 'scepword123!';

function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function signIn() {
  const body = JSON.stringify({ email: EMAIL, password: PASSWORD });
  const res = await httpsRequest({
    hostname: HOST,
    path: '/auth/v1/token?grant_type=password',
    method: 'POST',
    headers: {
      apikey: KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    }
  }, body);
  if (!res.data.access_token) throw new Error('Login failed: ' + JSON.stringify(res.data));
  return res.data.access_token;
}

async function getColumns(jwt, table) {
  const res = await httpsRequest({
    hostname: HOST,
    path: `/rest/v1/${table}?limit=1&select=*`,
    method: 'GET',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/json',
    }
  });
  if (Array.isArray(res.data) && res.data.length > 0) {
    return Object.keys(res.data[0]);
  }
  // Table is empty — try INSERT with empty body to get constraint errors that reveal columns
  const insertRes = await httpsRequest({
    hostname: HOST,
    path: `/rest/v1/${table}`,
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
      'Content-Length': 2,
    }
  }, '{}');
  return { empty: true, error: insertRes.data };
}

const SPEC_TABLES = [
  { cat: 'prelim_general',        table: 'prelim_specs' },
  { cat: 'grid_connection',       table: 'grid_connection_app_specs' },
  { cat: 'grid_protection',       table: 'gpu_req_threshold_specs' },
  { cat: 'panels',                table: 'panel_specs' },
  { cat: 'inverters',             table: 'inverter_specs' },
  { cat: 'optimisers',            table: 'optimiser_specs' },
  { cat: 'racking',               table: 'racking_specs' },
  { cat: 'additional_racking',    table: 'additional_racking_specs' },
  { cat: 'inverter_station',      table: 'inverter_station_specs' },
  { cat: 'pvdb',                  table: 'pvdb_specs' },
  { cat: 'pfc',                   table: 'pfc_specs' },
  { cat: 'netnada',               table: 'netnada_specs' },
  { cat: 'netnada_addons',        table: 'netnada_addons_specs' },
  { cat: 'harm_filtering',        table: 'harm_filtering_specs' },
  { cat: 'batteries',             table: 'battery_specs' },
  { cat: 'battery_inverter',      table: 'battery_inverter_specs' },
  { cat: 'bessdb',                table: 'bessdb_specs' },
  { cat: 'ac_cabling',            table: 'ac_cabling_specs' },
  { cat: 'dc_cabling',            table: 'dc_cabling_specs' },
  { cat: 'cabling_addons',        table: 'cabling_addons_specs' },
  { cat: 'switch_gear',           table: 'switch_gear_specs' },
  { cat: 'ac_breaker',            table: 'ac_breaker_specs' },
  { cat: 'install',               table: 'install_specs' },
  { cat: 'lifting',               table: 'lifting_specs' },
  { cat: 'travel_accoms_freight', table: 'travel_accoms_freight_specs' },
  { cat: 'safety',                table: 'safety_specs' },
  { cat: 'monitoring_warranty',   table: 'monitoring_warranty_specs' },
  { cat: 'monitoring_addons',     table: 'monitoring_addons_specs' },
];

const UI_FIELDS = {
  prelim_general:        ['item_id', 'item_code', 'item_name', 'item_type', 'price_total'],
  grid_connection:       ['item_id', 'item_code', 'dnsp', 'state', 'low_size_kva', 'high_side_kva', 'app_fee_tech_assessment', 'total_network_fee', 'additional_cost', 'hv_site_variation', 'full_export_variation', 'is_bess_only', 'is_solar_or_solar_bess', 'preliminary_enquiry', 'is_project_needed', 'notes'],
  grid_protection:       ['item_id', 'item_code', 'dnsp', 'required_over_kva', 'is_export_limit_enforced'],
  panels:                ['item_id', 'item_code', 'item_name', 'brand', 'wattage', 'cost_per_watt', 'item_type', 'product_warranty', 'performance_warranty', 'is_local_stock', 'datasheet_code'],
  inverters:             ['item_id', 'item_code', 'brand', 'model', 'watt', 'cost_per_watt', 'warranty_years'],
  optimisers:            ['item_id', 'item_code', 'optimiser_name', 'size_va', 'price_per_unit'],
  racking:               ['item_id', 'item_code', 'racking_type', 'cost_per_panel'],
  additional_racking:    ['item_id', 'item_code', 'item_name', 'cost_per_item', 'unit'],
  inverter_station:      ['item_id', 'item_code', 'inverter_station', 'inverter_station_cost_per_unit'],
  pvdb:                  ['item_id', 'item_code', 'pvdb_type', 'export_limited_price', 'full_export_price'],
  pfc:                   ['item_id', 'item_code', 'pfc_type', 'price_per_unit'],
  netnada:               ['item_id', 'item_code', 'payment_plan', 'plan_type', 'price'],
  netnada_addons:        ['item_id', 'item_code', 'item_name', 'payment_plan', 'price'],
  harm_filtering:        ['item_id', 'item_code', 'item_name', 'item_type', 'price_per_unit'],
  batteries:             ['item_id', 'item_code', 'item_name', 'brand', 'nominal_kwh', 'battery_price_fwb', 'product_warranty', 'performance_warranty', 'is_pcs_included', 'suggested_pcs'],
  battery_inverter:      ['item_id', 'item_code', 'item_name', 'brand', 'kva', 'pcs_price_excl_gst'],
  bessdb:                ['item_id', 'item_code', 'bessdb_type', 'export_limited_price', 'full_export_price'],
  ac_cabling:            ['item_id', 'item_code', 'cable_type', 'size_mm2', 'conductor_material', 'price_per_type'],
  dc_cabling:            ['item_id', 'item_code', 'cable_type', 'size_mm2', 'conductor_material', 'price_per_type'],
  cabling_addons:        ['item_id', 'item_code', 'item_name', 'addon_type', 'cost_per_meter'],
  switch_gear:           ['item_id', 'item_code', 'item_name', 'item_type', 'total_price'],
  ac_breaker:            ['item_id', 'item_code', 'name', 'breaker_type', 'rating_a', 'price_per_breaker'],
  install:               ['item_id', 'item_code', 'install_item', 'item_type', 'price', 'unit'],
  lifting:               ['item_id', 'item_code', 'name', 'lifting_type', 'cost_per_time', 'number_of_lifts', 'establishments', 'is_battery_install', 'unit'],
  travel_accoms_freight: ['item_id', 'item_code', 'travel', 'accom', 'freight', 'distance_frm_city_center', 'travel_rates'],
  safety:                ['item_id', 'item_code', 'item_name', 'item_type', 'price', 'unit'],
  monitoring_warranty:   ['item_id', 'item_code', 'item_name', 'item_type', 'price', 'unit'],
  monitoring_addons:     ['item_id', 'item_code', 'item_name', 'item_type', 'price', 'unit'],
};

const IGNORE = new Set(['id', 'created_at', 'updated_at', 'version_id', 'spec_id']);

async function main() {
  console.log('Signing in...');
  const jwt = await signIn();
  console.log('Authenticated ✅\n');
  console.log('══════════════════════════════════════════════════════');
  console.log('  UI vs DATABASE FIELD AUDIT');
  console.log('══════════════════════════════════════════════════════\n');

  let allGood = true;
  for (const { cat, table } of SPEC_TABLES) {
    const result = await getColumns(jwt, table);

    if (result && result.empty) {
      const err = result.error;
      console.log(`⚪ ${cat.padEnd(25)} → ${table}`);
      console.log(`   ↳ Table is empty. Insert error: ${err?.message || JSON.stringify(err).substring(0,100)}`);
      continue;
    }

    if (!Array.isArray(result)) {
      console.log(`❌ ${cat.padEnd(25)} → ${table} — Unexpected result: ${JSON.stringify(result).substring(0,100)}`);
      allGood = false;
      continue;
    }

    const dbCols = result.filter(c => !IGNORE.has(c));
    const uiCols = (UI_FIELDS[cat] || []).filter(c => !IGNORE.has(c));
    const missingFromUI = dbCols.filter(c => !uiCols.includes(c));
    const extraInUI     = uiCols.filter(c => !dbCols.includes(c));

    if (missingFromUI.length === 0 && extraInUI.length === 0) {
      console.log(`✅  ${cat.padEnd(25)} → ${table}`);
    } else {
      allGood = false;
      console.log(`⚠️   ${cat.padEnd(25)} → ${table}`);
      if (missingFromUI.length) console.log(`     📥 DB has but UI is MISSING: [${missingFromUI.join(', ')}]`);
      if (extraInUI.length)     console.log(`     📤 UI sends but NOT in DB:   [${extraInUI.join(', ')}]`);
    }
  }

  if (allGood) console.log('\n🎉 All categories perfectly match!');
  else console.log('\n⬆️  Fix the issues above.');
}

main().catch(console.error);
