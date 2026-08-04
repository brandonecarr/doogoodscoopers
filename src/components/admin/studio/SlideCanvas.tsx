"use client";

import { forwardRef, type ReactNode } from "react";
import { DIMS, THEMES, type Slide, type Format } from "@/lib/studio/templates";

function paw(fill: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='${fill}'><ellipse cx='50' cy='63' rx='23' ry='19'/><ellipse cx='24' cy='41' rx='9.5' ry='13'/><ellipse cx='41' cy='27' rx='9.5' ry='13'/><ellipse cx='59' cy='27' rx='9.5' ry='13'/><ellipse cx='76' cy='41' rx='9.5' ry='13'/></g></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
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
`;

export const SlideCanvas = forwardRef<HTMLDivElement, { slide: Slide; format: Format; index: number; total: number }>(
  function SlideCanvas({ slide, format, index, total }, ref) {
    const t = THEMES[slide.theme];
    const { w, h } = DIMS[format];
    const f = slide.fields;
    const str = (k: string) => (typeof f[k] === "string" ? (f[k] as string) : "");
    const arr = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : []).filter((x) => x.trim() !== "");
    const R = (text: string) => rich(text, t.hl, t.red);
    const pawFill = t.dark ? "#ffffff" : "#9CD5CF";
    const pawOp = t.dark ? 0.06 : 0.4;
    const logoSrc = t.logo === "light" ? "/logo-light.png" : "/logo-dark.png";

    const rootStyle: React.CSSProperties = {
      width: w, height: h, background: t.bg, color: t.fg,
      // theme vars for the CSS
      ["--hl" as string]: t.hl, ["--red" as string]: t.red, ["--sub" as string]: t.sub, ["--eyebrow" as string]: t.eyebrow,
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
          <div style={{ marginTop: 40 }}>
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
      <div ref={ref} className={`dgs-slide${t.dark ? " dark" : ""}`} style={rootStyle}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        {/* paw watermarks */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="dgs-paw" src={paw(pawFill)} alt="" style={{ width: 520, top: -120, right: -120, opacity: pawOp, transform: "rotate(18deg)" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="dgs-paw" src={paw(pawFill)} alt="" style={{ width: 300, bottom: 90, left: -80, opacity: pawOp * 0.9, transform: "rotate(-12deg)" }} />
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
