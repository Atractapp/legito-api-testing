# Legito "How formatting is resolved" diagram — brand-locked SVG generator.
# Palette (closed): #58a35c #74c078 #c2dec3 #f3f5f5 #435964 #b98ac4 #f2d452 #ffffff
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

INK = "#435964"; GREEN = "#74c078"; DGREEN = "#58a35c"; LGREEN = "#c2dec3"
LGREY = "#f3f5f5"; YELLOW = "#f2d452"; WHITE = "#ffffff"
FONT = '"Open Sans", "Segoe UI", Arial, sans-serif'

W, H = 1930, 1560
NW, NH = 220, 64          # node size
GX, GY = 300, 118         # grid pitch

def gx(c): return 150 + c * GX
def gy(r): return 96 + r * GY

nodes = {}   # id -> (col,row,type,lines,[w-mult])
def N(nid, col, row, typ, *lines, wm=1.0):
    nodes[nid] = (col, row, typ, lines, wm)

# ---------- Element lane ----------
N("e0", 0, 0, "entry", "ELEMENT")
N("d_rte", 0, 1, "dec", "Is the Element", "a Rich Text Element?")
N("d_html", 1, 1, "dec", "Is the Rich Text using", "HTML formatting?")
N("o_html", 2, 0.62, "out", "HTML formatting used")
N("o_rtedef", 2, 1.42, "out", "Default Rich Text", "formatting used")
N("d_elch", 0, 2, "dec", "Element formatting changed", "in the Template Editor?")
N("o_elch", 1, 2, "out", "Changed Element", "formatting used")
N("d_tab", 0, 3, "dec", "Is the Element", "in a Table?")

# ---------- Table lane ----------
N("t0", 1, 3, "entry", "ROW / COLUMN / CELL")
N("d_rcc", 1, 4, "dec", "Row, Column or Cell formatting", "changed in the Template Editor?")
N("o_rcc", 2, 4, "out", "Changed Row / Column / Cell", "formatting used")

# ---------- Clause lane ----------
N("c0", -0.62, 6, "entry", "CLAUSE", wm=0.55)
N("d_clch", 0, 6, "dec", "Clause formatting changed", "in the Template Editor?")
N("o_clch", 1, 6, "out", "Changed Clause", "formatting used")
N("d_as", 0, 7, "dec", "Advanced Style assigned?", "(manually or via a Legito Style)")
N("d_asald", 1, 7, "dec", "Is that Advanced Style present", "in the ALD in use?")
N("o_ald", 2, 7, "out", "Advanced Style (ALD)", "formatting used")
N("d_ls", 0, 8, "dec", "Clause has an assigned", "Legito Style?")
N("d_lsexp", 1, 8, "dec", "Is the Legito Style set", "to Export to Word?")
N("o_ls", 2, 8, "out", "Legito Style used", "(exported as a Word style)")
N("o_lsnorm", 2, 9, "cav", "Legito Style formatting applied", "directly (modifies Normal", "in Word)")
N("d_def", 0, 9, "dec", "Does the Workspace have", "Default Styles?")
N("d_defexp", 1, 10, "dec", "Are the Default Styles set", "to Export to Word?")
N("o_def", 2, 10, "out", "Legito Default Style used")
N("o_defnorm", 2, 11, "cav", "Default Style formatting applied", "directly (modifies Normal", "in Word)")
N("o_fb", 0, 11, "warn", "Fallback Legito Style used")

# ---------- Section lane ----------
SC = 3.6
N("s0", SC, 0, "entry", "SECTION")
N("d_sch", SC, 1, "dec", "Section formatting changed", "in the Template Editor?")
N("d_ald1", SC + 1.1, 1, "dec", "Is an Advanced Layout", "Design in use?")
N("o_sdef", SC + 1.1, 0, "out", "Default Template Section", "formatting used")
N("d_cont1", SC + 1.1, 2, "dec", "Is it a Continuous", "Section?")
N("d_ann1", SC + 1.1, 3, "dec", "Is the Section annotated", "in the ALD?")
N("o_aldsec", SC + 1.1, 4, "out", "ALD Section", "formatting used")
N("d_ald2", SC, 2, "dec", "Is an Advanced Layout", "Design in use?")
N("o_sch", SC - 0.75, 2.6, "out", "Changed Section", "formatting used")
N("d_cont2", SC, 3, "dec", "Is it a Continuous", "Section?")
N("d_ann2", SC, 4, "dec", "Is the Section annotated", "in the ALD?")
N("o_merge", SC + 0.55, 5, "warn", "Section formatting ignored -", "content merges into the", "previous Section")

