import json

with open('notebooks/KYNTRA_02_BASELINE.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb.get('cells', []):
    for out in cell.get('outputs', []):
        text = "".join(out.get('text', []))
        if 'brier' in text.lower() or 'pr_auc' in text.lower():
            print("--- CELL OUTPUT ---")
            print(text[:1000])
