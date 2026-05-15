import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envRaw = fs.readFileSync('.env', 'utf-8')
let url = ''
let key = ''
for (const line of envRaw.split('\n')) {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim().replace('/rest/v1/', '')
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim()
}

const supabase = createClient(url, key)

async function check() {
    console.log("Fetching table columns...")
    const { data: logData, error: logErr } = await supabase.from('audit_log').select('*').limit(1)
    if (logErr) {
        console.error("Select failed:", logErr.message)
    } else {
        console.log("Data keys:", logData && logData[0] ? Object.keys(logData[0]) : "No data")
    }
}

check()