edges = [
    # element
    ("e0", "d_rte", "", "v"),
    ("d_rte", "d_html", "Yes", "h"),
    ("d_html", "o_html", "Yes", "hh"),
    ("d_html", "o_rtedef", "No", "hh"),
    ("d_rte", "d_elch", "No", "v"),
    ("d_elch", "o_elch", "Yes", "h"),
    ("d_elch", "d_tab", "No", "v"),
    ("d_tab", "d_rcc", "Yes", "vh"),
    ("d_tab", "d_clch", "No", "v2"),
    # table
    ("t0", "d_rcc", "", "v"),
    ("d_rcc", "o_rcc", "Yes", "h"),
    ("d_rcc", "d_clch", "No", "vvh"),
    # clause
    ("c0", "d_clch", "", "h"),
    ("d_clch", "o_clch", "Yes", "h"),
    ("d_clch", "d_as", "No", "v"),
    ("d_as", "d_asald", "Yes", "h"),
    ("d_asald", "o_ald", "Yes", "h"),
    ("d_asald", "d_ls", "No", "vtop"),
    ("d_as", "d_ls", "No", "v"),
    ("d_ls", "d_lsexp", "Yes", "h"),
    ("d_lsexp", "o_ls", "Yes", "h"),
    ("d_lsexp", "o_lsnorm", "No", "vh"),
    ("d_ls", "d_def", "No", "v"),
    ("d_def", "d_defexp", "Yes", "vh"),
    ("d_defexp", "o_def", "Yes", "h"),
    ("d_defexp", "o_defnorm", "No", "vh"),
    ("d_def", "o_fb", "No", "v"),
    # section
    ("s0", "d_sch", "", "v"),
    ("d_sch", "d_ald1", "No", "h"),
    ("d_ald1", "o_sdef", "No", "v-up"),
    ("d_ald1", "d_cont1", "Yes", "v"),
    ("d_cont1", "o_sdef", "Yes", "r-up"),
    ("d_cont1", "d_ann1", "No", "v"),
    ("d_ann1", "o_aldsec", "Yes", "v"),
    ("d_ann1", "o_merge", "No", "hv"),
    ("d_sch", "d_ald2", "Yes", "v"),
    ("d_ald2", "o_sch", "No", "hl"),
    ("d_ald2", "d_cont2", "Yes", "v"),
    ("d_cont2", "o_sch", "Yes", "hl"),
    ("d_cont2", "d_ann2", "No", "v"),
    ("d_ann2", "o_sch", "Yes", "hl"),
    ("d_ann2", "o_merge", "No", "vh"),
]

def node_xy(nid):
    c, r, typ, lines, wm = nodes[nid]
    w = NW * wm
    x = gx(c); y = gy(r)
    return x, y, w, NH

def center(nid):
    x, y, w, h = node_xy(nid)
    return x + w / 2, y + h / 2

svg = []
svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family=\'{FONT}\'>')
svg.append(f'<rect width="{W}" height="{H}" fill="{WHITE}"/>')
svg.append(f'''<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{INK}" opacity="0.55"/></marker></defs>''')

# title + legend
svg.append(f'<text x="40" y="44" font-size="26" font-weight="700" fill="{INK}">How formatting is resolved</text>')
lx = 40
for label, fill, stroke, tcol in [
    ("Decision", WHITE, DGREEN, INK),
    ("Formatting outcome", GREEN, "none", WHITE),
    ("Outcome that modifies Normal in Word", LGREEN, "none", DGREEN),
    ("Fallback or merged content", YELLOW, "none", INK),
]:
    svg.append(f'<rect x="{lx}" y="58" width="14" height="14" rx="3" fill="{fill}"' +
               (f' stroke="{stroke}" stroke-width="2"' if stroke != "none" else "") + "/>")
    svg.append(f'<text x="{lx + 20}" y="70" font-size="12" fill="{INK}">{label}</text>')
    lx += 24 + len(label) * 6.4 + 26

# edges first (under nodes)
def elbow(points):
    d = f'M{points[0][0]},{points[0][1]} ' + " ".join(f"L{x},{y}" for x, y in points[1:])
    return f'<path d="{d}" fill="none" stroke="{INK}" stroke-opacity="0.45" stroke-width="1.6" marker-end="url(#arr)"/>'

def lbl(x, y, text):
    col = DGREEN if text == "Yes" else INK
    op = "1" if text == "Yes" else "0.75"
    w = 14 + len(text) * 7
    return (f'<rect x="{x - w/2}" y="{y - 10}" width="{w}" height="18" rx="9" fill="{WHITE}"/>' +
            f'<text x="{x}" y="{y + 4}" font-size="11.5" font-weight="700" fill="{col}" fill-opacity="{op}" text-anchor="middle">{text}</text>')

