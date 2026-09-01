"""Scrape the live Legito KB (Echo KB on WordPress) via REST API."""
import json, re, urllib.request, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = "https://www.legito.com/wp-json/wp/v2"
OUT = r"C:\Users\edous\AppData\Local\Temp\claude\C--Legito-Test\c62ce0eb-2336-4666-9906-3b16ad4a3188\scratchpad"

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))

# 1. categories (hierarchical tree)
cats = []
page = 1
while True:
    batch = get(f"{BASE}/epkb_post_type_1_category?per_page=100&page={page}")
    cats.extend(batch)
    if len(batch) < 100:
        break
    page += 1
cat_map = {c["id"]: {"id": c["id"], "name": c["name"], "slug": c["slug"],
                     "parent": c["parent"]} for c in cats}
print(f"categories: {len(cats)}")

# 2. articles
articles = []
page = 1
while True:
    batch = get(f"{BASE}/epkb_post_type_1?per_page=100&page={page}&_fields=id,slug,link,title,content,epkb_post_type_1_category,modified")
    articles.extend(batch)
    if len(batch) < 100:
        break
    page += 1
print(f"articles: {len(articles)}")

IMG_RE = re.compile(r'<img[^>]+src="([^"]+)"', re.I)
IFRAME_RE = re.compile(r'<iframe[^>]+src="([^"]+)"', re.I)
VIDEO_RE = re.compile(r'<video[^>]*>.*?</video>', re.I | re.S)
SRC_RE = re.compile(r'src="([^"]+)"', re.I)

out = []
for a in articles:
    html = a["content"]["rendered"]
    imgs = IMG_RE.findall(html)
    iframes = [u for u in IFRAME_RE.findall(html)]
    vids = []
    for v in VIDEO_RE.findall(html):
        vids.extend(SRC_RE.findall(v))
    out.append({
        "id": a["id"], "slug": a["slug"], "link": a["link"],
        "title": a["title"]["rendered"],
        "modified": a["modified"],
        "cats": [cat_map.get(c, {}).get("name", str(c)) for c in a.get("epkb_post_type_1_category", [])],
        "images": imgs, "iframes": iframes, "videos": vids,
        "html": html,
    })

with open(f"{OUT}/live_kb.json", "w", encoding="utf-8") as f:
    json.dump({"categories": list(cat_map.values()), "articles": out}, f, ensure_ascii=False, indent=1)

n_img = sum(len(a["images"]) for a in out)
n_ifr = sum(len(a["iframes"]) for a in out)
n_vid = sum(len(a["videos"]) for a in out)
vimeo = sum(1 for a in out for u in a["iframes"] if "vimeo" in u)
print(f"images: {n_img}, iframes: {n_ifr} (vimeo {vimeo}), <video> srcs: {n_vid}")
print("sample titles:", [a["title"] for a in out[:5]])
