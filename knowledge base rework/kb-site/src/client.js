/* Legito KB preview — client interactions (vanilla, no framework). */
(function () {
  "use strict";

  /* ---------- sidebar accordions ---------- */
  document.querySelectorAll(".side-cat-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var open = btn.parentElement.classList.toggle("open");
      btn.setAttribute("aria-expanded", open);
    });
  });
  document.querySelectorAll(".side-group-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var open = btn.parentElement.classList.toggle("open");
      btn.setAttribute("aria-expanded", open);
    });
  });
  var navToggle = document.getElementById("navToggle");
  if (navToggle) {
    navToggle.addEventListener("click", function () {
      document.body.classList.toggle("nav-open");
    });
    document.addEventListener("click", function (e) {
      if (document.body.classList.contains("nav-open") &&
          !e.target.closest("#sidebar") && !e.target.closest("#navToggle")) {
        document.body.classList.remove("nav-open");
      }
    });
  }
  document.querySelectorAll(".lt-gbtn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var open = btn.parentElement.classList.toggle("open");
      btn.setAttribute("aria-expanded", open);
    });
  });

  var active = document.querySelector(".side-link.active");
  if (active) active.scrollIntoView({ block: "center" });

  /* ---------- video facades ---------- */
  document.querySelectorAll(".vid[data-embed]").forEach(function (v) {
    var btn = v.querySelector(".vid-play");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var src = v.getAttribute("data-embed");
      var sep = src.indexOf("?") > -1 ? "&" : "?";
      var f = document.createElement("iframe");
      f.src = src + sep + "autoplay=1";
      f.allow = "autoplay; fullscreen; picture-in-picture";
      f.setAttribute("allowfullscreen", "");
      v.innerHTML = "";
      v.appendChild(f);
    });
  });

  /* ---------- lightbox ---------- */
  var lb = document.getElementById("lightbox");
  if (lb) {
    var lbImg = document.getElementById("lbImg");
    var lbCap = document.getElementById("lbCap");
    var items = [];
    var cur = 0;
    function collect() {
      items = [];
      document.querySelectorAll("a[data-lb], img.shot").forEach(function (el) {
        items.push({
          src: el.tagName === "A" ? el.getAttribute("href") : el.getAttribute("src"),
          cap: el.tagName === "A" ? (el.getAttribute("data-cap") || "") : (el.getAttribute("alt") || ""),
          el: el
        });
      });
    }
    function show(i) {
      cur = (i + items.length) % items.length;
      lbImg.src = items[cur].src;
      lbCap.textContent = items[cur].cap;
      lb.hidden = false;
      document.body.style.overflow = "hidden";
    }
    function close() {
      lb.hidden = true;
      lbImg.src = "";
      document.body.style.overflow = "";
    }
    collect();
    items.forEach(function (it, i) {
      it.el.addEventListener("click", function (e) {
        e.preventDefault();
        show(i);
      });
    });
    lb.querySelectorAll("[data-lbclose]").forEach(function (el) {
      el.addEventListener("click", close);
    });
    lb.querySelector(".lb-prev").addEventListener("click", function () { show(cur - 1); });
    lb.querySelector(".lb-next").addEventListener("click", function () { show(cur + 1); });
    document.addEventListener("keydown", function (e) {
      if (lb.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(cur - 1);
      if (e.key === "ArrowRight") show(cur + 1);
    });
  }

  /* ---------- TOC scroll-spy ---------- */
  var tocLinks = document.querySelectorAll(".toc a");
  if (tocLinks.length) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var current = null;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          if (current) current.classList.remove("on");
          current = map[en.target.id];
          if (current) current.classList.add("on");
        }
      });
    }, { rootMargin: "-80px 0px -70% 0px" });
    document.querySelectorAll(".prose .hd[id], .gallery .hd[id], .related .hd[id]").forEach(function (h) {
      if (map[h.id]) obs.observe(h);
    });
  }

  /* ---------- search palette ---------- */
  var palette = document.getElementById("palette");
  var input = document.getElementById("paletteInput");
  var results = document.getElementById("paletteResults");
  var mini = null;
  var docs = null;
  var sel = 0;
  var shown = [];

  function loadIndex() {
    if (docs) return Promise.resolve();
    return fetch("/search-docs.json")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        docs = d;
        mini = new MiniSearch({
          fields: ["t", "h", "b", "c"],
          storeFields: ["t", "p", "c", "x", "v"],
          searchOptions: {
            boost: { t: 4, h: 2, c: 1.5 },
            prefix: true,
            fuzzy: 0.15,
            combineWith: "AND"
          }
        });
        mini.addAll(d);
      });
  }

  function openPalette() {
    palette.hidden = false;
    document.body.style.overflow = "hidden";
    input.focus();
    input.select();
    loadIndex().then(function () { if (input.value) render(input.value); });
  }
  function closePalette() {
    palette.hidden = true;
    document.body.style.overflow = "";
  }

  function hl(text, terms) {
    var out = text;
    terms.forEach(function (t) {
      if (t.length < 2) return;
      out = out.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "$1");
    });
    return out.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(//g, "<mark>").replace(//g, "</mark>");
  }

  function render(q) {
    if (!mini) return;
    q = q.trim();
    if (!q) {
      results.innerHTML = '<div class="palette-hint">Type to search titles, sections and full article text.</div>';
      shown = [];
      return;
    }
    var hits = mini.search(q).slice(0, 24);
    var terms = q.split(/\s+/);
    if (!hits.length) {
      results.innerHTML = '<div class="palette-hint">No results for “' + q.replace(/</g, "&lt;") + '”.</div>';
      shown = [];
      return;
    }
    var groups = {};
    var order = [];
    hits.forEach(function (h) {
      var g = h.c.split(" / ")[0];
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(h);
    });
    var html = "";
    var flat = [];
    order.forEach(function (g) {
      html += '<div class="pr-group">' + g + "</div>";
      groups[g].forEach(function (h) {
        var i = flat.length;
        flat.push(h);
        html += '<a class="pr-item' + (i === 0 ? " sel" : "") + '" data-i="' + i + '" href="' + h.p + '">' +
          '<span class="pr-t">' + hl(h.t, terms) + (h.v ? '<svg class="ic" viewBox="0 0 576 512" fill="currentColor" aria-hidden="true"><path d="M0 128C0 92.7 28.7 64 64 64H320c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128zM559.1 99.8c10.4 5.6 16.9 16.4 16.9 28.2V384c0 11.8-6.5 22.6-16.9 28.2s-23 5-32.9-1.6l-96-64L416 337.1V320 192 174.9l14.2-9.5 96-64c9.8-6.5 22.4-7.2 32.9-1.6z"/></svg>' : "") + "</span>" +
          '<span class="pr-c">' + h.c + "</span>" +
          '<span class="pr-x">' + hl(h.x || "", terms) + "</span></a>";
      });
    });
    results.innerHTML = html;
    shown = flat;
    sel = 0;
  }

  function move(d) {
    var els = results.querySelectorAll(".pr-item");
    if (!els.length) return;
    els[sel] && els[sel].classList.remove("sel");
    sel = (sel + d + els.length) % els.length;
    els[sel].classList.add("sel");
    els[sel].scrollIntoView({ block: "nearest" });
  }

  if (palette) {
    ["searchBtn", "heroSearch"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener("click", openPalette);
    });
    palette.querySelectorAll("[data-close]").forEach(function (el) {
      el.addEventListener("click", closePalette);
    });
    var deb = null;
    input.addEventListener("input", function () {
      clearTimeout(deb);
      deb = setTimeout(function () {
        loadIndex().then(function () { render(input.value); });
      }, 80);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") {
        var el = results.querySelectorAll(".pr-item")[sel];
        if (el) window.location.href = el.getAttribute("href");
      }
    });
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        palette.hidden ? openPalette() : closePalette();
      } else if (e.key === "/" && palette.hidden &&
                 !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        openPalette();
      } else if (e.key === "Escape" && !palette.hidden) {
        closePalette();
      }
    });
  }
})();
