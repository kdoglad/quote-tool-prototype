import urllib.request
import json

url = "https://nquvmdynrmmfzagpjlks.supabase.co/rest/v1/audit_log?select=*"
headers = {
    "apikey": "sb_publishable_DEoEZe6bwXgb16d8U6lhSQ_BxoEVPsr",
    "Authorization": "Bearer sb_publishable_DEoEZe6bwXgb16d8U6lhSQ_BxoEVPsr"
}
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read())
        print(f"Total audit logs: {len(data)}")
        for idx, d in enumerate(data):
            nd = d.get("new_data", {})
            items = nd.get("items", [])
            version_name = nd.get("version_name", "Unknown")
            print(f"Log {idx}: ID: {d.get('id')} | AuditID: {d.get('audit_id')} | Version: {version_name} | Items Count: {len(items)}")
            if len(items) > 0:
                print("First few items in this version:")
                for item in items[:5]:
                    cat = item.get("catalog_data", {})
                    spec = item.get("spec_data", {})
                    print(f"  Code: {cat.get('item_code')} | Name: {cat.get('item_name')} | Type: {cat.get('item_type')}")
except Exception as e:
    print("Error:", e)
