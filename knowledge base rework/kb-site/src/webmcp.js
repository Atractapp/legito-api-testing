/* WebMCP (W3C Web Machine Learning CG draft) progressive enhancement.
   Registers KB tools for in-browser agents; no-op in browsers without modelContext. */
(function () {
  "use strict";

  var mc = (typeof document !== "undefined" && document.modelContext) ||
           (typeof navigator !== "undefined" && navigator.modelContext) || null;
  if (!mc) return;

  var mini = null;
  var docs = null;
  function loadIndex() {
    if (docs) return Promise.resolve();
    return fetch("/search-docs.json")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        docs = d;
        mini = new MiniSearch({
          fields: ["t", "h", "b", "c"],
          storeFields: ["t", "p", "c", "x"],
          searchOptions: { boost: { t: 4, h: 2, c: 1.5 }, prefix: true, fuzzy: 0.15, combineWith: "AND" }
        });
        mini.addAll(d);
      });
  }

  function text(s) {
    return { content: [{ type: "text", text: s }] };
  }

  var tools = [
    {
      name: "search-knowledge-base",
      description: "Full-text search over the Legito Knowledge Base (titles, headings and article text). Returns the best-matching articles with their paths.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", description: "Search terms, e.g. 'condition to switcher' or 'export pdf'" } },
        required: ["query"]
      },
      execute: function (args) {
        return loadIndex().then(function () {
          var hits = mini.search(String(args.query || "")).slice(0, 8);
          if (!hits.length) return text("No articles match \"" + args.query + "\".");
          return text(hits.map(function (h) {
            return h.t + " (" + h.c + ")\npath: " + h.p + "\n" + (h.x || "");
          }).join("\n\n"));
        });
      }
    },
    {
      name: "get-article",
      description: "Fetch the full text of one Knowledge Base article by its path (as returned by search-knowledge-base, e.g. /document-editor/saving-and-versions/saving/).",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", description: "Article path starting with /" } },
        required: ["path"]
      },
      execute: function (args) {
        var p = String(args.path || "");
        if (p.charAt(0) !== "/") p = "/" + p;
        return fetch(p).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.text();
        }).then(function (html) {
          var doc = new DOMParser().parseFromString(html, "text/html");
          var title = doc.querySelector(".art-title");
          var prose = doc.querySelector(".prose");
          if (!prose) return text("No article found at " + p + ".");
          var body = prose.textContent.replace(/\n{3,}/g, "\n\n").trim();
          if (body.length > 12000) body = body.slice(0, 12000) + "\n[truncated]";
          return text((title ? title.textContent + "\n\n" : "") + body);
        }).catch(function (e) {
          return text("Could not load " + p + ": " + e.message);
        });
      }
    },
    {
      name: "list-sections",
      description: "List the Knowledge Base sections with their paths.",
      inputSchema: { type: "object", properties: {} },
      execute: function () {
        var out = [];
        document.querySelectorAll(".side-cat").forEach(function (cat) {
          var name = cat.querySelector(".side-cat-btn span:nth-child(2)");
          var first = cat.querySelector(".side-link");
          if (name) out.push(name.textContent.trim() + (first ? " - e.g. " + first.getAttribute("href") : ""));
        });
        return Promise.resolve(text(out.length ? out.join("\n") : "No sections found on this page."));
      }
    }
  ];

  try {
    if (typeof mc.registerTool === "function") {
      tools.forEach(function (t) { mc.registerTool(t); });
    } else if (typeof mc.provideContext === "function") {
      mc.provideContext({ tools: tools });
    }
  } catch (e) {
    /* draft API in flux - never break the page over it */
  }
})();
