import json

with open("full_quote_logic.json", "r", encoding="utf-8") as f:
    data = json.load(f)

sheets = data.get("sheets", {})
solar = sheets.get("SOLAR", {})
rows = solar.get("rows", [])

print("SOLAR sheet rows 48 to 52 data:")
for idx, row in enumerate(rows):
    row_num = idx + 1
    if 45 <= row_num <= 55:
        print(f"Row {row_num}: {row}")
