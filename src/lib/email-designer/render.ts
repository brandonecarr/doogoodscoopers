/**
 * Design → email HTML. Tables with inline styles, a 600px wrapper, Outlook
 * conditionals, mobile stacking and show-on-device classes; tokens left in place
 * for the sender (renderTemplate) and show-conditions wrapped in comment markers
 * (see conditions.ts). The style resolvers here are shared with the canvas so the
 * editor and the sent email agree.
 */

import {
  type Design, type Section, type Column, type Block, type Box, type TextStyle, type TextRole, type Spacing, type Border, type GlobalStyles,
  type SocialNetwork, googleFontsIn, darkOf,
} from "./model";

export const ICON_BASE = "https://oxorxznxhwdortpblfke.supabase.co/storage/v1/object/public/email-assets/social";
export const SOCIAL_LABEL: Record<SocialNetwork, string> = {
  facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X", linkedin: "LinkedIn", google: "Google", yelp: "Yelp", nextdoor: "Nextdoor", website: "Website",
};
export const socialIconUrl = (network: SocialNetwork, style: "color" | "dark" | "light") => `${ICON_BASE}/${style}/${network}.png`;

export const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const px = (n: number) => `${Math.round(n)}px`;
export const pad = (s: Spacing) => `${px(s.top)} ${px(s.right)} ${px(s.bottom)} ${px(s.left)}`;
const isZero = (s: Spacing) => !s.top && !s.right && !s.bottom && !s.left;

/** CSS declarations → one inline style string. */
export const css = (decl: Record<string, string | number | null | undefined>): string =>
  Object.entries(decl).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => `${k}:${v}`).join(";");

// ── Style resolution (shared with the canvas) ────────────────────────────────

export function roleFor(styles: GlobalStyles, block: Block): TextRole {
  if (block.type === "title") return block.level === 1 ? styles.text.title1 : block.level === 2 ? styles.text.title2 : styles.text.title3;
  return styles.text.paragraph;
}

/** The resolved text style of a block: its own overrides on top of the global role. */
export function textStyleOf(styles: GlobalStyles, block: Block, own: TextStyle | undefined): Required<Pick<TextStyle, "font" | "size" | "color" | "lineHeight" | "bold" | "italic" | "letterSpacing" | "uppercase">> {
  const role = roleFor(styles, block);
  return {
    font: own?.font || role.font,
    size: own?.size ?? role.size,
    color: own?.color || role.color,
    lineHeight: own?.lineHeight ?? role.lineHeight,
    bold: own?.bold ?? role.bold,
    italic: own?.italic ?? false,
    letterSpacing: own?.letterSpacing ?? role.letterSpacing,
    uppercase: own?.uppercase ?? false,
  };
}

export function textCss(styles: GlobalStyles, block: Block, own: TextStyle | undefined, align?: string): Record<string, string> {
  const t = textStyleOf(styles, block, own);
  return {
    "font-family": t.font,
    "font-size": px(t.size),
    "line-height": `${Math.round(t.size * t.lineHeight)}px`,
    "mso-line-height-rule": "exactly",
    color: t.color,
    "font-weight": t.bold ? "bold" : "normal",
    "font-style": t.italic ? "italic" : "normal",
    "letter-spacing": t.letterSpacing ? `${t.letterSpacing}px` : "normal",
    "text-transform": t.uppercase ? "uppercase" : "none",
    "text-align": align || "left",
    margin: "0",
  };
}

export function linkCss(styles: GlobalStyles): Record<string, string> {
  return {
    color: styles.link.color,
    "font-weight": styles.link.bold ? "bold" : "inherit",
    "font-style": styles.link.italic ? "italic" : "inherit",
    "text-decoration": styles.link.underline ? "underline" : "none",
  };
}

export function borderCss(b: Border | null): string | null {
  return b && b.size > 0 ? `${px(b.size)} ${b.style} ${b.color}` : null;
}

/** Border declarations honoring `sides` (a single shorthand when every side is on). */
export function borderDecl(b: Border | null): Record<string, string> {
  const v = borderCss(b);
  if (!v || !b) return {};
  const sides = b.sides && b.sides.length ? b.sides : null;
  if (!sides || sides.length === 4) return { border: v };
  const out: Record<string, string> = {};
  for (const s of sides) out[`border-${s}`] = v;
  return out;
}

