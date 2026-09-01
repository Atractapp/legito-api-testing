"""Map live KB articles to KB2026 md files; download live images/videos into the site's public dir."""
import json, os, re, sys, io, unicodedata, urllib.request, urllib.parse, hashlib, html as htmllib

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
S = r"C:\Users\edous\AppData\Local\Temp\claude\C--Legito-Test\c62ce0eb-2336-4666-9906-3b16ad4a3188\scratchpad"
MD = r"C:\Legito Test\knowledge base rework\KB2026\md"
SITE = r"C:\Legito Test\knowledge base rework\kb-site"
LIVE_DIR = os.path.join(SITE, "public", "live")

live = json.load(open(f"{S}/live_kb.json", encoding="utf-8"))

def norm(t):
    t = htmllib.unescape(t)
    t = unicodedata.normalize("NFKD", t)
    t = re.sub(r"[^a-z0-9 ]", " ", t.lower())
    return " ".join(t.split())

# md articles
md_by_norm = {}
for root, _, files in os.walk(MD):
    for f in files:
        if f.endswith(".md"):
            rel = os.path.relpath(os.path.join(root, f), MD).replace("\\", "/")
            md_by_norm.setdefault(norm(f[:-3]), []).append(rel)

MANUAL = {
    "OpenAI ChatGPT Integration": "AI/ChatGPT Integration.md",
    "Search & Filters": "PROCESS MANAGEMENT/Document Management/Search.md",
    "Conditions To Switcher": "TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To Switcher.md",
    "Record Properties Overview": "PROCESS MANAGEMENT/Records/Properties/Document Record Properties Overview.md",
    "Import from Legito": "DOCUMENT EDITOR/Data Import/Import from Legito Documents.md",
    "External source import via API": "DOCUMENT EDITOR/Data Import/External source import.md",
    "Batch Generation": "DOCUMENT EDITOR/Data Import/Batch Generation from Sheets.md",
    "Condition To Question": "TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To Questions.md",
    "Condition To Day-in-date": "TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To Days-in-date.md",
    "Condition To Select": "TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To Select Elements.md",
    "Condition To Text Input": "TEMPLATE AUTOMATION/Template Editor/Conditions/Condition To Text Inputs.md",
    "Manage Signatures (beta)": "DASHBOARD/Widget Types/Manage Signatures.md",
    "AI Overview": "AI/Kedy AI.md",
    "AI Template Automation": "AI/Word-to-Template Conversion.md",
    "AI Document Data Extraction": "PROCESS MANAGEMENT/Document Management/Text extraction and OCR.md",
    "AI Data Insights": "PROCESS MANAGEMENT/Data Insights.md",
}

def pick_candidate(cands, live_cats):
    """Disambiguate duplicate md filenames using live category names."""
    if len(cands) == 1:
        return cands[0]
    live_norm = {norm(c) for c in live_cats}
    best, best_score = cands[0], -1
    for c in cands:
        parts = {norm(p) for p in c.split("/")[:-1]}
        score = 0
        for lp in live_norm:
            for mp in parts:
                if lp and (lp in mp or mp in lp):
                    score += 1
        if score > best_score:
            best, best_score = c, score
    return best

mapping = {}   # md relpath -> live article
unmatched = []
for a in live["articles"]:
    title = htmllib.unescape(a["title"])
    if title in MANUAL:
        mapping[MANUAL[title]] = a
        continue
    n = norm(title)
    if n in md_by_norm:
        mapping[pick_candidate(md_by_norm[n], a["cats"])] = a
    else:
        unmatched.append((title, len(a["images"]), len(a["iframes"]) + len(a["videos"])))

print(f"mapped: {len(mapping)} md articles to live sources")
print("unmatched live (title, imgs, vids):", unmatched)

# ---- download live images ----
IMG_ALT_RE = re.compile(r'<img[^>]*?(?:alt="([^"]*)")?[^>]*?src="([^"]+)"[^>]*?(?:alt="([^"]*)")?[^>]*>', re.I)

def slugify(p):
    p = p[:-3] if p.endswith(".md") else p
    p = unicodedata.normalize("NFKD", p).encode("ascii", "ignore").decode()
    parts = [re.sub(r"[^a-z0-9]+", "-", x.lower()).strip("-") for x in p.split("/")]
    return "/".join(parts)

os.makedirs(LIVE_DIR, exist_ok=True)
result = {}
dl_ok = dl_fail = 0
seen_urls = {}

def download(url, dest):
    global dl_ok, dl_fail
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        dl_ok += 1
        return True
    try:
        safe_url = urllib.parse.quote(url, safe=":/?&=%~+-_.")
        req = urllib.request.Request(safe_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=90) as r, open(dest, "wb") as f:
            f.write(r.read())
        dl_ok += 1
        return True
    except Exception as e:
        print(f"  FAIL {url}: {e}")
        dl_fail += 1
        return False

