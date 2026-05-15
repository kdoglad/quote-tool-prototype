// Uses PostgREST's "column-not-found" error response to discover valid column names
// by trying to select a fake column — the error message includes the valid options.
// This works with anon key + no data in the table.

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
    // Select a guaranteed non-existent column — PostgREST will error and hint at valid columns
    const reqPath = `/rest/v1/${table}?select=__fake_col__`;
    const options = {
      hostname: HOST,
      path: reqPath,
      method: 'GET',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Accept: 'application/json',
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // PostgREST error format: { code, details, hint, message }
          // message is like: "column t.__fake_col__ does not exist"
          // hint is like: "Perhaps you meant to reference the column \"t.brand\"."
          // But for list of columns we need a different approach...
          // Actually PostgREST returns 400 with message containing the available columns in some versions
          resolve({ table, message: parsed.message, hint: parsed.hint, details: parsed.details, code: parsed.code });
        } catch(e) {
          resolve({ table, raw: data.substring(0, 200) });
        }
      });
    });
    req.on('error', e => resolve({ table, net_error: e.message }));
    req.end();
  });
}

// Better approach: use the /rest/v1/ with Authorization: Bearer <service_role> to get the full schema
// But we only have anon key. Instead, let's try the Supabase Management API-style endpoint.
// PostgREST actually exposes column info via the root endpoint with Accept: application/openapi+json
// but only for the service role. 

// Alternative: INSERT with all nulls and read the NOT NULL constraint error which lists the column name.
// Even better: use the Supabase REST endpoint with ?columns= param (PostgREST 10+)

function getColumnsViaInsertError(table) {
  return new Promise((resolve) => {
    // POST an empty object — the NOT NULL constraints will fire and tell us column names
    const body = JSON.stringify({});
    const options = {
      hostname: HOST,
      path: `/rest/v1/${table}`,
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(body),
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ table, status: res.statusCode, ...parsed });
        } catch(e) {
          resolve({ table, status: res.statusCode, raw: data.substring(0, 300) });
        }
      });
    });
    req.on('error', e => resolve({ table, net_error: e.message }));
    req.write(body);
    req.end();
  });
}

const TABLES = [
  'panel_specs', 'inverter_specs', 'battery_specs', 'grid_connection_app_specs',
  'prelim_specs', 'gpu_req_threshold_specs', 'optimiser_specs', 'racking_specs',
  'additional_racking_specs', 'inverter_station_specs', 'pvdb_specs', 'pfc_specs',
  'netnada_specs', 'netnada_addons_specs', 'harm_filtering_specs', 'battery_inverter_specs',
  'bessdb_specs', 'ac_cabling_specs', 'dc_cabling_specs', 'cabling_addons_specs',
  'switch_gear_specs', 'ac_breaker_specs', 'install_specs', 'lifting_specs',
  'travel_accoms_freight_specs', 'safety_specs', 'monitoring_warranty_specs', 'monitoring_addons_specs'
];

async function main() {
  console.log('Probing table columns via insert error responses...\n');
  
  for (const table of TABLES) {
    const r = await getColumnsViaInsertError(table);
    console.log(`\n--- ${table} (HTTP ${r.status}) ---`);
    if (r.message) console.log('message:', r.message);
    if (r.hint)    console.log('hint:   ', r.hint);
    if (r.details) console.log('details:', r.details);
    if (r.raw)     console.log('raw:    ', r.raw);
    if (r.net_error) console.log('error:  ', r.net_error);
  }
}

main().catch(console.error);