/** Radius declarations honoring `radiusCorners`. */
export function radiusDecl(radius: number, corners: Box["radiusCorners"]): Record<string, string> {
  if (!radius) return {};
  const r = px(radius);
  if (!corners || corners === "all") return { "border-radius": r };
  return corners === "top" ? { "border-top-left-radius": r, "border-top-right-radius": r } : { "border-bottom-left-radius": r, "border-bottom-right-radius": r };
}

/** The cell that holds a block or column: padding (margin + padding), background, radius, border. */
export function boxCss(box: Box, extra: Record<string, string | null | undefined> = {}): Record<string, string | null | undefined> {
  return {
    padding: isZero(box.padding) ? null : pad(box.padding),
    "background-color": box.background || null,
    ...radiusDecl(box.radius, box.radiusCorners),
    ...borderDecl(box.border),
    ...extra,
  };
}

/** Style of the cell that carries a box's margin: the margin as padding, plus the optional paint behind it. */
export function marginCss(box: Box): Record<string, string | null | undefined> {
  return {
    padding: isZero(box.margin) ? null : pad(box.margin),
    "background-color": box.outer?.background || null,
    ...borderDecl(box.outer?.border ?? null),
  };
}

const visibilityClass = (v: Box["visibility"]) => (v === "desktop" ? "dgs-desktop" : v === "mobile" ? "dgs-mobile" : "");

// ── Inline rich text ─────────────────────────────────────────────────────────

/** Apply the link style to anchors inside a rich-text run (inline styles win in mail clients). */
export function styleLinks(html: string, styles: GlobalStyles): string {
  const l = css(linkCss(styles));
  return html.replace(/<a\b([^>]*)>/gi, (m, attrs: string) => {
    if (/\bstyle=/i.test(attrs)) return m;
    return `<a${attrs} class="dgs-a" style="${l}">`;
  });
}

// ── Blocks ───────────────────────────────────────────────────────────────────

