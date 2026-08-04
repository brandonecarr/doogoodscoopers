"use client";

import { forwardRef, type ReactNode } from "react";
import { DIMS, THEMES, type Slide, type Format } from "@/lib/studio/templates";

function paw(fill: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='${fill}'><ellipse cx='50' cy='63' rx='23' ry='19'/><ellipse cx='24' cy='41' rx='9.5' ry='13'/><ellipse cx='41' cy='27' rx='9.5' ry='13'/><ellipse cx='59' cy='27' rx='9.5' ry='13'/><ellipse cx='76' cy='41' rx='9.5' ry='13'/></g></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function Decor({ kind, color, dark }: { kind: string; color: string; dark: boolean }) {
  if (kind === "none") return null;
  if (kind === "blob")
    return <div className="dgs-decor" style={{ width: 700, height: 700, borderRadius: "50%", background: color, opacity: dark ? 0.1 : 0.16, top: -210, right: -230, filter: "blur(2px)" }} />;
  if (kind === "stripe")
    return <div className="dgs-decor" style={{ width: 1700, height: 176, background: color, opacity: dark ? 0.12 : 0.16, transform: "rotate(-22deg)", bottom: 150, left: -160 }} />;
  if (kind === "dots")
    return <div className="dgs-decor" style={{ inset: 0, backgroundImage: `radial-gradient(${color} 3px, transparent 3px)`, backgroundSize: "50px 50px", opacity: dark ? 0.08 : 0.14 }} />;
  // paws (default)
  const op = dark ? 0.06 : 0.28;
  return (<>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="dgs-decor" src={paw(color)} alt="" style={{ width: 520, top: -120, right: -120, opacity: op, transform: "rotate(18deg)" }} />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="dgs-decor" src={paw(color)} alt="" style={{ width: 300, bottom: 90, left: -80, opacity: op * 0.9, transform: "rotate(-12deg)" }} />
  </>);
}

// **x** → highlight, ~~x~~ → red, \n → line break
function rich(text: string, hl: string, red: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|~~[^~]+~~|\n)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok === "\n") out.push(<br key={k++} />);
    else if (tok.startsWith("**")) out.push(<span key={k++} style={{ color: hl }}>{tok.slice(2, -2)}</span>);
    else out.push(<span key={k++} style={{ color: red }}>{tok.slice(2, -2)}</span>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const CSS = `
.dgs-slide{position:relative;overflow:hidden;padding:80px 84px;display:flex;flex-direction:column;font-family:var(--font-montserrat),'Montserrat',system-ui,sans-serif;}
.dgs-eyebrow{font-weight:800;letter-spacing:.16em;text-transform:uppercase;font-size:26px;color:var(--eyebrow);}
.dgs-logo{position:absolute;top:64px;right:84px;height:44px;}
.dgs-pageno{position:absolute;bottom:60px;right:84px;font-weight:800;font-size:22px;letter-spacing:.05em;opacity:.8;}
.dgs-swipe{position:absolute;bottom:58px;left:84px;font-weight:800;font-size:26px;letter-spacing:.04em;color:var(--hl);}
.dgs-spacer{flex:1;}
.dgs-paw{position:absolute;pointer-events:none;}
.dgs-h1{font-weight:900;font-size:104px;line-height:.98;letter-spacing:-1.5px;margin-top:26px;}
.dgs-sub{font-size:40px;font-weight:600;line-height:1.42;margin-top:32px;color:var(--sub);max-width:880px;}
.dgs-statbig{font-weight:900;font-size:220px;line-height:.9;letter-spacing:-4px;}
.dgs-statlabel{font-size:48px;font-weight:700;line-height:1.25;margin-top:22px;max-width:900px;}
.dgs-thead{font-weight:900;font-size:74px;line-height:1.03;letter-spacing:-1px;margin-top:16px;}
.dgs-list{margin-top:42px;}
.dgs-li{display:flex;align-items:center;gap:26px;font-size:46px;font-weight:800;padding:20px 0;border-bottom:3px solid rgba(14,42,71,.08);}
.dgs-slide.dark .dgs-li{border-bottom-color:rgba(255,255,255,.14);}
.dgs-n{width:58px;height:58px;border-radius:14px;background:var(--hl);color:#fff;font-size:30px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.dgs-li.red{color:var(--red);border-bottom:none;}.dgs-li.red .dgs-n{background:var(--red);}
.dgs-check{display:flex;gap:22px;align-items:flex-start;font-size:44px;font-weight:700;padding:18px 0;line-height:1.2;}
.dgs-check .ck{color:#16A34A;font-weight:900;font-size:48px;line-height:1;flex-shrink:0;}
.dgs-statement{font-weight:900;font-size:92px;line-height:1.05;letter-spacing:-1px;}
.dgs-kicker{font-weight:900;font-size:58px;line-height:1.08;}
.dgs-ctabox{background:#fff;color:#0E2A47;border-radius:40px;padding:60px 54px;text-align:center;margin-top:18px;}
.dgs-ctalead{font-size:42px;font-weight:700;color:#3a3f43;line-height:1.3;}
.dgs-ctabig{font-weight:900;font-size:92px;line-height:1;margin:24px 0;letter-spacing:-1px;color:#0E2A47;}
.dgs-ctap{font-size:38px;font-weight:600;color:#3a3f43;line-height:1.42;}
.dgs-ctafoot{position:absolute;bottom:54px;left:0;right:0;text-align:center;color:var(--sub);font-weight:800;font-size:30px;}
.dgs-display .dgs-h1,.dgs-display .dgs-statement,.dgs-display .dgs-thead,.dgs-display .dgs-kicker,.dgs-display .dgs-ctabig,.dgs-display .dgs-statbig{font-family:var(--font-bebas),'Bebas Neue',Impact,sans-serif;letter-spacing:.5px;line-height:.92;font-weight:400;overflow-wrap:break-word;}
.dgs-display .dgs-h1{font-size:106px;}
.dgs-display .dgs-statement{font-size:102px;}
.dgs-display .dgs-thead{font-size:88px;}
.dgs-display .dgs-kicker{font-size:68px;}
.dgs-display .dgs-statbig{font-size:260px;letter-spacing:0;}
.dgs-display .dgs-ctabig{font-size:112px;}
.dgs-decor{position:absolute;pointer-events:none;}
.dgs-photobg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;}
.dgs-scrim{position:absolute;inset:0;z-index:1;}
.dgs-photo .dgs-eyebrow,.dgs-photo .dgs-h1,.dgs-photo .dgs-sub,.dgs-photo .dgs-statbig,.dgs-photo .dgs-statlabel,.dgs-photo .dgs-thead,.dgs-photo .dgs-list,.dgs-photo .dgs-checkwrap,.dgs-photo .dgs-statement,.dgs-photo .dgs-kicker,.dgs-photo .dgs-ctabox{position:relative;z-index:2;}
.dgs-photo .dgs-logo,.dgs-photo .dgs-swipe,.dgs-photo .dgs-pageno{z-index:3;}
`;

export const SlideCanvas = forwardRef<HTMLDivElement, { slide: Slide; format: Format; index: number; total: number }>(
  function SlideCanvas({ slide, format, index, total }, ref) {
    const t = THEMES[slide.theme];
    const { w, h } = DIMS[format];
    const f = slide.fields;
    const str = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : "");
    const arr = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : []).filter((x) => x.trim() !== "");
    const R = (text: string) => rich(text, t.hl, t.red);
    const photo = !!slide.bgImage;
    const fg = photo ? "#ffffff" : t.fg;
    const subC = photo ? "rgba(255,255,255,.92)" : t.sub;
    const eyebrowC = photo ? t.hl : t.eyebrow;
    const isDark = photo ? true : t.dark;
    const logoSrc = (photo ? "light" : t.logo) === "light" ? "/logo-light.png" : "/logo-dark.png";
    const o = Math.min(0.85, Math.max(0.15, slide.overlay ?? 0.5));
    const scrim = `linear-gradient(180deg, rgba(0,0,0,${o}) 0%, rgba(0,0,0,${(o * 0.55).toFixed(3)}) 42%, rgba(0,0,0,${Math.min(0.9, o * 1.1).toFixed(3)}) 100%)`;

    const rootStyle: React.CSSProperties = {
      width: w, height: h, background: photo ? "#000" : t.bg, color: fg,
      ["--hl" as string]: t.hl, ["--red" as string]: t.red, ["--sub" as string]: subC, ["--eyebrow" as string]: eyebrowC,
    };

    let body: ReactNode = null;
    switch (slide.layout) {
      case "cover":
        body = (<>
          {str("eyebrow") && <div className="dgs-eyebrow">{str("eyebrow")}</div>}
          <div className="dgs-h1">{R(str("title"))}</div>
          {str("subtitle") && <div className="dgs-sub">{R(str("subtitle"))}</div>}
        </>); break;
      case "stat":
        body = (<>
          {str("eyebrow") && <div className="dgs-eyebrow">{str("eyebrow")}</div>}
          <div className="dgs-spacer" />
          <div className="dgs-statbig">{str("stat")}</div>
          <div className="dgs-statlabel">{R(str("statLabel"))}</div>
          <div className="dgs-spacer" />
        </>); break;
      case "list":
        body = (<>
          {str("eyebrow") && <div className="dgs-eyebrow">{str("eyebrow")}</div>}
          <div className="dgs-thead">{R(str("title"))}</div>
          <div className="dgs-list">
            {arr("items").map((it, i, all) => {
              const red = f["lastRed"] === true && i === all.length - 1;
              return <div key={i} className={`dgs-li${red ? " red" : ""}`}><span className="dgs-n">{i + 1}</span>{it}</div>;
            })}
          </div>
        </>); break;
      case "checklist":
        body = (<>
          {str("eyebrow") && <div className="dgs-eyebrow">{str("eyebrow")}</div>}
          <div className="dgs-thead">{R(str("title"))}</div>
          <div className="dgs-checkwrap" style={{ marginTop: 40 }}>
            {arr("items").map((it, i) => <div key={i} className="dgs-check"><span className="ck">✓</span><span>{it}</span></div>)}
          </div>
        </>); break;
      case "statement":
        body = (<>
          <div className="dgs-spacer" />
          <div className="dgs-statement">{R(str("statement"))}</div>
          {str("subtitle") && <div className="dgs-sub">{R(str("subtitle"))}</div>}
          <div className="dgs-spacer" />
        </>); break;
      case "cta":
        body = (<>
          <div className="dgs-spacer" />
          {str("kicker") && <div className="dgs-kicker">{R(str("kicker"))}</div>}
          <div className="dgs-ctabox">
            {str("lead") && <div className="dgs-ctalead">{str("lead")}</div>}
            <div className="dgs-ctabig">Comment<br /><span style={{ color: t.hl }}>“{str("big")}”</span></div>
            {str("p") && <div className="dgs-ctap">{R(str("p"))}</div>}
          </div>
          <div className="dgs-spacer" />
          {str("footer") && <div className="dgs-ctafoot">{str("footer")}</div>}
        </>); break;
    }

    return (
      <div ref={ref} className={`dgs-slide${isDark ? " dark" : ""}${slide.font === "display" ? " dgs-display" : ""}${photo ? " dgs-photo" : ""}`} style={rootStyle}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="dgs-photobg" src={slide.bgImage} alt="" />
            <div className="dgs-scrim" style={{ background: scrim }} />
          </>
        ) : (
          <Decor kind={slide.decor} color={t.decorColor} dark={t.dark} />
        )}
        {slide.showLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="dgs-logo" src={logoSrc} alt="" />
        )}
        {body}
        {slide.showSwipe && index < total - 1 && <div className="dgs-swipe">SWIPE →</div>}
        <div className="dgs-pageno" style={{ color: t.dark ? "#C7D6E6" : "#9aa1a8" }}>{index + 1}/{total}</div>
      </div>
    );
  },
);
