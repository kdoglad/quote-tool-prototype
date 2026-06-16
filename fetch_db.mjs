import fs from 'fs';
import path from 'path';

let envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  envPath = path.join(process.cwd(), '.env');
}
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[2].replace('\r', '');
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

async function fetchDb() {
  const res = await fetch(`${supabaseUrl}/rest/v1/audit_log?select=price_version,new_data&order=created_at.desc&limit=5`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const data = await res.json();
  data.forEach(row => {
    const acMap = row.new_data?.ac_map;
    console.log(`Version: ${row.price_version} | has ac_map: ${!!acMap} | ac_map length: ${acMap ? acMap.length : 0}`);
  });
}

fetchDb();