export function renderBlock(block: Block, styles: GlobalStyles): string {
  switch (block.type) {
    case "title": {
      const tag = `h${block.level}`;
      return `<${tag} class="dgs-t" style="${css(textCss(styles, block, block.style, block.align))}">${styleLinks(block.html, styles)}</${tag}>`;
    }
    case "text":
      return `<div class="dgs-t" style="${css(textCss(styles, block, block.style, block.align))}">${styleLinks(block.html, styles)}</div>`;
    case "dynamic": {
      const value = `{{${block.token}}}`;
      return `<div class="dgs-t" style="${css(textCss(styles, block, block.style, block.align))}">${esc(block.prefix)}${value}${esc(block.suffix)}</div>`;
    }
    case "image":
    case "logo": {
      const width = block.type === "logo" ? `${block.width}px` : block.width ? `${block.width}${block.widthUnit}` : "100%";
      const radius = block.type === "image" && block.imageRadius ? `border-radius:${px(block.imageRadius)};` : "";
      const img = `<img src="${esc(block.src)}" alt="${esc(block.alt)}" width="${block.type === "logo" ? block.width : block.width && block.widthUnit === "px" ? block.width : ""}" style="display:block;border:0;outline:none;text-decoration:none;width:${width};max-width:100%;height:auto;${radius}" />`;
      const inner = block.href ? `<a href="${esc(block.href)}" style="display:inline-block;text-decoration:none;">${img}</a>` : img;
      if (!block.src) return `<div style="border:1px dashed #cbd5e1;border-radius:8px;padding:28px;text-align:center;color:#94a3b8;font-family:Arial,sans-serif;font-size:13px;">Image</div>`;
      return `<div style="text-align:${block.align};">${inner}</div>`;
    }
    case "video": {
      const width = block.width ? `${block.width}px` : "100%";
      const play = block.playButton ? `<div style="position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:32px;background:rgba(11,27,43,.75);"><div style="width:0;height:0;border-left:22px solid #fff;border-top:13px solid transparent;border-bottom:13px solid transparent;margin:19px 0 0 24px;"></div></div>` : "";
      if (!block.thumbnail) return `<div style="border:1px dashed #cbd5e1;border-radius:8px;padding:28px;text-align:center;color:#94a3b8;font-family:Arial,sans-serif;font-size:13px;">Video thumbnail</div>`;
      return `<div style="text-align:${block.align};"><a href="${esc(block.href)}" style="display:inline-block;position:relative;text-decoration:none;width:${width};max-width:100%;"><img src="${esc(block.thumbnail)}" alt="${esc(block.alt)}" style="display:block;border:0;width:100%;height:auto;border-radius:8px;" />${play}</a></div>`;
    }
    case "button": {
      const b = styles.button;
      const t = block.style;
      const font = t.font || b.font, size = t.size ?? b.size, color = t.color || b.color, bold = t.bold ?? b.bold;
      const bg = block.buttonBg || b.bg, radius = block.buttonRadius ?? b.radius;
      const width = block.width ? `${block.width}${block.widthUnit}` : b.width ? `${b.width}px` : null;
      const border = block.buttonBorder ? borderCss(block.buttonBorder) : b.borderSize ? `${px(b.borderSize)} solid ${b.borderColor}` : null;
      const tdStyle = css({ "background-color": bg, "border-radius": px(radius), border, "mso-padding-alt": pad(block.inner) });
      const aStyle = css({
        display: "inline-block", padding: pad(block.inner), "font-family": font, "font-size": px(size), "font-weight": bold ? "bold" : "normal",
        color, "text-decoration": "none", "line-height": px(Math.round(size * 1.2)), "mso-line-height-rule": "exactly", "border-radius": px(radius),
        width: width ? "100%" : null, "box-sizing": width ? "border-box" : null, "text-align": "center",
      });
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${block.align}" style="${width ? `width:${width};max-width:100%;` : ""}"><tr><td align="center" bgcolor="${bg}" style="${tdStyle}"><a href="${esc(block.href)}" style="${aStyle}">${esc(block.label)}</a></td></tr></table>`;
    }
    case "divider":
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${block.align}" width="${block.width}%" style="width:${block.width}%;"><tr><td style="border-top:${px(block.thickness)} ${block.lineStyle} ${block.color};font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
    case "spacer":
      return `<div style="height:${px(block.height)};line-height:${px(block.height)};font-size:0;">&nbsp;</div>`;
    case "social": {
      const cells = block.items.map((it) =>
        `<td style="padding:0 ${px(block.gap / 2)};"><a href="${esc(it.url)}" title="${SOCIAL_LABEL[it.network]}" style="display:inline-block;text-decoration:none;"><img src="${socialIconUrl(it.network, block.iconStyle)}" alt="${SOCIAL_LABEL[it.network]}" width="${block.iconSize}" height="${block.iconSize}" style="display:block;border:0;width:${px(block.iconSize)};height:${px(block.iconSize)};" /></a></td>`,
      ).join("");
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${block.align}"><tr>${cells}</tr></table>`;
    }
    case "navigation": {
      const t = css(textCss(styles, block, block.style, "center"));
      const link = css(linkCss(styles));
      const sep = block.separator ? `<span style="padding:0 ${px(block.gap / 2)};color:${textStyleOf(styles, block, block.style).color};">${esc(block.separator)}</span>` : "";
      const items = block.items.map((it, i) => `${i > 0 ? sep : ""}<a href="${esc(it.href)}" style="${link};display:inline-block;padding:0 ${px(block.gap / 2)};">${esc(it.label)}</a>`).join("");
      return `<div style="${t};text-align:${block.align};">${items}</div>`;
    }
    case "product": {
      const t = textCss(styles, block, block.style, block.align);
      const b = styles.button;
      const img = block.image ? `<img src="${esc(block.image)}" alt="${esc(block.title)}" width="${block.imageWidth}" style="display:inline-block;border:0;width:${px(block.imageWidth)};max-width:100%;height:auto;border-radius:8px;" />` : "";
      const btn = block.buttonLabel ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${block.align}" style="margin-top:12px;"><tr><td align="center" bgcolor="${b.bg}" style="background-color:${b.bg};border-radius:${px(b.radius)};"><a href="${esc(block.buttonHref)}" style="display:inline-block;padding:${pad(b.inner)};font-family:${b.font};font-size:${px(b.size)};font-weight:${b.bold ? "bold" : "normal"};color:${b.color};text-decoration:none;">${esc(block.buttonLabel)}</a></td></tr></table>` : "";
      return `<div style="text-align:${block.align};">${img}<div style="${css({ ...t, "font-weight": "bold", "margin-top": "12px" })}">${esc(block.title)}</div><div style="${css({ ...t, color: styles.link.color, "font-weight": "bold" })}">${esc(block.price)}</div><div style="${css({ ...t, "margin-top": "6px" })}">${esc(block.description)}</div>${btn}</div>`;
    }
    case "html":
      return block.html;
  }
}

function wrapCondition(html: string, box: Box): string {
  return box.condition ? `<!--dgs:if ${box.condition.token} ${box.condition.when}-->${html}<!--dgs:endif-->` : html;
}

