/* Legito KB2026 preview — static site generator.
   Content: KB2026 md set. Media: current live KB (images/videos) + KB2026 media/ fallback. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MD_ROOT = "C:/Legito Test/knowledge base rework/KB2026/md";
const MEDIA_ROOT = "C:/Legito Test/knowledge base rework/KB2026/media";
const DATA = path.join(__dirname, "data");
const DIST = path.join(__dirname, "dist");
const PUB = path.join(__dirname, "public");

const liveMap = JSON.parse(fs.readFileSync(path.join(DATA, "live_map.json"), "utf8"));
const posters = JSON.parse(fs.readFileSync(path.join(DATA, "vimeo_posters.json"), "utf8"));

/* ---------- helpers ---------- */
const slugify = (s) =>
  s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
   .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const icon = (name, cls = "") => {
  const svg = fs.readFileSync(path.join(__dirname, "src", "icons", `${name}.svg`), "utf8");
  return svg.replace("<svg", `<svg class="ic ${cls}" fill="currentColor" aria-hidden="true"`);
};

/* ---------- category metadata ---------- */
const CATS = [
  ["ONBOARDING", "Onboarding", "rocket"],
  ["DOCUMENT EDITOR", "Document Editor", "file-pen"],
  ["TEMPLATE AUTOMATION", "Template Automation", "layer-group"],
  ["PROCESS MANAGEMENT", "Process Management", "diagram-project"],
  ["AI", "AI", "wand-magic-sparkles"],
  ["ELECTRONIC SIGNATURE", "Electronic Signature", "signature"],
  ["DASHBOARD", "Dashboard", "gauge-high"],
  ["WORKSPACE ADMINISTRATION", "Workspace Administration", "users-gear"],
  ["INTEGRATIONS", "Integrations", "plug"],
];
const EXCLUDE_DIRS = new Set(["GETTING STARTED"]);
const catMeta = Object.fromEntries(CATS.map(([dir, name, ic], i) => [dir, { name, ic, order: i }]));
const titleCase = (s) => s.split(" ").map(w => (w === w.toUpperCase() && w.length > 2) ? w[0] + w.slice(1).toLowerCase() : w).join(" ");
const prettyDir = (d) => catMeta[d] ? catMeta[d].name : titleCase(d);

/* ---------- collect articles ---------- */
function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith(".md")) out.push(p);
  }
  return out;
}

const files = walk(MD_ROOT);
const articles = [];
for (const f of files) {
  const rel = path.relative(MD_ROOT, f).replace(/\\/g, "/");
  const parts = rel.split("/");
  const cat = parts[0];
  if (EXCLUDE_DIRS.has(cat)) continue;
  if (!catMeta[cat]) throw new Error(`unknown category ${cat}`);
  const raw = fs.readFileSync(f, "utf8");
  const titleM = raw.match(/^#\s+(.+)$/m);
  const title = titleM ? titleM[1].trim() : parts.at(-1).replace(/\.md$/, "");
  const route = "/" + parts.map(p => slugify(p.replace(/\.md$/, ""))).join("/") + "/";
  articles.push({
    rel, file: f, cat, chain: parts.slice(0, -1), title, raw, route,
    live: liveMap[rel] || null,
  });
}
// sort: category order, then folder chain, then Overview-first, then title
articles.sort((a, b) => {
  const c = catMeta[a.cat].order - catMeta[b.cat].order;
  if (c) return c;
  const ka = a.chain.join("/"), kb = b.chain.join("/");
  if (ka !== kb) return ka.localeCompare(kb);
  const oa = /overview/i.test(a.title) ? 0 : 1, ob = /overview/i.test(b.title) ? 0 : 1;
  if (oa !== ob) return oa - ob;
  return a.title.localeCompare(b.title);
});
const byRel = Object.fromEntries(articles.map(a => [a.rel, a]));

/* ---------- markdown rendering ---------- */
const APPENDIX_RE = /\n##\s+Additional screenshots from the 2024 article\s*\n/;

function preprocess(md) {
  // URL-encode spaces in link/image destinations so marked parses them
  return md.replace(/\]\(([^)\n]+)\)/g, (m, dest) => {
    dest = dest.trim();
    if (/^https?:\/\//.test(dest) || dest.startsWith("#")) return m;
    return `](${dest.replace(/ /g, "%20")})`;
  });
}

