import os
import requests

env_file = ".env"
supabase_url = ""
supabase_key = ""

with open(env_file, "r") as f:
    for line in f:
        if line.startswith("VITE_SUPABASE_URL="):
            supabase_url = line.strip().split("=")[1].strip("'\"")
        elif line.startswith("VITE_SUPABASE_ANON_KEY="):
            supabase_key = line.strip().split("=")[1].strip("'\"")

headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}"
}

print("ac_cabling_specs:")
res = requests.get(f"{supabase_url}/rest/v1/ac_cabling_specs?select=*", headers=headers)
print(res.json())

print("dc_twin_cabling_specs:")
res = requests.get(f"{supabase_url}/rest/v1/dc_twin_cabling_specs?select=*", headers=headers)
print(res.json())