export const darkClass = (box: Box) => (box.dark && (box.dark.background || box.dark.color) ? `dgs-d-${box.id}` : "");

function blockCell(block: Block, styles: GlobalStyles): string {
  const cls = visibilityClass(block.visibility);
  const outerCss = css(marginCss(block));
  const outer = outerCss ? ` style="${outerCss}"` : "";
  const inner = css(boxCss(block));
  const dc = darkClass(block);
  const body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${cls ? ` class="${cls}"` : ""}><tr><td${outer}><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td${dc ? ` class="${dc}"` : ""}${inner ? ` style="${inner}"` : ""}>${renderBlock(block, styles)}</td></tr></table></td></tr></table>`;
  return wrapCondition(body, block);
}

function columnCell(column: Column, section: Section, styles: GlobalStyles, index: number): string {
  const gap = section.columnGap;
  const first = index === 0, last = index === section.columns.length - 1;
  const gapPad = gap ? `padding-left:${first ? 0 : px(gap / 2)};padding-right:${last ? 0 : px(gap / 2)};` : "";
  const inner = css(boxCss(column));
  const cls = ["dgs-col", last ? "" : "dgs-col-gap", visibilityClass(column.visibility)].filter(Boolean).join(" ");
  const dc = darkClass(column);
  const outerCss = css(marginCss(column));
  const cell = `<td class="${cls}" width="${column.width}%" valign="${column.vAlign}" style="width:${column.width}%;vertical-align:${column.vAlign};${gapPad}${outerCss ? outerCss + ";" : ""}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="${column.vAlign}"${dc ? ` class="${dc}"` : ""}${inner ? ` style="${inner}"` : ""}>${column.blocks.map((b) => blockCell(b, styles)).join("\n")}</td></tr></table></td>`;
  return wrapCondition(cell, column);
}

export function renderSection(section: Section, styles: GlobalStyles): string {
  const cls = visibilityClass(section.visibility);
  const inner = css(boxCss(section, { "vertical-align": section.vAlign }));
  const cols = section.columns.map((c, i) => columnCell(c, section, styles, i)).join("");
  const stack = section.stackOnMobile ? "" : " dgs-nostack";
  const gapCls = section.stackOnMobile && section.stackGap ? ` dgs-sg-${Math.round(section.stackGap)}` : "";
  const dc = [darkClass(section), section.background ? "dgs-sec" : ""].filter(Boolean).join(" ");
  const outerCss = css(marginCss(section));
  const row = `<tr${cls ? ` class="${cls}"` : ""}><td${outerCss ? ` style="${outerCss}"` : ""}><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td${section.background ? ` bgcolor="${section.background}"` : ""}${dc ? ` class="${dc}"` : ""}${inner ? ` style="${inner}"` : ""}><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="dgs-cols${stack}${gapCls}"><tr>${cols}</tr></table></td></tr></table></td></tr>`;
  return wrapCondition(row, section);
}

// ── Document ─────────────────────────────────────────────────────────────────

export function fontFamiliesIn(design: Design): string[] {
  const fams = new Set<string>();
  const s = design.styles;
  [s.text.paragraph, s.text.title1, s.text.title2, s.text.title3].forEach((r) => fams.add(r.font));
  fams.add(s.button.font);
  for (const sec of design.sections) for (const col of sec.columns) for (const b of col.blocks) {
    const own = (b as { style?: TextStyle }).style;
    if (own?.font) fams.add(own.font);
  }
  return [...fams];
}

export function googleFontLink(design: Design): string {
  const names = googleFontsIn(fontFamiliesIn(design));
  if (!names.length) return "";
  const fam = names.map((n) => `family=${encodeURIComponent(n).replace(/%20/g, "+")}:wght@400;600;700`).join("&");
  return `<link href="https://fonts.googleapis.com/css2?${fam}&display=swap" rel="stylesheet" />`;
}

/** Mobile rules for sections with a stacked gap: one per distinct gap size. */
export function stackGapCss(design: Design): string {
  const gaps = [...new Set(design.sections.filter((s) => s.stackOnMobile && s.stackGap).map((s) => Math.round(s.stackGap!)))];
  return gaps.map((g) => `\n    .dgs-sg-${g} .dgs-col-gap{padding-bottom:${g}px !important;}`).join("");
}