function resolveHref(dest, art) {
  dest = decodeURIComponent(dest);
  if (/^https?:\/\//.test(dest) || dest.startsWith("mailto:") || dest.startsWith("#")) return null;
  const [p, frag] = dest.split("#");
  const abs = path.normalize(path.join(path.dirname(art.file), p)).replace(/\\/g, "/");
  const rel = path.relative(MD_ROOT, abs).replace(/\\/g, "/");
  const target = byRel[rel];
  if (target) return target.route + (frag ? "#" + frag : "");
  return null;
}

const usedMedia = new Set();
function resolveImg(src, art) {
  src = decodeURIComponent(src);
  if (/^https?:\/\//.test(src)) return src;
  const abs = path.normalize(path.join(path.dirname(art.file), src)).replace(/\\/g, "/");
  if (abs.startsWith(MEDIA_ROOT.replace(/\\/g, "/")) && fs.existsSync(abs)) {
    const rel = path.relative(MEDIA_ROOT, abs).replace(/\\/g, "/");
    usedMedia.add(rel);
    return "/media/" + rel.split("/").map(encodeURIComponent).join("/");
  }
  return null;
}

function renderArticleBody(art) {
  const useLive = !!(art.live && (art.live.images || []).length);
  let md = art.raw.replace(/^#\s+.+\n/, ""); // drop H1 (rendered in header)
  // split appendix gallery
  let appendix = [];
  const m = md.match(APPENDIX_RE);
  if (m) {
    const idx = md.search(APPENDIX_RE);
    const tail = md.slice(idx + m[0].length);
    md = md.slice(0, idx);
    for (const im of tail.matchAll(/!\[([^\]]*)\]\(([^)\n]+)\)/g)) {
      const src = resolveImg(im[2].trim(), art);
      if (src) appendix.push({ src, alt: im[1] });
    }
  }
  // split related articles
  let related = [];
  const relM = md.match(/\n##\s+Related articles?\s*\n/i);
  if (relM) {
    const idx = md.search(/\n##\s+Related articles?\s*\n/i);
    const tail = md.slice(idx + relM[0].length);
    md = md.slice(0, idx);
    for (const lm of tail.matchAll(/\[([^\]]+)\]\(([^)\n]+)\)/g)) {
      const href = resolveHref(lm[2].trim().replace(/%20/g, " "), art);
      if (href) {
        const t = articles.find(a => a.route === href.split("#")[0]);
        if (t && !related.some(r => r.route === t.route)) related.push(t);
      }
    }
  }

  const headings = [];
  const mk = new Marked();
  const seen = {};
  mk.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = text.replace(/<[^>]+>/g, "");
        let id = slugify(plain) || "s";
        if (seen[id] != null) id = `${id}-${++seen[id]}`; else seen[id] = 0;
        if (depth === 2 || depth === 3) headings.push({ id, depth, text: plain });
        const d = Math.min(depth + 1, 6); // shift down: article H1 is the title
        return `<h${d} id="${id}" class="hd"><a class="anchor" href="#${id}" aria-label="Link to section">${ICONS.link}</a>${text}</h${d}>\n`;
      },
      image() {
        // 2024-corpus images predate the current UI; the site carries live-KB media only
        return "";
      },
      link({ href, tokens }) {
        const inner = this.parser.parseInline(tokens);
        const internal = resolveHref(href.replace(/%20/g, " "), art);
        if (internal) return `<a href="${internal}">${inner}</a>`;
        if (/^https?:\/\//.test(href)) return `<a href="${href}" target="_blank" rel="noopener">${inner}</a>`;
        return inner;
      },
    },
  });
  let html = mk.parse(preprocess(md));
  // standalone image paragraphs -> figures; tables -> scroll wrap
  html = html.replace(/<p>(<img class="shot"[^>]*>)<\/p>/g, '<figure class="fig">$1</figure>');
  html = html.replace(/<table>/g, '<div class="twrap"><table>').replace(/<\/table>/g, "</table></div>");
  if (useLive) html = placeLiveImages(html, art.live.images);
  return { html, headings, related };
}

