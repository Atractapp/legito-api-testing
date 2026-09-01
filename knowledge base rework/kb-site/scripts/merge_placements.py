import json, glob, os, io, sys, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
S = r"C:\Users\edous\AppData\Local\Temp\claude\C--Legito-Test\c62ce0eb-2336-4666-9906-3b16ad4a3188\scratchpad"
MD = r"C:\Legito Test\knowledge base rework\KB2026\md"
live = json.load(open(rf"{S}\live_map.json", encoding="utf-8"))

merged = {}
problems = []
for f in sorted(glob.glob(rf"{S}\placeout\batch-*.json")):
    d = json.load(open(f, encoding="utf-8"))
    for rel, placements in d.items():
        if rel not in live:
            problems.append(f"{os.path.basename(f)}: unknown article {rel}")
            continue
        expected = [im["src"] for im in live[rel]["images"]]
        got = [p["src"] for p in placements]
        if sorted(expected) != sorted(got):
            problems.append(f"{os.path.basename(f)}: {rel}: image set mismatch (expected {len(expected)}, got {len(got)})")
            continue
        # validate anchors against article headings
        md = open(os.path.join(MD, rel), encoding="utf-8").read()
        heads = {h.strip().lower() for h in re.findall(r"^#{2,3}\s+(.+)$", md, re.M)}
        bad = [p["anchor"] for p in placements
               if p["anchor"] not in ("intro", "end") and p["anchor"].strip().lower() not in heads]
        if bad:
            problems.append(f"{os.path.basename(f)}: {rel}: unknown anchors {bad}")
            continue
        # order: keep live order
        order = {src: i for i, src in enumerate(expected)}
        merged[rel] = sorted(placements, key=lambda p: order[p["src"]])

out = rf"C:\Legito Test\knowledge base rework\kb-site\data\placement_overrides.json"
json.dump(merged, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
n_img = sum(len(v) for v in merged.values())
n_end = sum(1 for v in merged.values() for p in v if p["anchor"] == "end")
n_intro = sum(1 for v in merged.values() for p in v if p["anchor"] == "intro")
print(f"merged: {len(merged)} articles, {n_img} images ({n_intro} intro, {n_end} end)")
print(f"articles with live images total: {sum(1 for v in live.values() if v.get('images'))}")
if problems:
    print("PROBLEMS:")
    for p in problems: print(" ", p)
else:
    print("no problems")