lbls = []
for a, b, t, mode in edges:
    ax, ay, aw, ah = node_xy(a); bx, by, bw, bh = node_xy(b)
    acx, acy = ax + aw/2, ay + ah/2
    bcx, bcy = bx + bw/2, by + bh/2
    if mode == "v":
        pts = [(acx, ay + ah), (acx, by)]
    elif mode == "v2":
        pts = [(acx, ay + ah), (acx, by)]
    elif mode == "h":
        pts = [(ax + aw, acy), (bx, bcy)] if bx > ax else [(ax, acy), (bx + bw, bcy)]
    elif mode == "hl":
        pts = [(ax, acy), (bcx, acy), (bcx, by + bh)] if by < ay else [(ax, acy), (bcx, acy), (bcx, by)]
        if abs(by - ay) < 5: pts = [(ax, acy), (bx + bw, bcy)]
    elif mode == "hv":
        pts = [(ax + aw, acy), (bcx, acy), (bcx, by)] if by > ay else [(ax + aw, acy), (bcx, acy), (bcx, by + bh)]
    elif mode == "vh":
        pts = [(acx, ay + ah), (acx, bcy), (bx, bcy)] if bx > ax else [(acx, ay + ah), (acx, bcy), (bx + bw, bcy)]
    elif mode == "hh":
        midx = bx - 34
        pts = [(ax + aw, acy), (midx, acy), (midx, bcy), (bx, bcy)]
    elif mode == "vvh":
        midy = by - 26
        pts = [(acx, ay + ah), (acx, midy), (bcx, midy), (bcx, by)]
    elif mode == "vtop":
        midy = by - 18
        tx = bx + bw - 44
        pts = [(acx, ay + ah), (acx, midy), (tx, midy), (tx, by)]
    elif mode == "r-up":
        rx = ax + aw + 44
        pts = [(ax + aw, acy), (rx, acy), (rx, bcy), (bx + bw, bcy)]
    elif mode == "v-up":
        pts = [(acx, ay), (acx, by + bh)]
    elif mode == "h-up":
        pts = [(acx, ay), (acx, (ay + by + bh) / 2), (bcx, (ay + by + bh) / 2), (bcx, by + bh)]
    else:
        pts = [(acx, ay + ah), (bcx, by)]
    svg.append(elbow(pts))
    if t:
        if mode == "hh":
            mx = (pts[-2][0] + pts[-1][0]) / 2
            my = (pts[-2][1] + pts[-1][1]) / 2
        elif len(pts) >= 2:
            mx = (pts[0][0] + pts[1][0]) / 2
            my = (pts[0][1] + pts[1][1]) / 2
        lbls.append(lbl(mx, my, t))

svg.extend(lbls)

# nodes
for nid, (c, r, typ, lines, wm) in nodes.items():
    x, y, w, h = node_xy(nid)
    if typ == "entry":
        eh = 40
        text = lines[0]
        ew = 30 + len(text) * 8.4
        exx = x + (w - ew) / 2
        svg.append(f'<rect x="{exx}" y="{y + (h - eh)/2}" width="{ew}" height="{eh}" rx="20" fill="{INK}"/>')
        svg.append(f'<text x="{exx + ew/2}" y="{y + h/2 + 4.5}" font-size="12.5" font-weight="700" letter-spacing="1" fill="{WHITE}" text-anchor="middle">{text}</text>')
        continue
    if typ == "dec":
        fill, stroke, tcol, fw = WHITE, DGREEN, INK, "600"
    elif typ == "out":
        fill, stroke, tcol, fw = GREEN, "none", WHITE, "700"
    elif typ == "cav":
        fill, stroke, tcol, fw = LGREEN, "none", DGREEN, "600"
    else:  # warn
        fill, stroke, tcol, fw = YELLOW, "none", INK, "600"
    svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{fill}"' +
               (f' stroke="{stroke}" stroke-width="2"' if stroke != "none" else "") + "/>")
    n = len(lines)
    for i, ln in enumerate(lines):
        ty = y + h/2 + (i - (n - 1)/2) * 15 + 4
        svg.append(f'<text x="{x + w/2}" y="{ty}" font-size="12" font-weight="{fw}" fill="{tcol}" text-anchor="middle">{ln}</text>')

# footnote
svg.append(f'<text x="150" y="{H - 20}" font-size="11.5" fill="{INK}" fill-opacity="0.7">A greyed-out value in the Template Editor is inherited. A highlighted value is a manual change and always wins. Clear Formatting (the crossed T) returns the Clause to its inherited values.</text>')
svg.append("</svg>")

out = r"C:\Legito Test\knowledge base rework\kb-site\public\diagrams"
import os
os.makedirs(out, exist_ok=True)
open(out + r"\formatting-logic.svg", "w", encoding="utf-8").write("\n".join(svg))
print("svg written,", len(nodes), "nodes,", len(edges), "edges")
