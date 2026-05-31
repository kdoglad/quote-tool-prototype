import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envText = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf-8') : fs.readFileSync('.env', 'utf-8');
const env = envText.split('\n').reduce((acc, line) => {
  const [k, v] = line.split('=');
  if (k && v) acc[k.trim()] = v.trim();
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const defaultMap = [
  { size_mm2: 1.5, copper_single_core: null, copper_4c_e: 1.69, alu_single_core: null, alu_4c_e: null },
  { size_mm2: 2.5, copper_single_core: null, copper_4c_e: 2.91, alu_single_core: null, alu_4c_e: null },
  { size_mm2: 4, copper_single_core: null, copper_4c_e: 4.45, alu_single_core: null, alu_4c_e: null },
  { size_mm2: 6, copper_single_core: null, copper_4c_e: 6.04, alu_single_core: null, alu_4c_e: null },
  { size_mm2: 10, copper_single_core: null, copper_4c_e: 11.19, alu_single_core: null, alu_4c_e: null },
  { size_mm2: 16, copper_single_core: null, copper_4c_e: 16.94, alu_single_core: null, alu_4c_e: null },
  { size_mm2: 25, copper_single_core: 5.81, copper_4c_e: 24.99, alu_single_core: 1.83, alu_4c_e: null },
  { size_mm2: 35, copper_single_core: 7.96, copper_4c_e: 35.35, alu_single_core: 1.98, alu_4c_e: null },
  { size_mm2: 50, copper_single_core: 11.07, copper_4c_e: 47.97, alu_single_core: 3.48, alu_4c_e: 15.75 },
  { size_mm2: 70, copper_single_core: 15.17, copper_4c_e: 66.49, alu_single_core: 3.77, alu_4c_e: 16.89 },
  { size_mm2: 95, copper_single_core: 20.01, copper_4c_e: 85.84, alu_single_core: 4.40, alu_4c_e: 19.59 },
  { size_mm2: 120, copper_single_core: 25.39, copper_4c_e: 109.51, alu_single_core: 5.47, alu_4c_e: 25.36 },
  { size_mm2: 150, copper_single_core: 31.34, copper_4c_e: 136.43, alu_single_core: 6.70, alu_4c_e: 30.28 },
  { size_mm2: 185, copper_single_core: 41.90, copper_4c_e: 182.77, alu_single_core: 8.21, alu_4c_e: 36.62 },
  { size_mm2: 240, copper_single_core: 51.11, copper_4c_e: 224.45, alu_single_core: 10.91, alu_4c_e: 48.06 },
  { size_mm2: 300, copper_single_core: 64.75, copper_4c_e: 284.38, alu_single_core: 13.45, alu_4c_e: 59.27 },
  { size_mm2: 400, copper_single_core: 83.41, copper_4c_e: 359.03, alu_single_core: 17.04, alu_4c_e: 76.36 }
];

async function seed() {
  const { data, error } = await supabase.from('ac_map_specs').select('*');
  if (error) {
    console.error('Error fetching:', error);
    return;
  }
  
  if (data.length === 0) {
    console.log('Table is empty. Inserting default map...');
    const { error: insErr } = await supabase.from('ac_map_specs').insert({ ac_map: defaultMap });
    if (insErr) console.error('Insert error:', insErr);
    else console.log('Successfully inserted default AC map!');
  } else {
    console.log('Table already has data. Skipping seed.');
  }
}

seed();
