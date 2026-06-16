import csv

with open("formulas_extracted.csv", mode="r", encoding="utf-8", errors="ignore") as f:
    reader = csv.reader(f)
    headers = next(reader)
    print("Headers:", headers)
    count = 0
    for row in reader:
        row_str = " | ".join(row)
        if "cabling" in row_str.lower() or "cable" in row_str.lower():
            print(f"Row {count}: {row_str[:200]}")
            count += 1
            if count > 20:
                break
