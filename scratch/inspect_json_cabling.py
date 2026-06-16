import json

with open("full_quote_logic.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# Find all price items where category or subcategory is Cabling or contains cable
price_items = data.get("priceItems", [])
print(f"Total price items: {len(price_items)}")

cabling_items = []
for item in price_items:
    cat = item.get("category", "")
    subcat = item.get("subcategory", "")
    code = item.get("code", "")
    name = item.get("name", "")
    if "cabling" in cat.lower() or "cabling" in subcat.lower() or "cable" in name.lower() or "cable" in code.lower():
        cabling_items.append(item)

print(f"Found {len(cabling_items)} cabling items:")
for item in cabling_items[:15]:
    print(f"ID: {item.get('id')} | Code: {item.get('code')} | Name: {item.get('name')} | Cat: {item.get('category')} | Subcat: {item.get('subcategory')} | Formula: {item.get('formula')} | BasePrice: {item.get('base_price')}")