/** The dark-mode rules, every declaration !important so it beats the inline styles. */
export function darkRules(design: Design): { selectors: string[]; decl: string }[] {
  const d = darkOf(design.styles);
  if (!d.enabled) return [];
  const rules: { selectors: string[]; decl: string }[] = [
    { selectors: [".dgs-page", ".dgs-page-c"], decl: `background-color:${d.pageBg} !important;` },
    { selectors: [".dgs-body"], decl: `background-color:${d.bodyBg} !important;` },
    { selectors: [".dgs-t", ".dgs-t *"], decl: `color:${d.text} !important;` },
    { selectors: [".dgs-a", ".dgs-t a"], decl: `color:${d.link} !important;` },
  ];
  if (d.sectionBg) rules.push({ selectors: [".dgs-sec"], decl: `background-color:${d.sectionBg} !important;` });
  for (const sec of design.sections) {
    const boxes: Box[] = [sec, ...sec.columns, ...sec.columns.flatMap((c) => c.blocks)];
    for (const b of boxes) {
      if (!b.dark) continue;
      const decl = [b.dark.background ? `background-color:${b.dark.background} !important;` : "", b.dark.color ? `color:${b.dark.color} !important;` : ""].join("");
      if (!decl) continue;
      rules.push({ selectors: [`.dgs-d-${b.id}`], decl });
      if (b.dark.color) rules.push({ selectors: [`.dgs-d-${b.id} .dgs-t`, `.dgs-d-${b.id} .dgs-t *`], decl: `color:${b.dark.color} !important;` });
    }
  }
  return rules;
}

/** The dark rules as CSS text, every selector prefixed (e.g. "[data-ogsc] " or a preview scope). */
export function darkCssText(design: Design, prefix: string, sep = "\n"): string {
  return darkRules(design).map((r) => `${r.selectors.map((s) => prefix + s).join(",")}{${r.decl}}`).join(sep);
}

/** Dark-mode CSS: media query + Outlook.com's [data-ogsc] hook. */
export function darkCss(design: Design): string {
  if (!darkRules(design).length) return "";
  return `
  @media (prefers-color-scheme: dark){
    ${darkCssText(design, "", "\n    ")}
  }
  ${darkCssText(design, "[data-ogsc] ", "\n  ")}`;
}

/** The full email document. `viewInBrowserUrl` is left as a token the sender can fill. */
export function renderDesign(design: Design): string {
  const s = design.styles;
  const w = s.bodyWidth;
  const sections = design.sections.map((sec) => renderSection(sec, s)).join("\n");
  const preheader = s.preheader ? `<div style="display:none;font-size:1px;color:${s.pageBg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(s.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : "";
  const viewInBrowser = s.viewInBrowser ? `<div style="text-align:center;padding:12px 0 0;font-family:${s.text.paragraph.font};font-size:12px;"><a href="{{viewInBrowserUrl}}" style="color:${s.text.paragraph.color};text-decoration:underline;">View in browser</a></div>` : "";
  const bodyStyle = css({ width: px(w), "max-width": px(w), "background-color": s.bodyBg, "border-radius": s.bodyRadius ? px(s.bodyRadius) : null });
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
${darkOf(s).enabled ? '<meta name="color-scheme" content="light dark" /><meta name="supported-color-schemes" content="light dark" />' : ""}
<title></title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
${googleFontLink(design)}
<style>
  body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
  table{border-collapse:collapse;}
  img{border:0;line-height:100%;outline:none;text-decoration:none;}
  .dgs-mobile{display:none !important;max-height:0;overflow:hidden;mso-hide:all;}
  @media only screen and (max-width:${w + 20}px){
    .dgs-wrap{width:100% !important;max-width:100% !important;}
    .dgs-cols:not(.dgs-nostack) .dgs-col{display:block !important;width:100% !important;padding-left:0 !important;padding-right:0 !important;}${stackGapCss(design)}
    .dgs-desktop{display:none !important;max-height:0;overflow:hidden;}
    .dgs-mobile{display:block !important;max-height:none !important;}
    tr.dgs-mobile{display:table-row !important;}
    td.dgs-mobile{display:table-cell !important;}
  }${darkCss(design)}
</style>
</head>
<body style="margin:0;padding:0;background-color:${s.pageBg};">
${preheader}
<table role="presentation" class="dgs-page" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${s.pageBg}" style="background-color:${s.pageBg};">
<tr><td align="center" class="dgs-page-c" style="padding:${pad(s.bodyPadding)};">
${viewInBrowser}
<!--[if mso]><table role="presentation" width="${w}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="dgs-wrap dgs-body" width="${w}" cellpadding="0" cellspacing="0" border="0" bgcolor="${s.bodyBg}" style="${bodyStyle}">
${sections}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}
