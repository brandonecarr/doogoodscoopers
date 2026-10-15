/**
 * Legacy HTML → design. Turns an email built elsewhere (the retired GrapesJS
 * builder, a pasted template, a send-ready handoff) into editable sections,
 * columns and blocks. Heuristic by nature: headings become titles, runs of inline
 * text become text blocks, images, buttons (a link with a background) and rules
 * are recognized, table rows with several content cells become columns, and
 * anything it can't place becomes an HTML block so nothing is lost.
 *
 * Runs on the server and in the browser (node-html-parser is pure JS).
 */

import { parse, HTMLElement, Node, NodeType } from "node-html-parser";
import {
  type Design, type Block, type Section, type Column, type TextStyle, type Align, type Border, type Spacing, type Visibility, emptyDesign, newSection, newBlock, spacing, uid, type BrandLibrary, DEFAULT_BRAND,
} from "./model";

const BLOCKY = new Set(["div", "p", "h1", "h2", "h3", "h4", "h5", "h6", "table", "tr", "td", "th", "tbody", "thead", "ul", "ol", "li", "section", "article", "header", "footer", "center", "blockquote", "hr", "img", "br"]);

interface Ctx { brand: BrandLibrary; blocks: Block[]; }

function styleOf(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (el.getAttribute("style") || "").split(";")) {
    const i = part.indexOf(":");
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}
const num = (v: string | undefined): number | undefined => {
  if (!v) return undefined;
  const m = v.match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : undefined;
};
const color = (v: string | undefined): string | undefined => (v && /^(#[0-9a-f]{3,8}|rgb)/i.test(v.trim()) ? v.trim() : undefined);

function textStyleFrom(el: HTMLElement): TextStyle {
  const s = styleOf(el);
  const t: TextStyle = {};
  if (s["font-family"]) t.font = s["font-family"];
  const size = num(s["font-size"]); if (size) t.size = size;
  const c = color(s["color"]); if (c) t.color = c;
  const lh = num(s["line-height"]);
  if (lh && size) t.lineHeight = lh > 4 ? Math.round((lh / size) * 100) / 100 : lh;
  if (/bold|[6-9]00/.test(s["font-weight"] || "") || ["b", "strong"].includes(el.tagName.toLowerCase())) t.bold = true;
  if (s["font-style"] === "italic") t.italic = true;
  const ls = num(s["letter-spacing"]); if (ls) t.letterSpacing = ls;
  if (s["text-transform"] === "uppercase") t.uppercase = true;
  return t;
}
function alignOf(el: HTMLElement): Align {
  let node: HTMLElement | null = el;
  for (let i = 0; i < 4 && node; i++) {
    const a = (styleOf(node)["text-align"] || node.getAttribute("align") || "").toLowerCase();
    if (a === "center" || a === "right") return a;
    if (a === "left") return "left";
    node = node.parentNode as HTMLElement | null;
  }
  return "left";
}

const KEPT_INLINE = ["color", "font-size", "font-weight", "font-style", "font-family", "letter-spacing", "text-decoration", "background-color", "border-radius", "padding", "display", "width", "height", "line-height", "text-align", "vertical-align"];
/** The inline styles a span or link keeps (mirrors the editor's sanitizeInline). */
function keptInline(el: HTMLElement): string {
  const s = styleOf(el);
  return KEPT_INLINE.filter((p) => s[p]).map((p) => `${p}:${s[p].replace(/"/g, "'")}`).join(";");
}

/** Inline HTML of an element with only the tags a text block supports. */
function inlineHtml(node: Node): string {
  if (node.nodeType === NodeType.TEXT_NODE) return node.rawText.replace(/\s+/g, " ");
  if (node.nodeType !== NodeType.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = el.childNodes.map(inlineHtml).join("");
  if (tag === "br") return "<br>";
  if (tag === "a") { const st = keptInline(el); return `<a href="${el.getAttribute("href") || "#"}"${st ? ` style="${st}"` : ""}>${inner}</a>`; }
  if (tag === "b" || tag === "strong") return `<b>${inner}</b>`;
  if (tag === "i" || tag === "em") return `<i>${inner}</i>`;
  if (tag === "u") return `<u>${inner}</u>`;
  if (tag === "s" || tag === "strike") return `<s>${inner}</s>`;
  if (tag === "span") {
    const st = keptInline(el);
    return st ? `<span style="${st}">${inner}</span>` : inner;
  }
  return inner;
}

const textOf = (el: Node) => el.text.replace(/\s+/g, " ").trim();
/** A throwaway element holding loose text, so it can be emitted like any leaf. */
const wrapText = (text: string): HTMLElement => { const el = parse("<div></div>").querySelector("div") as HTMLElement; el.set_content(text); return el; };

function isBlocky(n: Node): boolean {
  return n.nodeType === NodeType.ELEMENT_NODE && BLOCKY.has((n as HTMLElement).tagName.toLowerCase());
}
function hasBlockyChild(el: HTMLElement): boolean {
  return el.childNodes.some((n) => isBlocky(n) && (n as HTMLElement).tagName.toLowerCase() !== "br" && (n as HTMLElement).tagName.toLowerCase() !== "img");
}

/** Content cells of a table row (ignoring empty spacer cells). */
function contentCells(tr: HTMLElement): HTMLElement[] {
  return tr.childNodes.filter((n): n is HTMLElement => n.nodeType === NodeType.ELEMENT_NODE && /^t[dh]$/i.test((n as HTMLElement).tagName)).filter((td) => textOf(td) || td.querySelector("img"));
}

function emitText(ctx: Ctx, el: HTMLElement) {
  const html = inlineHtml(el).trim();
  if (!html.replace(/<br>/g, "").trim()) return;
  const tag = el.tagName.toLowerCase();
  const style = textStyleFrom(el);
  const size = style.size ?? 16;
  const isTitle = /^h[1-3]$/.test(tag) || (style.bold && size >= 22);
  const b = newBlock(isTitle ? "title" : "text", ctx.brand);
  if (b.type === "title") { b.level = tag === "h1" || size >= 30 ? 1 : tag === "h2" || size >= 24 ? 2 : 3; b.html = html; b.align = alignOf(el); b.style = style; }
  else if (b.type === "text") { b.html = html; b.align = alignOf(el); b.style = style; }
  const s = styleOf(el);
  const p = num(s["padding"]) ?? 0;
  b.padding = spacing(num(s["padding-top"]) ?? p, num(s["padding-right"]) ?? p, num(s["padding-bottom"]) ?? p, num(s["padding-left"]) ?? p);
  b.name = isTitle ? textOf(el).slice(0, 24) : undefined;
  ctx.blocks.push(b);
}

function emitImage(ctx: Ctx, img: HTMLElement, link?: HTMLElement) {
  const src = img.getAttribute("src") || "";
  if (!src) return;
  const w = num(img.getAttribute("width") || undefined) ?? num(styleOf(img)["width"]);
  const b = newBlock("image", ctx.brand);
  if (b.type !== "image") return;
  b.src = src; b.alt = img.getAttribute("alt") || ""; b.href = link?.getAttribute("href") || "";
  b.width = w && w < 600 ? w : null; b.widthUnit = "px";
  b.imageRadius = num(styleOf(img)["border-radius"]) ?? 0;
  b.name = /logo/i.test(src + " " + b.alt) ? "Logo" : undefined;
  ctx.blocks.push(b);
}

function emitButton(ctx: Ctx, a: HTMLElement, cell?: HTMLElement) {
  const b = newBlock("button", ctx.brand);
  if (b.type !== "button") return;
  const s = styleOf(a);
  const cs = cell ? styleOf(cell) : {};
  b.label = textOf(a); b.href = a.getAttribute("href") || "";
  const bg = color(s["background-color"] || s["background"]) || color(cs["background-color"]) || (cell?.getAttribute("bgcolor") ?? undefined);
  if (bg) b.buttonBg = bg;
  const r = num(s["border-radius"]) ?? num(cs["border-radius"]); if (r !== undefined) b.buttonRadius = r;
  const st = textStyleFrom(a); b.style = st;
  const p = num(s["padding"]);
  if (p !== undefined || s["padding-top"]) b.inner = spacing(num(s["padding-top"]) ?? p ?? 12, num(s["padding-right"]) ?? p ?? 22, num(s["padding-bottom"]) ?? p ?? 12, num(s["padding-left"]) ?? p ?? 22);
  b.align = cell ? alignOf(cell) : "center";
  b.name = b.label.slice(0, 24);
  ctx.blocks.push(b);
}

/** Walk an element's content, emitting blocks into ctx. */
function walk(ctx: Ctx, el: HTMLElement) {
  const tag = el.tagName.toLowerCase();
  const s = styleOf(el);
  // A small colored/rounded box around a single run of text (a chip, a badge) → one styled text block.
  if (/^(table|td|div)$/.test(tag)) {
    const card = cardOf(el);
    const leaves = el.querySelectorAll("div, p, span, td").filter((n) => textOf(n) && !hasBlockyChild(n));
    if (card && leaves.length === 1 && !el.querySelector("img") && textOf(el) === textOf(leaves[0])) {
      const before = ctx.blocks.length;
      emitText(ctx, leaves[0]);
      const b = ctx.blocks[before];
      if (b) {
        if (card.bg) b.background = card.bg; if (card.radius) b.radius = card.radius; if (card.border) b.border = { ...card.border };
        const pd = paddingOf(leaves[0]) ?? paddingOf(el.querySelector("td") || el);
        if (pd) b.padding = pd;
        const al = (el.getAttribute("align") || "").toLowerCase();
        if (b.type === "text" && (al === "right" || al === "center")) b.align = al;
      }
      return;
    }
  }
  if (tag === "style" || tag === "script" || tag === "head" || tag === "title") return;
  if (s["display"] === "none" || /display\s*:\s*none/.test(el.getAttribute("style") || "")) return; // preheaders etc.
  if (tag === "img") return emitImage(ctx, el);
  if (tag === "hr") { const d = newBlock("divider", ctx.brand); ctx.blocks.push(d); return; }
  if (tag === "a") {
    const img = el.querySelector("img");
    if (img && !textOf(el)) return emitImage(ctx, img, el);
    const bg = s["background-color"] || s["background"];
    if (bg || s["display"] === "block" || s["display"] === "inline-block") return emitButton(ctx, el);
  }
  // A link-only cell with a background is a button too.
  if (/^t[dh]$/.test(tag)) {
    const onlyChild = el.childNodes.filter((n) => n.nodeType !== NodeType.TEXT_NODE || n.rawText.trim());
    if (onlyChild.length === 1 && onlyChild[0].nodeType === NodeType.ELEMENT_NODE && (onlyChild[0] as HTMLElement).tagName.toLowerCase() === "a" && (el.getAttribute("bgcolor") || s["background-color"])) {
      return emitButton(ctx, onlyChild[0] as HTMLElement, el);
    }
    // A cell whose only content is a top border is a divider.
    if (!textOf(el) && !el.querySelector("img") && /border-top/.test(el.getAttribute("style") || "")) {
      const d = newBlock("divider", ctx.brand);
      if (d.type === "divider") { d.color = color(s["border-top"]?.split(/\s+/).pop()) || d.color; d.thickness = num(s["border-top"]) ?? 1; }
      ctx.blocks.push(d); return;
    }
  }
  if (!hasBlockyChild(el)) {
    // A paragraph that is just one styled link is a button.
    const links = el.querySelectorAll("a");
    if (links.length === 1 && textOf(el) === textOf(links[0]) && (styleOf(links[0])["background-color"] || styleOf(links[0])["background"])) return emitButton(ctx, links[0], el);
    // Leaf: text (possibly with inline tags) or empty spacer.
    if (textOf(el)) return emitText(ctx, el);
    const h = num(s["height"]) ?? num(el.getAttribute("height") || undefined);
    if (h && h >= 8 && !el.querySelector("img")) { const sp = newBlock("spacer", ctx.brand); if (sp.type === "spacer") sp.height = h; ctx.blocks.push(sp); }
    return;
  }
  for (const child of el.childNodes) {
    if (child.nodeType === NodeType.TEXT_NODE) {
      if (child.rawText.trim()) emitText(ctx, wrapText(child.rawText));
      continue;
    }
    if (child.nodeType === NodeType.ELEMENT_NODE) walk(ctx, child as HTMLElement);
  }
}

// ── Sections ────────────────────────────────────────────────────────────────

/** A colored or rounded container: its look is carried onto the sections built inside it. */
interface Card { bg?: string; radius?: number; border?: Border | null; padding?: Spacing }
interface Walk { brand: BrandLibrary; out: Section[]; multi: Set<HTMLElement> }

function cardOf(el: HTMLElement): Card | null {
  const st = styleOf(el);
  const bg = el.getAttribute("bgcolor") || color(st["background-color"]) || color(st["background"]);
  const radius = num(st["border-radius"]);
  const bm = (st["border"] || "").match(/(\d+)px\s+(solid|dashed|dotted)\s+(#[0-9a-fA-F]{3,8})/);
  const border: Border | null = bm ? { size: Number(bm[1]), style: bm[2] as Border["style"], color: bm[3] } : null;
  if (!bg && !radius && !border) return null;
  return { bg: bg || undefined, radius, border };
}
function paddingOf(el: HTMLElement): Spacing | null {
  const st = styleOf(el);
  const p = num(st["padding"]);
  const parts = (st["padding"] || "").split(/\s+/).map((x) => num(x) ?? 0);
  let base: Spacing | null = null;
  if (st["padding"]) {
    base = parts.length === 1 ? spacing(parts[0]) : parts.length === 2 ? spacing(parts[0], parts[1]) : parts.length === 3 ? spacing(parts[0], parts[1], parts[2]) : spacing(parts[0], parts[1], parts[2], parts[3]);
  }
  const t = num(st["padding-top"]), r = num(st["padding-right"]), b = num(st["padding-bottom"]), l = num(st["padding-left"]);
  if (base === null && t === undefined && r === undefined && b === undefined && l === undefined) return null;
  const out = base ?? spacing(p ?? 0);
  if (t !== undefined) out.top = t; if (r !== undefined) out.right = r; if (b !== undefined) out.bottom = b; if (l !== undefined) out.left = l;
  return out;
}
const contains = (ancestor: HTMLElement, node: HTMLElement): boolean => {
  let p = node.parentNode as HTMLElement | null;
  while (p) { if (p === ancestor) return true; p = p.parentNode as HTMLElement | null; }
  return false;
};
/** The `.hide` / `.stack` conventions of handoff emails. */
const visibilityOf = (el: HTMLElement): Visibility => (/\bhide\b/.test(el.getAttribute("class") || "") ? "desktop" : "all");

function applyCard(sec: Section, card: Card | null, padding: Spacing | null) {
  if (card?.bg) sec.background = card.bg;
  if (card?.radius) sec.radius = card.radius;
  if (card?.border) sec.border = { ...card.border };
  sec.padding = padding ?? (card ? spacing(16, 24) : spacing(0, 24));
}

/** Blocks → a single-column section (or appended to an open one of the same card). */
function emitSection(w: Walk, blocks: Block[], card: Card | null, padding: Spacing | null, name?: string) {
  if (!blocks.length) return;
  const sec = newSection([100], name);
  applyCard(sec, card, padding);
  sec.columns[0].blocks = blocks;
  w.out.push(sec);
}

/** Rows whose cells each carry content are the multi-column sections. */
function multiRows(root: HTMLElement): Set<HTMLElement> {
  const trs = root.querySelectorAll("tr").filter((tr) => contentCells(tr).length >= 2);
  const set = new Set(trs);
  // Keep only outermost ones; nested multi-cell rows are flattened by walk().
  for (const tr of trs) { let p = tr.parentNode as HTMLElement | null; while (p) { if (set.has(p)) { set.delete(tr); break; } p = p.parentNode as HTMLElement | null; } }
  return set;
}

function rowSection(w: Walk, tr: HTMLElement, card: Card | null, padding: Spacing | null): Section {
  const cells = contentCells(tr);
  const sec = newSection(cells.map(() => Math.round(100 / cells.length)));
  applyCard(sec, card, padding);
  cells.forEach((td, i) => {
    const col: Column = sec.columns[i];
    const w0 = num(td.getAttribute("width") || undefined) ?? num(styleOf(td)["width"]);
    if (w0 && w0 <= 100 && /%/.test(td.getAttribute("width") || styleOf(td)["width"] || "")) col.width = w0;
    col.vAlign = (td.getAttribute("valign") as Column["vAlign"]) || "top";
    col.visibility = visibilityOf(td);
    // A cell that is (or holds) a card: the tile look goes on the column.
    const inner = (td.childNodes.filter((n) => n.nodeType === NodeType.ELEMENT_NODE) as HTMLElement[]).filter((e) => /^(table|td|div)$/i.test(e.tagName));
    const isTile = (c: Card | null) => !!c && (c.radius ?? 0) < 60;
    const tile = isTile(cardOf(td)) ? cardOf(td) : inner.length >= 1 && inner.length <= 2 && isTile(cardOf(inner[0])) ? cardOf(inner[0]) : null;
    const tileEl = isTile(cardOf(td)) ? td : inner[0];
    if (tile) {
      if (tile.bg) col.background = tile.bg; if (tile.radius) col.radius = tile.radius; if (tile.border) col.border = { ...tile.border };
      const pd = paddingOf(tileEl.querySelector("td") || tileEl) ?? paddingOf(tileEl);
      if (pd) col.padding = pd;
    }
    const ctx: Ctx = { brand: w.brand, blocks: [] };
    walk(ctx, td);
    col.blocks = ctx.blocks;
  });
  // Equalize widths that don't add up.
  const total = sec.columns.reduce((n, c) => n + c.width, 0);
  if (total < 95 || total > 105) sec.columns.forEach((c) => (c.width = Math.round(100 / sec.columns.length)));
  return sec;
}

/** Convert an element into sections, carrying the enclosing card's look and the enclosing cell's padding. */
function collect(w: Walk, el: HTMLElement, card: Card | null, padding: Spacing | null) {
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "style" || tag === "script" || tag === "head" || tag === "title") return;
  if (/display\s*:\s*none/.test(el.getAttribute("style") || "")) return;
  if (w.multi.has(el)) { w.out.push(rowSection(w, el, card, padding)); return; }
  const hasMulti = [...w.multi].some((tr) => contains(el, tr));
  const own = cardOf(el);
  if (own && hasMulti && (tag === "td" || tag === "table" || tag === "div")) {
    // A card around several rows: everything inside becomes sections sharing its look.
    const start = w.out.length;
    for (const c of el.childNodes) if (c.nodeType === NodeType.ELEMENT_NODE) collect(w, c as HTMLElement, own, paddingOf(el) ?? padding);
    const made = w.out.slice(start);
    if (made.length > 1 && (own.radius || own.border)) {
      made.forEach((sec, idx) => {
        const first = idx === 0, last = idx === made.length - 1;
        sec.radiusCorners = first && last ? "all" : first ? "top" : last ? "bottom" : undefined;
        if (!first && !last) sec.radius = 0;
        if (sec.border) sec.border.sides = first && last ? undefined : first ? ["top", "left", "right"] : last ? ["bottom", "left", "right"] : ["left", "right"];
      });
    }
    return;
  }
  if (hasMulti) {
    const pd = (tag === "td" || tag === "div") ? paddingOf(el) ?? padding : padding;
    for (const c of el.childNodes) if (c.nodeType === NodeType.ELEMENT_NODE) collect(w, c as HTMLElement, card, pd);
    return;
  }
  // No column rows inside: this is a run of blocks. A cell with padding, or a card, is its own section.
  const pd = paddingOf(el);
  if (tag === "td" || own || (tag === "div" && pd)) {
    let ctx: Ctx = { brand: w.brand, blocks: [] };
    const flush = () => {
      if (!ctx.blocks.length) return;
      const sec = newSection([100]);
      applyCard(sec, own ?? card, pd ?? padding);
      if (own && card?.bg && !own.bg) sec.background = card.bg;
      sec.columns[0].blocks = ctx.blocks;
      sec.visibility = visibilityOf(el);
      w.out.push(sec);
      ctx = { brand: w.brand, blocks: [] };
    };
    const isNestedCard = (c: HTMLElement) => !own && /^(table|div)$/i.test(c.tagName) && !!cardOf(c) && c.querySelectorAll("div, p, td").filter((n) => textOf(n) && !hasBlockyChild(n)).length > 1;
    if (!hasBlockyChild(el)) walk(ctx, el);
    else for (const c of el.childNodes) {
      if (c.nodeType === NodeType.ELEMENT_NODE) {
        const ce = c as HTMLElement;
        if (isNestedCard(ce)) {
          // Its own section with its own look, inset by this cell's side padding.
          flush();
          const start = w.out.length;
          collect(w, ce, card, paddingOf(ce.querySelector("td") || ce));
          const inset = pd ?? padding;
          if (inset) for (const sec of w.out.slice(start)) sec.margin = spacing(0, inset.right, 0, inset.left);
          continue;
        }
        walk(ctx, ce);
      } else if (c.nodeType === NodeType.TEXT_NODE && c.rawText.trim()) emitText(ctx, wrapText(c.rawText));
    }
    flush();
    return;
  }
  for (const c of el.childNodes) {
    if (c.nodeType === NodeType.ELEMENT_NODE) collect(w, c as HTMLElement, card, padding);
    else if (c.nodeType === NodeType.TEXT_NODE && c.rawText.trim()) emitSection(w, (() => { const ctx: Ctx = { brand: w.brand, blocks: [] }; emitText(ctx, wrapText(c.rawText)); return ctx.blocks; })(), card, padding);
  }
}

/** Converts a complete email (or a fragment) into a design. */
export function importHtml(html: string, brand: BrandLibrary = DEFAULT_BRAND): Design {
  const design = emptyDesign(brand);
  const root = parse(html, { comment: false, blockTextElements: { script: true, style: true } });
  const body = (root.querySelector("body") || root) as HTMLElement;

  // Page background from the outermost colored container.
  const outer = body.querySelector("table[bgcolor], table[style*='background'], td[bgcolor]");
  const pageBg = body.getAttribute?.("bgcolor") || color(styleOf(body)["background-color"]) || (outer ? outer.getAttribute("bgcolor") || color(styleOf(outer)["background-color"]) : undefined);
  if (pageBg) design.styles.pageBg = pageBg;

  // Preheader (hidden span/div at the top).
  const hidden = body.querySelectorAll("span, div").find((n) => /display\s*:\s*none/.test(n.getAttribute("style") || "") && textOf(n));
  if (hidden) design.styles.preheader = textOf(hidden).replace(/[\u200c\u00a0]+/g, " ").trim().slice(0, 200);

  const w: Walk = { brand, out: [], multi: multiRows(body) };
  // The outermost page table and the 600px wrapper aren't cards; skip straight to content.
  collect(w, body, null, null);

  const sections = w.out.filter((s) => s.columns.some((c) => c.blocks.length));
  if (!sections.length) {
    const sec = newSection([100], "Imported HTML");
    sec.padding = spacing(0);
    const b = newBlock("html", brand);
    if (b.type === "html") b.html = body.innerHTML || html;
    b.name = "Imported HTML";
    sec.columns[0].blocks = [b];
    design.sections = [sec];
    return design;
  }
  // The page/body wrapper colors are not section colors.
  for (const sec of sections) if (sec.background && sec.background.toLowerCase() === (design.styles.pageBg || "").toLowerCase()) sec.background = null;
  design.sections = sections.map((s, i) => ({ ...s, id: uid(), name: s.name || `Section ${i + 1}` }));
  design.styles.bodyBg = design.styles.pageBg;
  return design;
}
