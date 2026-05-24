// Fetches column names for each spec table via Supabase REST API
// by requesting ?select=* with limit=1 and reading the column keys from the JSON response
// This works with the anon key since these tables have RLS with SELECT enabled

const https = require('https');
const fs = require('fs');
const path = require('path');

const envVars = {};
fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) envVars[k.trim()] = v.join('=').trim();
});

const HOST = envVars['VITE_SUPABASE_URL'].replace('https://', '');
const KEY  = envVars['VITE_SUPABASE_ANON_KEY'];

function getColumns(table) {
  return new Promise((resolve) => {
    // Insert a dummy row to discover columns via "prefer: return=representation" — but simpler:
    // Just request the table with limit=1 and read the JSON keys. If empty, use column-definition endpoint.
    const reqPath = `/rest/v1/${table}?limit=1&select=*`;
    const options = {
      hostname: HOST,
      path: reqPath,
      method: 'GET',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Accept: 'application/json',
        'Accept-Profile': 'public',
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const rows = JSON.parse(data);
          if (Array.isArray(rows) && rows.length > 0) {
            resolve({ table, cols: Object.keys(rows[0]), status: 'data' });
          } else if (Array.isArray(rows) && rows.length === 0) {
            // Table is empty — try to get columns via a forced error select of a fake col
            // which returns a meaningful error with valid column names hinted
            resolve({ table, cols: null, status: 'empty' });
          } else {
            resolve({ table, cols: null, status: 'error', raw: data.substring(0,100) });
          }
        } catch(e) {
          resolve({ table, cols: null, status: 'parse_error', raw: data.substring(0,100) });
        }
      });
    });
    req.on('error', e => resolve({ table, cols: null, status: 'net_error', raw: e.message }));
    req.end();
  });
}

// For empty tables, try to force a column list by using a columns= param trick (PostgREST exposes them)
function getColumnsViaHead(table) {
  return new Promise((resolve) => {
    const reqPath = `/rest/v1/${table}?limit=0`;
    const options = {
      hostname: HOST,
      path: reqPath,
      method: 'GET',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Accept: 'application/json',
        'Prefer': 'count=exact',
      }
    };
    const req = https.request(options, res => {
      // PostgREST doesn't expose column names for empty tables via REST easily.
      // But we can try to select a guaranteed-non-existent col and read the error hint.
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({ table, status: 'empty_confirmed', raw: data.substring(0, 200) });
      });
    });
    req.on('error', e => resolve({ table, status: 'net_error', raw: e.message }));
    req.end();
  });
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

async function main() {
  console.log('Fetching column data from Supabase...\n');
  const results = await Promise.all(SPEC_TABLES.map(({ cat, table }) => getColumns(table)));
  
  results.forEach(r => {
    if (r.status === 'data') {
      const IGNORE = new Set(['id','created_at','updated_at','version_id','spec_id']);
      const cols = r.cols.filter(c => !IGNORE.has(c));
      console.log(`✅ ${r.table}`);
      console.log(`   Columns: ${cols.join(', ')}\n`);
    } else if (r.status === 'empty') {
      console.log(`⚪ ${r.table} — table exists but is EMPTY (can't read columns)`);
    } else {
      console.log(`❌ ${r.table} — ${r.status}: ${r.raw || ''}`);
    }
  });
}

main().catch(console.error);
