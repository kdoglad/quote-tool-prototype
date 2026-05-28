import json

with open("full_quote_logic.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print("Keys in full_quote_logic.json:")
print(list(data.keys())[:10])

# Let's inspect first few entries of whatever list is inside
for k, v in data.items():
    if isinstance(v, list):
        print(f"Key '{k}' is a list of length {len(v)}")
        if len(v) > 0:
            print("First item sample:")
            print(json.dumps(v[0], indent=2)[:300])
    elif isinstance(v, dict):
        print(f"Key '{k}' is a dict of length {len(v)}")
        print("First key sample:", list(v.keys())[:5])
