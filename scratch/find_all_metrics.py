import re, os

patterns = [r"PR-AUC", r"Brier", r"BSS", r"Skill", r"0\.\d{3,4}"]
root = "."

matches = []
for dirpath, _, filenames in os.walk(root):
    if any(x in dirpath for x in [".git", "node_modules", ".gemini", "dist"]):
        continue
    for f in filenames:
        if f.endswith((".md", ".json", ".yaml", ".py")):
            p = os.path.join(dirpath, f)
            with open(p, "r", encoding="utf-8", errors="ignore") as fh:
                for idx, line in enumerate(fh):
                    if any(re.search(pat, line, re.IGNORECASE) for pat in ["PR-AUC", "brier_skill", "brier_score"]):
                        matches.append((p, idx + 1, line.strip()))

for m in matches[:30]:
    print(m)
