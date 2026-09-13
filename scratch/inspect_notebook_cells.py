import json

with open('notebooks/KYNTRA_02_BASELINE.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

for idx, cell in enumerate(nb.get('cells', [])):
    source = "".join(cell.get('source', []))
    if 'brier' in source.lower() or 'pr_auc' in source.lower() or 'result' in source.lower():
        print(f"=== Cell {idx} ({cell.get('cell_type')}) ===")
        print(source[:500])
        for out in cell.get('outputs', []):
            if 'text' in out:
                print("--- OUTPUT ---")
                print("".join(out['text'])[:500])
            elif 'data' in out and 'text/plain' in out['data']:
                print("--- DATA OUTPUT ---")
                print("".join(out['data']['text/plain'])[:500])