/* ---------- live image placement ----------
   Each live image carries the heading and the text that preceded it in the live
   article. Place it after the KB block that best matches that context. */
const STOP = new Set(["the","and","for","with","that","this","are","can","its","from","into","was","were","been","will","has","have","had","not","you","your","all","one","two","when","where","which","also","then","than","only","other","after","before","more","most","such","each","between","under","over","while","them","they","their","there","here","what","how","who","any","new","use","used","using","user","users","document","documents","legito","template","templates","click","clicking","clicked","button","option","options","page","allows","allow"]);
function toks(t) {
  return new Set((t || "").toLowerCase().replace(/<[^>]+>/g, " ").replace(/[^a-z0-9]+/g, " ")
    .split(" ").filter(w => w.length >= 3 && !STOP.has(w)));
}
function placeLiveImages(html, images) {
  const blocks = html.split(/\n(?=<)/);
  const blockToks = blocks.map(toks);
  const df = {};
  for (const bt of blockToks) for (const t of bt) df[t] = (df[t] || 0) + 1;
  const headingIdx = [];
  blocks.forEach((b, i) => {
    const m = b.match(/^<h([2-6])[^>]*>(.*?)<\/h\1>/s);
    if (m) headingIdx.push({ i, toks: toks(m[2]) });
  });
  const inserts = {}; // block index -> [figure html]
  const unplaced = [];
  for (const im of images) {
    const fig = `<figure class="fig"><img class="shot" loading="lazy" src="/${im.src}" alt="${esc(im.alt || "")}"></figure>`;
    const q = new Set([...toks(im.before), ...toks(im.alt), ...toks(im.heading)]);
    // heading anchor: strong heading-text overlap narrows the search window
    let lo = 0, hi = blocks.length - 1;
    if (im.heading) {
      const ht = toks(im.heading);
      let best = null, bestOv = 0;
      for (const h of headingIdx) {
        let ov = 0;
        for (const t of ht) if (h.toks.has(t)) ov++;
        const denom = Math.max(1, Math.min(ht.size, h.toks.size));
        if (ov / denom > 0.6 && ov > bestOv) { best = h; bestOv = ov; }
      }
      if (best) {
        lo = best.i;
        const next = headingIdx.find(h => h.i > best.i);
        hi = next ? next.i - 1 : blocks.length - 1;
      }
    }
    let bestI = -1, bestScore = 0;
    for (let i = lo; i <= hi; i++) {
      if (/^<h[2-6]/.test(blocks[i]) && i !== lo) continue;
      let score = 0, hits = 0;
      for (const t of q) if (blockToks[i].has(t)) { score += 1 / (1 + (df[t] || 0)); hits++; }
      if (hits >= 2 && score > bestScore) { bestScore = score; bestI = i; }
    }
    if (bestI === -1 && im.heading && lo > 0) bestI = lo; // at least under its heading
    if (bestI >= 0) (inserts[bestI] ||= []).push(fig);
    else unplaced.push(fig);
  }
  const out = blocks.map((b, i) => inserts[i] ? b + "\n" + inserts[i].join("\n") : b);
  return out.join("\n") + (unplaced.length ? "\n" + unplaced.join("\n") : "");
}