for rel, a in sorted(mapping.items()):
    art_slug = slugify(rel).split("/")[-1]
    entry = {"liveLink": a["link"], "vimeo": [], "images": []}
    # vimeo iframes (dedupe, strip amp;)
    seen_v = set()
    for u in a["iframes"]:
        u = htmllib.unescape(u)
        if "vimeo" not in u:
            continue
        vid = re.search(r"/video/(\d+)", u)
        key = vid.group(1) if vid else u
        if key in seen_v:
            continue
        seen_v.add(key)
        entry["vimeo"].append(u)
    # direct <video> srcs (e.g. Salesforce mp4)
    for u in a["videos"]:
        u = htmllib.unescape(u).split("?")[0]
        if not u.startswith("http"):
            continue
        ext = os.path.splitext(urllib.parse.urlparse(u).path)[1] or ".mp4"
        fn = f"{art_slug}-video{ext}"
        dest = os.path.join(LIVE_DIR, fn)
        if download(u, dest):
            entry["videoFiles"] = entry.get("videoFiles", []) + [f"live/{fn}"]
    # images: pull alt text from html via a simple pass
    html_src = a["html"]
    alts = {}
    for m in re.finditer(r'<img\b[^>]*>', html_src, re.I):
        tag = m.group(0)
        srcm = re.search(r'src="([^"]+)"', tag)
        altm = re.search(r'alt="([^"]*)"', tag)
        if srcm:
            alts[srcm.group(1)] = htmllib.unescape(altm.group(1)) if altm else ""
    # heading context per image occurrence, in document order
    ctx_queue = []
    last_heading = None
    for mm in re.finditer(r'<h([1-6])[^>]*>(.*?)</h\1>|<img\b[^>]*>', a["html"], re.I | re.S):
        if mm.group(0).lower().startswith("<h"):
            last_heading = re.sub(r"<[^>]+>", "", mm.group(2))
            last_heading = " ".join(htmllib.unescape(last_heading).split())
        else:
            srcm = re.search(r'src="([^"]+)"', mm.group(0))
            if srcm:
                before = re.sub(r'<[^>]+>', ' ', a['html'][max(0, mm.start()-1500):mm.start()])
                before = re.sub(r'\[[^\]]*\]?', ' ', htmllib.unescape(before))
                before = ' '.join(t for t in before.split() if '=' not in t and '&' not in t)[-300:]
                after = re.sub(r'<[^>]+>', ' ', a['html'][mm.end():mm.end()+1200])
                after = ' '.join(t for t in htmllib.unescape(after).split() if '=' not in t and '&' not in t and '[' not in t)[:300]
                ctx_queue.append((srcm.group(1), last_heading, before, after))
    ctx_i = 0
    idx = 0
    for u in a["images"]:
        heading = None
        before_txt = ""
        after_txt = ""
        if ctx_i < len(ctx_queue) and ctx_queue[ctx_i][0] == u:
            heading = ctx_queue[ctx_i][1]
            before_txt = ctx_queue[ctx_i][2]
            after_txt = ctx_queue[ctx_i][3]
            ctx_i += 1
        uu = htmllib.unescape(u)
        if uu.startswith("data:"):
            continue
        if not uu.startswith("http"):
            uu = "https://www.legito.com" + uu
        # skip decorative wp emojis etc.
        if "s.w.org" in uu:
            continue
        if uu in seen_urls:
            entry["images"].append({"src": seen_urls[uu], "alt": alts.get(u, ""), "heading": heading, "before": before_txt, "after": after_txt})
            continue
        idx += 1
        path = urllib.parse.urlparse(uu).path
        ext = os.path.splitext(path)[1].lower() or ".png"
        if ext not in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"):
            ext = ".png"
        h = hashlib.md5(uu.encode()).hexdigest()[:6]
        fn = f"{art_slug}-{idx:02d}-{h}{ext}"
        dest = os.path.join(LIVE_DIR, fn)
        if download(uu, dest):
            rel_web = f"live/{fn}"
            seen_urls[uu] = rel_web
            entry["images"].append({"src": rel_web, "alt": alts.get(u, ""), "heading": heading, "before": before_txt, "after": after_txt})
    if entry["vimeo"] or entry["images"] or entry.get("videoFiles"):
        result[rel] = entry

with open(f"{S}/live_map.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=1)

n_img = sum(len(v["images"]) for v in result.values())
n_vim = sum(len(v["vimeo"]) for v in result.values())
print(f"DONE. articles with live media: {len(result)}, images: {n_img}, vimeo: {n_vim}, downloads ok: {dl_ok}, failed: {dl_fail}")
