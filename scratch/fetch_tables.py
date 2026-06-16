import urllib.request
import json

url = "https://nquvmdynrmmfzagpjlks.supabase.co/rest/v1/?apikey=sb_publishable_DEoEZe6bwXgb16d8U6lhSQ_BxoEVPsr"
req = urllib.request.Request(url)
try:
    with urllib.request.urlopen(req) as response:
        html = response.read()
        openapi = json.loads(html)
        print("TABLES IN SUPABASE:")
        for table in sorted(openapi.get("definitions", {}).keys()):
            print(table)
except Exception as e:
    print("Error:", e)
