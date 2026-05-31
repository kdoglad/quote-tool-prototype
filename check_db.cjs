const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '.env.local');
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
} else {
  envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
}

const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAcMap() {
  const { data, error } = await supabase
    .from('audit_log')
    .select('audit_id, action, price_version, new_data')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error(error);
    return;
  }

  data.forEach(row => {
    const acMap = row.new_data?.ac_map;
    console.log(`Version: ${row.price_version} | Action: ${row.action} | has ac_map: ${!!acMap} | ac_map length: ${acMap ? acMap.length : 0}`);
  });
}

checkAcMap();
