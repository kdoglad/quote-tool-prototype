import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: ac, error: e1 } = await supabase.from('ac_cabling_specs').select('*').limit(5);
  console.log('ac_cabling_specs:', ac, e1);
  const { data: dc, error: e2 } = await supabase.from('twin_dc_cabling_specs').select('*').limit(5);
  console.log('twin_dc_cabling_specs:', dc, e2);
}
check();
