import urllib.request
import json

url = "https://nquvmdynrmmfzagpjlks.supabase.co/rest/v1/catalog_items?select=*"
headers = {
    "apikey": "sb_publishable_DEoEZe6bwXgb16d8U6lhSQ_BxoEVPsr",
    "Authorization": "Bearer sb_publishable_DEoEZe6bwXgb16d8U6lhSQ_BxoEVPsr"
}
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read())
        print(f"Total catalog items: {len(data)}")
        cabling = [d for d in data if "cabling" in str(d).lower() or "cable" in str(d).lower()]
        print(f"Cabling items count: {len(cabling)}")
        for c in cabling[:10]:
            print(c)
except Exception as e:
    print("Error:", e)