/* plain text + excerpt for search */
function plainText(md) {
  return md
    .replace(APPENDIX_RE, "\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|-]+/g, " ")
    .replace(/\s+/g, " ").trim();
}
function excerptOf(art) {
  const body = art.raw.replace(/^#\s+.+\n/, "");
  for (const line of body.split("\n")) {
    const l = line.trim();
    if (!l || l.startsWith("#") || l.startsWith("!") || l.startsWith("|") || l.startsWith("```")) continue;
    const t = plainText(l);
    if (t.length > 40) return t.length > 180 ? t.slice(0, 177).replace(/\s+\S*$/, "") + "…" : t;
  }
  return "";
}

/* ---------- icons preloaded ---------- */
const ICONS = {};
for (const n of ["compass","rocket","file-pen","layer-group","diagram-project","wand-magic-sparkles","signature","gauge-high","users-gear","plug","magnifying-glass","play","arrow-right","arrow-left","chevron-down","chevron-right","arrow-up-right-from-square","link","xmark","bars","arrow-up","images","video","clock","book-open"])
  ICONS[n] = icon(n);

/* ---------- tree for sidebar / category pages ---------- */
function buildTree() {
  const tree = {};
  for (const a of articles) {
    let node = (tree[a.cat] ||= { dirs: {}, arts: [] });
    for (const d of a.chain.slice(1)) node = (node.dirs[d] ||= { dirs: {}, arts: [] });
    node.arts.push(a);
  }
  return tree;
}
const TREE = buildTree();
const catCount = Object.fromEntries(CATS.map(([d]) => [d, articles.filter(a => a.cat === d).length]));

function sidebarHTML(current) {
  let out = `<nav class="side" id="sidebar" aria-label="Knowledge Base navigation">`;
  for (const [dir] of CATS) {
    const meta = catMeta[dir];
    const open = current && current.cat === dir;
    const catRoute = "/" + slugify(dir) + "/";
    out += `<div class="side-cat${open ? " open" : ""}">
      <button class="side-cat-btn" aria-expanded="${open}"><span class="side-ic">${ICONS[meta.ic]}</span><span>${esc(meta.name)}</span><span class="chev">${ICONS["chevron-down"]}</span></button>
      <div class="side-body">${renderNode(TREE[dir], catRoute, current, dir)}</div>
    </div>`;
  }
  return out + `</nav>`;
}
function renderNode(node, base, current, dirName) {
  let out = "<ul>";
  for (const a of node.arts) {
    const active = current && current.rel === a.rel;
    out += `<li><a class="side-link${active ? " active" : ""}" href="${a.route}"${active ? ' aria-current="page"' : ""}>${esc(a.title)}</a></li>`;
  }
  out += "</ul>";
  for (const [d, sub] of Object.entries(node.dirs)) {
    const inPath = current && current.chain.includes(d);
    out += `<div class="side-group${inPath ? " open" : ""}">
      <button class="side-group-btn" aria-expanded="${inPath}">${ICONS["chevron-right"]}<span>${esc(titleCase(d))}</span></button>
      <div class="side-group-body">${renderNode(sub, base + slugify(d) + "/", current, d)}</div>
    </div>`;
  }
  return out;
}

/* ---------- page shell ---------- */
const YEAR = new Date().getFullYear();
const stripEmDash = (x) => x.replace(/[ \t]*\u2014[ \t]*/g, " - ");
function shell({ title, desc, content, current, bodyClass = "", crumbs = null }) {
  return stripEmDash(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc || "Legito Knowledge Base.")}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/opensans-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/opensans-700.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
<div class="preview-strip" role="note"><strong>Unofficial preview</strong><span class="ps-sep"></span><span class="ps-txt">Not the official Legito Knowledge Base.</span></div>
<header class="hdr">
  <div class="hdr-in">
    <button class="nav-toggle" id="navToggle" aria-label="Open navigation">${ICONS.bars}</button>
    <a class="brand" href="/"><img src="/legito-logo.svg" alt="Legito" width="96" height="28"><span class="brand-div"></span><span class="brand-kb">Knowledge&nbsp;Base</span></a>
    <div class="hdr-right">
      <button class="search-btn" id="searchBtn">${ICONS["magnifying-glass"]}<span>Search articles…</span><kbd>Ctrl&nbsp;K</kbd></button>
    </div>
  </div>
</header>
${content}
<footer class="ftr">
  <div class="ftr-min"><img src="/legito-logo-white.svg" alt="Legito" width="96" height="28"><span>© ${YEAR} Legito</span></div>
</footer>
<div class="palette" id="palette" hidden>
  <div class="palette-back" data-close></div>
  <div class="palette-panel" role="dialog" aria-modal="true" aria-label="Search">
    <div class="palette-head">${ICONS["magnifying-glass"]}<input id="paletteInput" type="search" placeholder="Search ${articles.length} articles…" autocomplete="off" spellcheck="false"><button class="palette-x" data-close aria-label="Close">${ICONS.xmark}</button></div>
    <div class="palette-results" id="paletteResults"><div class="palette-hint">Type to search titles, sections and full article text.</div></div>
    <div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
  </div>
</div>
<div class="lightbox" id="lightbox" hidden>
  <div class="lb-back" data-lbclose></div>
  <button class="lb-x" data-lbclose aria-label="Close">${ICONS.xmark}</button>
  <button class="lb-prev" aria-label="Previous">${ICONS["arrow-left"]}</button>
  <figure><img id="lbImg" src="" alt=""><figcaption id="lbCap"></figcaption></figure>
  <button class="lb-next" aria-label="Next">${ICONS["arrow-right"]}</button>
</div>
<script src="/minisearch.js" defer></script>
<script src="/client.js" defer></script>
</body>
</html>`);
}

const crumbHTML = (items) =>
  `<nav class="crumbs" aria-label="Breadcrumb">` +
  items.map((c, i) => {
    const el = c.href ? `<a href="${c.href}">${esc(c.label)}</a>` : `<span class="${i === items.length - 1 ? "c-here" : "c-mid"}">${esc(c.label)}</span>`;
    return el + (i < items.length - 1 ? '<span class="c-sep">/</span>' : "");
  }).join("") +
  `</nav>`;

/* ---------- video + gallery blocks ---------- */
function videoBlock(art) {
  if (!art.live) return "";
  const items = [];
  for (const u of art.live.vimeo || []) {
    const vid = (u.match(/\/video\/(\d+)/) || [])[1];
    const p = posters[vid] || { poster: "", title: "" };
    const src = u.replace(/&amp;/g, "&");
    items.push(`<div class="vid" data-embed="${esc(src)}">
      <img loading="lazy" src="/${p.poster}" alt="${esc(p.title || "Video guide")}">
      <button class="vid-play" aria-label="Play video: ${esc(p.title || "video guide")}"><span class="vid-play-c">${ICONS.play}</span></button>
      <span class="vid-title">${esc(p.title || "Video guide")}</span>
    </div>`);
  }
  for (const vf of art.live.videoFiles || []) {
    items.push(`<div class="vid vid-file"><video controls preload="metadata" src="/${vf}"></video></div>`);
  }
  if (!items.length) return "";
  return `<section class="vids${items.length > 1 ? " vids-multi" : ""}" aria-label="Video guides">${items.join("")}</section>`;
}

/* ---------- build ---------- */
// clear dist contents (keep the dir itself — a stale handle on it must not kill the build)
fs.mkdirSync(DIST, { recursive: true });
for (const e of fs.readdirSync(DIST)) fs.rmSync(path.join(DIST, e), { recursive: true, force: true });

// static assets
fs.cpSync(PUB, DIST, { recursive: true });
fs.copyFileSync(path.join(__dirname, "src", "styles.css"), path.join(DIST, "styles.css"));
fs.copyFileSync(path.join(__dirname, "src", "client.js"), path.join(DIST, "client.js"));

// favicon: green mark + white
fs.writeFileSync(path.join(DIST, "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#74c078"/><path d="M11 8v13a3 3 0 0 0 3 3h8" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`);

const searchDocs = [];
let totalShots = 0, totalVids = 0;

const perCatArticles = {};
for (const a of articles) (perCatArticles[a.cat] ||= []).push(a);

for (let i = 0; i < articles.length; i++) {
  const art = articles[i];
  const { html, headings, related } = renderArticleBody(art);
  const words = plainText(art.raw).split(" ").length;
  const mins = Math.max(1, Math.round(words / 220));
  const liveImgN = art.live ? (art.live.images || []).length : 0;
  const vidN = art.live ? (art.live.vimeo || []).length + (art.live.videoFiles || []).length : 0;
  totalShots += liveImgN; totalVids += vidN;

  const crumbs = [{ label: "Knowledge Base", href: "/" }];
  let acc = "/";
  art.chain.forEach((d, j) => {
    acc += slugify(d) + "/";
    crumbs.push({ label: prettyDir(d), href: j === 0 ? "/" + slugify(art.cat) + "/" : null });
  });
  const crumbItems = [{ label: "Knowledge Base", href: "/" },
    { label: catMeta[art.cat].name, href: "/" + slugify(art.cat) + "/" },
    ...art.chain.slice(1).map(d => ({ label: titleCase(d), href: null })),
    { label: art.title, href: null }];

  const toc = headings.filter(h => h.depth === 2 || h.depth === 3);
  const tocHTML = toc.length >= 2 ? `<aside class="toc" aria-label="On this page"><div class="toc-in"><h4>On this page</h4><ul>${
    toc.map(h => `<li class="toc-${h.depth}"><a href="#${h.id}">${esc(h.text)}</a></li>`).join("")}</ul></div></aside>` : "";

  const prev = articles[i - 1], next = articles[i + 1];
  const pager = `<nav class="pager">
    ${prev ? `<a class="pager-a pager-prev" href="${prev.route}"><span class="pager-lbl">${ICONS["arrow-left"]}Previous</span><span class="pager-t">${esc(prev.title)}</span></a>` : "<span></span>"}
    ${next ? `<a class="pager-a pager-next" href="${next.route}"><span class="pager-lbl">Next${ICONS["arrow-right"]}</span><span class="pager-t">${esc(next.title)}</span></a>` : "<span></span>"}
  </nav>`;

  const relatedHTML = related.length ? `<section class="related"><h2 class="hd" id="related-articles">Related articles</h2><div class="rel-grid">${
    related.map(r => `<a class="rel-card" href="${r.route}"><span class="rel-cat">${esc(catMeta[r.cat].name)}</span><span class="rel-t">${esc(r.title)}</span>${ICONS["arrow-right"]}</a>`).join("")}</div></section>` : "";

  const metaRow = `<div class="art-meta">
    <span class="pill pill-green">${esc(catMeta[art.cat].name)}</span>
    <span class="meta-i">${ICONS.clock}${mins} min read</span>
    ${liveImgN ? `<span class="meta-i">${ICONS.images}${liveImgN} screenshot${liveImgN > 1 ? "s" : ""}</span>` : ""}
    ${vidN ? `<span class="meta-i meta-vid">${ICONS.video}Video guide</span>` : ""}
  </div>`;

  const content = `
<div class="layout">
  ${sidebarHTML(art)}
  <main id="main" class="art">
    ${crumbHTML(crumbItems)}
    <h1 class="art-title">${esc(art.title)}</h1>
    <div class="rule"></div>
    ${metaRow}
    ${videoBlock(art)}
    <div class="prose">${html}</div>
    ${relatedHTML}
    ${pager}
  </main>
  ${tocHTML}
</div>`;

  const dir = path.join(DIST, ...art.route.split("/").filter(Boolean));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), shell({
    title: `${art.title} · Legito Knowledge Base`,
    desc: excerptOf(art), content, current: art, bodyClass: "page-art",
  }));

  searchDocs.push({
    id: i, t: art.title, p: art.route,
    c: [catMeta[art.cat].name, ...art.chain.slice(1).map(titleCase)].join(" / "),
    x: excerptOf(art),
    h: headings.map(h => h.text).join(" · "),
    b: plainText(art.raw.replace(/^#\s+.+\n/, "")),
    v: vidN > 0 ? 1 : 0,
  });
}

/* ---------- category pages ---------- */
for (const [dir] of CATS) {
  const meta = catMeta[dir];
  const route = "/" + slugify(dir) + "/";
  const node = TREE[dir];
  const rowsFor = (arts) => arts.map(a => {
    const liveImgN = a.live ? (a.live.images || []).length : 0;
    const vidN = a.live ? (a.live.vimeo || []).length + (a.live.videoFiles || []).length : 0;
    return `<a class="row" href="${a.route}">
      <span class="row-main"><span class="row-t">${esc(a.title)}</span><span class="row-x">${esc(excerptOf(a))}</span></span>
      <span class="row-meta">${vidN ? `<span class="row-vid">${ICONS.video}</span>` : ""}${liveImgN ? `<span class="row-shots">${ICONS.images}${liveImgN}</span>` : ""}${ICONS["arrow-right"]}</span>
    </a>`;
  }).join("");
  let sections = "";
  if (node.arts.length) sections += `<section class="cat-sec"><div class="rows">${rowsFor(node.arts)}</div></section>`;
  const renderGroups = (n, depth, label) => {
    let out = "";
    for (const [d, sub] of Object.entries(n.dirs)) {
      out += `<section class="cat-sec"><h2 class="cat-sub${depth > 1 ? " cat-sub2" : ""}">${esc(titleCase(d))}<span class="cat-n">${countNode(sub)}</span></h2>`;
      if (sub.arts.length) out += `<div class="rows">${rowsFor(sub.arts)}</div>`;
      out += `</section>`;
      out += renderGroups(sub, depth + 1, d);
    }
    return out;
  };
  const countNode = (n) => n.arts.length + Object.values(n.dirs).reduce((s, x) => s + countNode(x), 0);
  sections += renderGroups(node, 1, dir);

  const content = `
<div class="layout">
  ${sidebarHTML({ cat: dir, chain: [dir], rel: null })}
  <main id="main" class="art cat-page">
    ${crumbHTML([{ label: "Knowledge Base", href: "/" }, { label: meta.name, href: null }])}
    <div class="cat-head"><span class="cat-ic">${ICONS[meta.ic]}</span><h1 class="art-title">${esc(meta.name)}</h1></div>
    <div class="rule"></div>
    ${sections}
  </main>
</div>`;
  const outDir = path.join(DIST, slugify(dir));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), shell({
    title: `${meta.name} · Legito Knowledge Base`, desc: `${meta.name} · Legito Knowledge Base`, content, current: null, bodyClass: "page-cat",
  }));
}

