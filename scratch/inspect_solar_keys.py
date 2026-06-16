import json

with open("full_quote_logic.json", "r", encoding="utf-8") as f:
    data = json.load(f)

sheets = data.get("sheets", {})
solar = sheets.get("SOLAR", {})
print("SOLAR keys:", list(solar.keys()))
for k, v in solar.items():
    if isinstance(v, list):
        print(f"Key '{k}' is a list of length {len(v)}")
        if len(v) > 0:
            print("First item:", v[0])
    elif isinstance(v, dict):
        print(f"Key '{k}' is a dict of length {len(v)}")
        print("First few keys:", list(v.keys())[:5])
