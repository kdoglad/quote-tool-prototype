require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkTables() {
  const { data, error } = await supabase.rpc('get_tables'); // Or try selecting from pg_class if RPC doesn't exist
  
  // Since we don't know if get_tables RPC exists, let's use the REST API via fetch
  const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/?apikey=${process.env.VITE_SUPABASE_ANON_KEY}`);
  const openapi = await res.json();
  
  console.log("TABLES IN SUPABASE:");
  Object.keys(openapi.definitions || {}).forEach(table => console.log(table));
}

checkTables().catch(console.error);