/* ---------- home ---------- */
const featuredVids = [];
for (const a of articles) {
  if (!a.live) continue;
  for (const u of a.live.vimeo || []) {
    const vid = (u.match(/\/video\/(\d+)/) || [])[1];
    const p = posters[vid];
    if (p && p.poster) featuredVids.push({ art: a, vid, ...p, embed: u.replace(/&amp;/g, "&") });
  }
}
const homeVids = featuredVids.filter(v => ["1188072915", "630768730", "531283842", "724439217"].includes(v.vid)).slice(0, 4);

const homeContent = `
<section class="hero">
  <div class="hero-shapes" aria-hidden="true"><span class="sh sh1"></span><span class="sh sh2"></span><span class="sh sh3"></span><span class="sh sh4"></span></div>
  <div class="hero-in">
    <h1>How can we help?</h1>
    <button class="hero-search" id="heroSearch">${ICONS["magnifying-glass"]}<span>Search articles…</span><kbd>Ctrl K</kbd></button>
    <div class="hero-stats"><span><strong>${articles.length}</strong> articles</span><span class="hs-dot"></span><span><strong>${CATS.length}</strong> sections</span><span class="hs-dot"></span><span><strong>${totalVids}</strong> video guides</span></div>
  </div>
</section>
<main id="main">
<section class="cats">
  <div class="cats-in">
    ${CATS.map(([dir], i) => {
      const m = catMeta[dir];
      return `<a class="cat-card" href="/${slugify(dir)}/" style="--d:${i * 45}ms">
        <span class="cat-card-ic">${ICONS[m.ic]}</span>
        <span class="cat-card-t">${esc(m.name)}</span>
        <span class="cat-card-n">${catCount[dir]} article${catCount[dir] > 1 ? "s" : ""}</span>
        <span class="cat-card-go">Browse ${ICONS["arrow-right"]}</span>
      </a>`;
    }).join("")}
  </div>
</section>
<section class="home-vids">
  <div class="hv-in">
    <div class="hv-head"><h2>Video guides</h2></div>
    <div class="hv-grid">${homeVids.map(v => `
      <div class="hv-card">
        <div class="vid" data-embed="${esc(v.embed)}"><img loading="lazy" src="/${v.poster}" alt="${esc(v.title)}"><button class="vid-play" aria-label="Play: ${esc(v.title)}"><span class="vid-play-c">${ICONS.play}</span></button></div>
        <a class="hv-t" href="${v.art.route}">${esc(v.title)}</a><span class="hv-a">${esc(v.art.title)} · ${esc(catMeta[v.art.cat].name)}</span>
      </div>`).join("")}
    </div>
  </div>
</section>
</main>`;

fs.writeFileSync(path.join(DIST, "index.html"), shell({
  title: "Legito Knowledge Base (preview)",
  desc: "Legito Knowledge Base.",
  content: homeContent, current: null, bodyClass: "page-home",
}));

/* ---------- 404 ---------- */
fs.writeFileSync(path.join(DIST, "404.html"), shell({
  title: "Page not found · Legito Knowledge Base", desc: "",
  content: `<main id="main" class="nf"><h1>404</h1><p>Page not found.</p><a class="btn-primary" href="/">Back to the Knowledge Base ${ICONS["arrow-right"]}</a></main>`,
  current: null, bodyClass: "page-404",
}));

/* ---------- search index ---------- */
fs.writeFileSync(path.join(DIST, "search-docs.json"), stripEmDash(JSON.stringify(searchDocs)));

/* ---------- robots + vercel ---------- */
fs.writeFileSync(path.join(DIST, "robots.txt"), "User-agent: *\nDisallow: /\n");
fs.writeFileSync(path.join(DIST, "vercel.json"), JSON.stringify({
  cleanUrls: true, trailingSlash: true,
  headers: [
    { source: "/(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    { source: "/(live|media|fonts)/(.*)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
  ],
}, null, 2));

// keep the Vercel project link inside dist so `vercel deploy` targets legito-kb-preview
fs.mkdirSync(path.join(DIST, ".vercel"), { recursive: true });
fs.writeFileSync(path.join(DIST, ".vercel", "project.json"), JSON.stringify({
  projectId: "prj_zNBsbOCPjrhsOWOKCoULIjXjLDVd", orgId: "team_HnENiA2ac6CiyXkGLL2OtupK", projectName: "legito-kb-preview",
}));

// minisearch for the client
fs.copyFileSync(path.join(__dirname, "node_modules", "minisearch", "dist", "umd", "index.js"), path.join(DIST, "minisearch.js"));

const nPages = articles.length + CATS.length + 3;
console.log(`built ${nPages} pages, ${totalShots} live screenshots, ${totalVids} videos, search docs ${(fs.statSync(path.join(DIST, "search-docs.json")).size / 1024).toFixed(0)} KB`);
