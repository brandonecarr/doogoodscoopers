#!/usr/bin/env node
/**
 * DooGoodScoopers — Elementor Template Generator  v5
 *
 * Matches the reference design from the live Next.js site:
 *   • Hero:  Bebas Neue display font, lawn background image
 *   • Stats: CSS background-image cards (no img tag — won't collapse)
 *   • Before/After: drag-to-compare JS slider
 *   • Process Steps: numbered circles + connecting line via CSS
 *   • Customer Promise: gradient-border cards
 *   • Footer: logo + Quick Links + Contact + Service Areas
 *
 * Set BASE_URL to match your WordPress domain before importing.
 */

const fs   = require("fs");
const path = require("path");

const BASE_URL = "https://doogoodscoopers.com"; // ← edit if different
const img = (p) => `${BASE_URL}${p}`;

const C = {
  teal50:  "#f0fafa", teal100: "#d9f2f0", teal200: "#b3e5e1",
  teal300: "#9CD5CF", teal400: "#7ac4bc", teal500: "#5ab3a9",
  teal600: "#47958c", teal700: "#3b7872",
  navy50:  "#e6f0f5", navy100: "#cce1eb",
  navy600: "#008EFF", navy700: "#004d73",
  navy900: "#002842", navy950: "#001a2e",
  white: "#ffffff", gray50: "#f9fafb", gray100: "#f3f4f6", gray600: "#4b5563",
};

let _c = 0;
const uid = () => (++_c).toString(16).padStart(8, "0");

const pad    = (t, r, b, l) => ({ unit:"px", top:t, right:r, bottom:b, left:l, isLinked:false });
const padSym = (v, h)       => pad(v, h, v, h);
const widget  = (wt, s)       => ({ id:uid(), elType:"widget", widgetType:wt, settings:s });
const section = (cols, s={})  => ({ id:uid(), elType:"section", isInner:false, settings:{stretch_section:"section-stretched",...s}, elements:cols });
const column  = (pct, els, s={}) => ({ id:uid(), elType:"column", settings:{ _column_size:pct, _inline_size:null, ...s }, elements:els });

const col100 = (e,s) => column(100,e,s);
const col50  = (e,s) => column(50, e,s);
const col66  = (e,s) => column(66, e,s);
const col34  = (e,s) => column(34, e,s);
const col33a = (e,s) => column(34, e,s);  // 34+33+33=100
const col33b = (e,s) => column(33, e,s);
const col25  = (e,s) => column(25, e,s);

// Backgrounds
const bgSolid  = (c) => ({ background_background:"classic", background_color:c });
const bgDark   = bgSolid(C.navy900);
const bgWhite  = bgSolid(C.white);
const bgGray   = bgSolid(C.gray50);
const bgGrad   = (c1,c2,a=180) => ({ background_background:"gradient", background_color:c1, background_color_b:c2, background_gradient_type:"linear", background_gradient_angle:{unit:"deg",size:a} });
const bgGradTW = bgGrad(C.teal50, C.white);
const bgGradNW = bgGrad(C.navy50, C.white);
const bgGradWT = bgGrad(C.white,  C.teal50);
const bgBrand  = bgGrad(C.teal300,C.navy600,135);
const bgImgOv  = (url, ov="rgba(0,40,66,0.82)") => ({ background_background:"classic", background_image:{url,id:""}, background_position:"center center", background_repeat:"no-repeat", background_size:"cover", background_overlay_background:"classic", background_overlay_color:ov });

// Widgets
const spacer   = (h=20)   => widget("spacer",   { space:{unit:"px",size:h} });
const htmlEl   = (html)   => widget("html",     { html });
const imgEl    = (url,alt="",align="center") => widget("image", { image:{url,id:"",alt}, image_size:"full", align, caption_source:"none" });
const textEl   = (html,align="center") => widget("text-editor", { editor:html, align });
const headEl   = (title,tag="h2",color=C.navy900,align="center",extra={}) => widget("heading", { title, header_size:tag, align, title_color:color, ...extra });
const bebasH   = (title,tag="h1",color=C.white,align="center",size=72) => widget("heading", {
  title, header_size:tag, align, title_color:color,
  typography_typography:"custom", typography_font_family:"Bebas Neue",
  typography_font_size:{unit:"px",size}, typography_font_weight:"400",
  typography_letter_spacing:{unit:"px",size:2}, typography_line_height:{unit:"em",size:1.0},
});
const btnEl    = (label,url,bg=C.teal500,fg=C.white,align="center") => widget("button", {
  text:label, link:{url,is_external:false,nofollow:false}, align, size:"lg",
  background_color:bg, text_color:fg,
  border_radius:{unit:"px",top:"50",right:"50",bottom:"50",left:"50",isLinked:false},
});
const iconBoxEl = (icon,title,desc,iconColor=C.teal500) => widget("icon-box", {
  icon:{value:icon,library:"fa-solid"}, title_text:title, description_text:desc,
  position:"top", title_size:"h3", icon_color:iconColor, icon_size:{unit:"px",size:46},
});
const iconListEl = (items,color=C.teal500) => widget("icon-list", {
  icon_list: items.map(text=>({ _id:uid(), text, icon:{value:"fa fa-check",library:"fa-solid"} })),
  icon_color:color, text_color:C.navy900, text_indent:{unit:"px",size:8}, icon_size:{unit:"px",size:14},
});
const accordionEl = (faqs) => widget("accordion", {
  tabs: faqs.map(([q,a])=>({ _id:uid(), tab_title:q, tab_content:a })),
  title_html_tag:"h3", active_item:1,
});

// Badge pills
const tealBadge = (label) => htmlEl(`<div style="text-align:center;"><span style="display:inline-block;background:${C.teal500};color:#fff;padding:6px 20px;border-radius:9999px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;font-family:Montserrat,sans-serif;">${label}</span></div>`);
const navyBadge = (label) => htmlEl(`<div style="text-align:center;"><span style="display:inline-block;background:${C.navy900};color:${C.teal300};padding:6px 20px;border-radius:9999px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;font-family:Montserrat,sans-serif;">${label}</span></div>`);

// ── Before/After comparison slider ────────────────────────────────────────────
const baSlider = (beforeUrl, afterUrl) => htmlEl(`<div class="dgs-ba" style="position:relative;overflow:hidden;border-radius:12px;cursor:ew-resize;user-select:none;touch-action:pan-y;">
  <img src="${afterUrl}" alt="After" style="display:block;width:100%;height:260px;object-fit:cover;">
  <div class="dgs-ba-before" style="position:absolute;top:0;left:0;width:50%;height:100%;overflow:hidden;">
    <img src="${beforeUrl}" alt="Before" style="display:block;height:260px;width:auto;max-width:none;object-fit:cover;position:absolute;top:0;left:0;height:100%;width:200%;">
    <span style="position:absolute;top:10px;left:10px;background:rgba(0,40,66,0.75);color:#fff;padding:4px 12px;border-radius:4px;font-family:Montserrat,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;z-index:2;">Before</span>
  </div>
  <span style="position:absolute;top:10px;right:10px;background:${C.teal500};color:#fff;padding:4px 12px;border-radius:4px;font-family:Montserrat,sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;">After</span>
  <div class="dgs-ba-handle" style="position:absolute;top:0;left:50%;width:3px;height:100%;background:#fff;transform:translateX(-50%);pointer-events:none;">
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:38px;height:38px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,0.3);font-size:17px;pointer-events:none;">⟺</div>
  </div>
</div>
<script>(function(){var s=document.currentScript;var c=s.previousElementSibling;if(!c||!c.classList.contains('dgs-ba'))c=s.parentElement.querySelector('.dgs-ba');if(!c)return;var h=c.querySelector('.dgs-ba-handle'),b=c.querySelector('.dgs-ba-before'),bi=b.querySelector('img'),drag=false;function mv(x){var r=c.getBoundingClientRect(),p=Math.max(2,Math.min(98,(x-r.left)/r.width*100));b.style.width=p+'%';bi.style.width=(10000/p)+'%';h.style.left=p+'%';}h.style.pointerEvents='all';h.style.cursor='ew-resize';h.addEventListener('mousedown',function(e){drag=true;e.preventDefault();});document.addEventListener('mouseup',function(){drag=false;});document.addEventListener('mousemove',function(e){if(drag)mv(e.clientX);});h.addEventListener('touchstart',function(e){drag=true;});document.addEventListener('touchend',function(){drag=false;});document.addEventListener('touchmove',function(e){if(drag)mv(e.touches[0].clientX);},{passive:true});})()</script>`);

// ── CTA footer section ────────────────────────────────────────────────────────
const ctaSection = (title="Ready to Take Back Your Yard?", sub="Get 25% off your first month of service. No contracts, no hassle — just a cleaner yard and happier family.") => [
  section([col100([
    navyBadge("Limited Time Offer"),
    spacer(14),
    headEl(title,"h2",C.white),
    spacer(10),
    textEl(`<p style="color:rgba(255,255,255,0.85);">${sub}</p>`),
    spacer(8),
    textEl(`<p style="font-size:13px;color:rgba(255,255,255,0.6);">✓ 100% Satisfaction Guaranteed &nbsp;•&nbsp; ✓ No Contracts &nbsp;•&nbsp; ✓ Cancel Anytime</p>`),
    spacer(16),
  ])], { ...bgBrand, padding:pad("60","20","10","20") }),
  section([
    col50([btnEl("Get Your Free Quote","/quote",C.white,C.navy900)]),
    col50([btnEl("Call (909) 366-3744","tel:9093663744","transparent",C.white)]),
  ], { ...bgBrand, padding:pad("10","20","60","20") }),
];

// ── Footer section ────────────────────────────────────────────────────────────
const footerSection = () => section([
  column(30,[
    imgEl(img("/logo-dark.webp"),"DooGoodScoopers","left"),
    spacer(12),
    textEl(`<p style="color:rgba(255,255,255,0.7);font-size:14px;text-align:left;">Professional dog waste removal service serving the Inland Empire. Take back control of your lawn with our reliable service.</p>`,"left"),
    spacer(12),
    htmlEl(`<div style="display:flex;gap:12px;">
      <a href="#" style="display:inline-flex;width:36px;height:36px;background:rgba(255,255,255,0.1);border-radius:50%;align-items:center;justify-content:center;color:#fff;text-decoration:none;font-size:16px;">f</a>
      <a href="#" style="display:inline-flex;width:36px;height:36px;background:rgba(255,255,255,0.1);border-radius:50%;align-items:center;justify-content:center;color:#fff;text-decoration:none;font-size:16px;">in</a>
    </div>`),
  ]),
  column(20,[
    headEl("Quick Links","h4",C.teal300,"left"),
    spacer(10),
    htmlEl(`<ul style="list-style:none;padding:0;margin:0;font-family:Montserrat,sans-serif;">
      ${["Residential|/residential-services","Commercial|/commercial-services","About|/about-doogoodscoopers","Get a Quote|/quote","FAQ|/faq","Careers|/careers"].map(i=>{const[l,u]=i.split("|");return`<li style="margin-bottom:8px;"><a href="${u}" style="color:rgba(255,255,255,0.75);text-decoration:none;font-size:14px;">${l}</a></li>`;}).join("")}
    </ul>`),
  ]),
  column(25,[
    headEl("Contact Us","h4",C.teal300,"left"),
    spacer(10),
    htmlEl(`<div style="font-family:Montserrat,sans-serif;font-size:14px;color:rgba(255,255,255,0.75);line-height:2;">
      <div>📞 <a href="tel:9093663744" style="color:rgba(255,255,255,0.75);text-decoration:none;">(909) 366-3744</a></div>
      <div>✉️ <a href="mailto:service@doogoodscoopers.com" style="color:rgba(255,255,255,0.75);text-decoration:none;">service@doogoodscoopers.com</a></div>
      <div>📍 11799 Sebastian Way, Suite 103<br>&nbsp;&nbsp;&nbsp;&nbsp;Rancho Cucamonga, CA 91730</div>
      <div>🕐 Mon–Fri: 7:30 AM – 6:00 PM<br>&nbsp;&nbsp;&nbsp;&nbsp;Sat–Sun: 9:00 AM – 5:00 PM</div>
    </div>`),
  ]),
  column(25,[
    headEl("Service Areas","h4",C.teal300,"left"),
    spacer(10),
    htmlEl(`<div style="font-family:Montserrat,sans-serif;font-size:14px;color:rgba(255,255,255,0.75);line-height:1.9;">
      ${["Fontana","Rancho Cucamonga","Ontario","Upland","Claremont","Montclair","Pomona","Chino","Chino Hills","Diamond Bar"].map(c=>`<div>${c}</div>`).join("")}
      <div style="color:${C.teal400};font-weight:600;margin-top:4px;">+10 more</div>
      <div style="margin-top:8px;font-size:13px;color:rgba(255,255,255,0.5);">Serving 90+ zip codes throughout the Inland Empire</div>
    </div>`),
  ]),
], { ...bgGrad(C.navy900,C.navy950), padding:padSym("60","20") });

const footerBar = () => section([col100([
  htmlEl(`<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;font-family:Montserrat,sans-serif;font-size:13px;color:rgba(255,255,255,0.5);">
    <span>© 2026 DooGoodScoopers. All rights reserved.</span>
    <span><a href="/privacy-policy" style="color:rgba(255,255,255,0.5);text-decoration:none;margin-right:16px;">Privacy Policy</a><a href="/terms-of-service" style="color:rgba(255,255,255,0.5);text-decoration:none;">Terms of Service</a></span>
  </div>`),
])], { ...bgSolid(C.navy950), padding:padSym("16","20") });

// ═══════════════════════════════════════════════════════════════════════════════
// HOME PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const homePage = () => {
  const out = [];

  // ── Hero ─────────────────────────────────────────────────────────────────
  out.push(section([col100([
    htmlEl(`<div style="text-align:center;"><span style="display:inline-block;background:rgba(0,40,66,0.55);border:1px solid ${C.teal400};color:${C.teal300};padding:8px 22px;border-radius:9999px;font-size:12px;font-weight:700;letter-spacing:1.5px;font-family:Montserrat,sans-serif;text-transform:uppercase;">🎉 NEW YEAR'S SPECIAL — 25% OFF YOUR FIRST MONTH!</span></div>`),
    spacer(18),
    textEl(`<p style="font-size:14px;color:rgba(255,255,255,0.65);letter-spacing:2px;text-transform:uppercase;font-family:Montserrat,sans-serif;">Take Back Control of Your Lawn</p>`),
    spacer(8),
    bebasH("RELIABLE DOG POOP REMOVAL FOR A CLEANER, HEALTHIER YARD","h1",C.white,"center",76),
    spacer(14),
    textEl(`<p style="font-size:19px;color:rgba(255,255,255,0.9);">Hassle-Free Pooper Scooper Service You Can Count On!</p>`),
    spacer(28),
    btnEl("Get My Free Quote →","/quote",C.teal500,C.white),
    spacer(12),
    btnEl("Learn More","/residential-services","transparent",C.white),
    spacer(36),
    htmlEl(`<div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;font-family:Montserrat,sans-serif;">
      ${[["⭐ 5.0","Rating"],["521+","Happy Families"],["90+","ZIP Codes Served"]].map(([n,l])=>`
        <div style="text-align:center;border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:10px 20px;background:rgba(0,40,66,0.45);">
          <div style="font-size:20px;font-weight:800;color:${C.teal300};font-family:Montserrat,sans-serif;">${n}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;font-family:Montserrat,sans-serif;">${l}</div>
        </div>`).join("")}
    </div>`),
    spacer(30),
  ])], { ...bgImgOv(img("/images/lawn-background.webp")), padding:padSym("100","20") }));

  // ── Stats — heading ───────────────────────────────────────────────────────
  out.push(section([col100([
    spacer(8),
    headEl("Trusted by Families Across the Inland Empire","h2",C.navy900),
    spacer(6),
    textEl(`<p style="color:${C.gray600};">Join hundreds of satisfied customers who have taken back control of their yards</p>`),
    spacer(10),
  ])], { ...bgGradTW, padding:pad("60","20","0","20") }));

  // ── Stats — 4 dark cards with CSS background images ───────────────────────
  // Using CSS background-image (not <img> tags) so cards never collapse
  const statCards = [
    [5,    ".0 ★",  "Paw Rating",     "Perfect 5-paw rating on Google",       "/images/stats/star-rating-bg.webp"],
    [521,  "+",     "Happy Families", "Highly trusted staff",                 "/images/stats/happy-families.webp"],
    [1840, "+",     "Happy Dogs",     "Pups enjoying cleaner yards",          "/images/stats/happy-dogs.webp"],
    [22123,"+",     "Yards Completed","We specialize in beautiful yards",     "/images/stats/yards-completed.webp"],
  ];
  out.push(section(
    statCards.map(([end,sfx,title,sub,imgPath])=>
      col25([
        htmlEl(`<div style="background:${C.navy900};border-radius:14px;overflow:hidden;min-height:180px;position:relative;">
          <div style="position:absolute;inset:0;background-image:url(${img(imgPath)});background-size:cover;background-position:center;opacity:0.3;"></div>
          <div style="position:relative;z-index:1;padding:28px 20px;text-align:center;">
            <div style="font-size:38px;font-weight:800;color:${C.teal300};font-family:Montserrat,sans-serif;">${end.toLocaleString()}${sfx}</div>
            <div style="font-size:15px;font-weight:700;color:#fff;margin:6px 0 4px;font-family:Montserrat,sans-serif;">${title}</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.6);font-family:Montserrat,sans-serif;">${sub}</div>
          </div>
        </div>`),
        spacer(10),
      ])
    ),
    { ...bgGradTW, padding:pad("16","20","60","20") }
  ));

  // ── Customer Promise ──────────────────────────────────────────────────────
  out.push(section([col100([
    spacer(8),
    headEl("Our Customer Promise","h2",C.navy900),
    spacer(6),
    textEl(`<p style="color:${C.gray600};">We are customer driven through and through. Our customers' satisfaction is our top priority, and we make every effort to ensure it.</p>`),
    spacer(8),
  ])], { ...bgWhite, padding:pad("60","20","0","20") }));
  out.push(section([
    col33a([
      // Card styled column
      htmlEl(`<div style="border:2px solid ${C.teal200};border-radius:16px;padding:32px 24px;text-align:center;background:#fff;position:relative;overflow:hidden;">
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,${C.teal500},${C.teal300});display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px;">✓</div>
        <h3 style="font-size:18px;font-weight:700;color:${C.navy900};margin:0 0 10px;font-family:Montserrat,sans-serif;">Reliable, Hassle-Free Service</h3>
        <p style="font-size:14px;color:${C.gray600};line-height:1.7;margin:0;font-family:Montserrat,sans-serif;">Our reliable, hassle-free pooper scooper service ensures timely, efficient visits, leaving your yard pristine. Enjoy more time with your dog — let us handle the mess!</p>
      </div>`),
      spacer(10),
    ]),
    col33b([
      htmlEl(`<div style="border:2px solid ${C.navy600};border-radius:16px;padding:32px 24px;text-align:center;background:#fff;position:relative;overflow:hidden;">
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,${C.navy600},${C.navy700});display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px;">🛡️</div>
        <h3 style="font-size:18px;font-weight:700;color:${C.navy900};margin:0 0 10px;font-family:Montserrat,sans-serif;">Health and Safety Commitment</h3>
        <p style="font-size:14px;color:${C.gray600};line-height:1.7;margin:0;font-family:Montserrat,sans-serif;">DooGoodScoopers prioritizes health and safety by using sanitary practices and eco-friendly disposal methods, ensuring a clean, safe environment for Inland Empire pets and families.</p>
      </div>`),
      spacer(10),
    ]),
    col33b([
      htmlEl(`<div style="border:2px solid ${C.teal400};border-radius:16px;padding:32px 24px;text-align:center;background:#fff;position:relative;overflow:hidden;">
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,${C.teal600},${C.teal400});display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px;">⭐</div>
        <h3 style="font-size:18px;font-weight:700;color:${C.navy900};margin:0 0 10px;font-family:Montserrat,sans-serif;">Satisfaction Guaranteed</h3>
        <p style="font-size:14px;color:${C.gray600};line-height:1.7;margin:0;font-family:Montserrat,sans-serif;">At DooGoodScoopers, we guarantee your satisfaction. If you're not happy, we'll make it right — your satisfaction is our priority.</p>
      </div>`),
      spacer(10),
    ]),
  ], { ...bgWhite, padding:pad("10","20","60","20") }));

  // ── How It Works ──────────────────────────────────────────────────────────
  out.push(section([col100([
    spacer(8),
    headEl("How It Works","h2",C.navy900),
    spacer(6),
    textEl(`<p style="color:${C.gray600};">Getting started is easy. Three simple steps to a cleaner, healthier yard.</p>`),
    spacer(10),
  ])], { ...bgGray, padding:pad("60","20","0","20") }));
  out.push(section([
    col33a([
      htmlEl(`<div style="background:#fff;border-radius:16px;padding:36px 24px;text-align:center;box-shadow:0 4px 20px rgba(0,40,66,0.08);position:relative;">
        <div style="width:56px;height:56px;background:${C.teal500};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:13px;color:#fff;font-family:Montserrat,sans-serif;">📋</div>
        <div style="width:36px;height:36px;background:${C.teal500};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-weight:800;color:#fff;font-size:16px;font-family:Montserrat,sans-serif;">1</div>
        <h3 style="font-size:18px;font-weight:700;color:${C.navy900};margin:0 0 10px;font-family:Montserrat,sans-serif;">Get Your Quote</h3>
        <p style="font-size:14px;color:${C.gray600};line-height:1.7;margin:0;font-family:Montserrat,sans-serif;">Tell us about your yard and furry friends. We'll provide a free, no-obligation quote tailored to your needs.</p>
      </div>`),
      spacer(10),
    ]),
    col33b([
      htmlEl(`<div style="background:#fff;border-radius:16px;padding:36px 24px;text-align:center;box-shadow:0 4px 20px rgba(0,40,66,0.08);">
        <div style="width:56px;height:56px;background:${C.navy700};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:13px;color:#fff;font-family:Montserrat,sans-serif;">📅</div>
        <div style="width:36px;height:36px;background:${C.navy700};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-weight:800;color:#fff;font-size:16px;font-family:Montserrat,sans-serif;">2</div>
        <h3 style="font-size:18px;font-weight:700;color:${C.navy900};margin:0 0 10px;font-family:Montserrat,sans-serif;">Schedule Service</h3>
        <p style="font-size:14px;color:${C.gray600};line-height:1.7;margin:0;font-family:Montserrat,sans-serif;">Choose a day that works for you. We offer flexible weekly, bi-weekly, or one-time cleanings.</p>
      </div>`),
      spacer(10),
    ]),
    col33b([
      htmlEl(`<div style="background:#fff;border-radius:16px;padding:36px 24px;text-align:center;box-shadow:0 4px 20px rgba(0,40,66,0.08);">
        <div style="width:56px;height:56px;background:${C.teal600};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:13px;color:#fff;font-family:Montserrat,sans-serif;">✨</div>
        <div style="width:36px;height:36px;background:${C.teal600};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-weight:800;color:#fff;font-size:16px;font-family:Montserrat,sans-serif;">3</div>
        <h3 style="font-size:18px;font-weight:700;color:${C.navy900};margin:0 0 10px;font-family:Montserrat,sans-serif;">Enjoy Your Yard</h3>
        <p style="font-size:14px;color:${C.gray600};line-height:1.7;margin:0;font-family:Montserrat,sans-serif;">Relax while we do the dirty work. Come home to a fresh, clean yard every time.</p>
      </div>`),
      spacer(10),
    ]),
  ], { ...bgGray, padding:pad("10","20","0","20") }));
  out.push(section([col100([btnEl("Start With Step 1","/quote",C.teal500,C.white), spacer(8)])], { ...bgGray, padding:pad("16","20","60","20") }));

  // ── What We Do (before/after sliders) ─────────────────────────────────────
  out.push(section([col100([
    spacer(8),
    headEl("What Exactly Do We Do?","h2",C.navy900),
    spacer(8),
    textEl(`<p style="color:${C.gray600};max-width:680px;margin:0 auto;line-height:1.8;">We know how busy life can get. Sometimes, there are certain chores that just pile up on you — pun intended. This is why our pooper scooper service is so valuable.</p>`),
    spacer(6),
    textEl(`<p style="color:${C.gray600};font-size:13px;font-style:italic;">Drag the slider to see the transformation</p>`),
    spacer(20),
  ])], { ...bgWhite, padding:pad("60","20","0","20") }));
  out.push(section([
    col50([baSlider(img("/images/before-after/before-1.webp"), img("/images/before-after/after-1.webp")), spacer(10)]),
    col50([baSlider(img("/images/before-after/before-2.webp"), img("/images/before-after/after-2.webp")), spacer(10)]),
  ], { ...bgWhite, padding:pad("0","20","60","20") }));

  // ── Testimonials ──────────────────────────────────────────────────────────
  out.push(section([col100([
    spacer(8),
    headEl("What Our Customers Say","h2",C.navy900),
    spacer(6),
    textEl(`<p style="color:${C.gray600};">Don't just take our word for it. Here's what families across the Inland Empire have to say.</p>`),
    spacer(16),
    htmlEl(`<div style="font-family:Montserrat,sans-serif;text-align:center;display:flex;align-items:center;justify-content:center;gap:24px;flex-wrap:wrap;">
      <span style="font-size:24px;">🐾🐾🐾🐾🐾</span>
      <span style="font-size:14px;font-weight:700;color:${C.navy900};">5.0 on Google</span>
      <span style="width:1px;height:20px;background:#e5e7eb;display:inline-block;"></span>
      <span style="font-size:14px;color:${C.gray600};">100% Satisfaction Guaranteed</span>
    </div>`),
    spacer(24),
    htmlEl(`<div class="trustindex-widget-container"><script async defer src="https://cdn.trustindex.io/loader.js?66c43da43da848017c26e042639"></script></div>`),
    spacer(10),
  ])], { ...bgGradWT, padding:padSym("70","20") }));

  // ── Service Areas ─────────────────────────────────────────────────────────
  const cities = ["Fontana","Rancho Cucamonga","Ontario","Upland","Claremont","Montclair","Pomona","Chino","Chino Hills","Diamond Bar","Eastvale","Norco","Corona","Riverside","Rialto","Colton","San Bernardino","Highland","Redlands","Loma Linda"];
  out.push(section([
    col50([
      spacer(10),
      tealBadge("Service Coverage"),
      spacer(12),
      headEl("Proudly Serving the Inland Empire","h2",C.white,"left"),
      spacer(8),
      textEl(`<p style="color:rgba(255,255,255,0.75);text-align:left;">We provide professional dog waste removal services throughout San Bernardino and Los Angeles counties. Our team serves over 90 zip codes, bringing reliable and thorough service to neighborhoods across the region.</p>`,"left"),
      spacer(12),
      iconListEl(["90+ ZIP Codes","Same-Day Quotes","Flexible Scheduling"],C.teal400),
      spacer(18),
      btnEl("Check Your Area","/quote",C.teal500,C.white,"left"),
      spacer(10),
    ]),
    col50([
      spacer(10),
      headEl("Cities We Serve","h3",C.teal300,"left"),
      spacer(10),
      htmlEl(`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-family:Montserrat,sans-serif;">
        ${cities.map(c=>`<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 10px;color:rgba(255,255,255,0.85);font-size:13px;">${c}</div>`).join("")}
      </div>`),
      spacer(10),
      textEl(`<p style="color:${C.teal400};font-size:13px;text-align:left;">Don't see your city? Contact us — we may still serve your area!</p>`,"left"),
      spacer(10),
    ]),
  ], { ...bgImgOv(img("/images/patterns/paw-bone-pattern.webp"),"rgba(0,40,66,0.91)"), padding:padSym("70","20") }));

  out.push(...ctaSection());
  out.push(footerSection());
  out.push(footerBar());
  return out;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ABOUT PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const aboutPage = () => {
  const out = [];

  out.push(section([col100([
    tealBadge("About DooGoodScoopers"),
    spacer(14),
    bebasH("Meet the Team Behind Your Clean Yard","h1",C.navy900,"center",60),
    spacer(10),
    textEl(`<p style="color:${C.gray600};font-size:18px;">Founded in 2024 by a husband-and-wife team who believe every family deserves a clean, safe outdoor space.</p>`),
    spacer(22),
    btnEl("Get My Free Quote","/quote",C.teal500,C.white),
    spacer(10),
  ])], { ...bgGradTW, padding:padSym("100","20") }));

  out.push(section([
    col50([
      htmlEl(`<div style="position:relative;padding:20px;min-height:300px;">
        <div style="position:absolute;top:0;left:0;width:75%;transform:rotate(-6deg);border-radius:8px;overflow:hidden;box-shadow:0 8px 30px rgba(0,40,66,0.2);">
          <div style="background-image:url(${img("/images/residential/yard-cleanup.webp")});background-size:cover;background-position:center;height:200px;opacity:0.7;border-radius:8px;"></div>
        </div>
        <div style="position:relative;margin-top:30px;margin-left:20%;border-radius:8px;overflow:hidden;box-shadow:0 8px 30px rgba(0,40,66,0.25);">
          <div style="background-image:url(${img("/images/about/dream-team.webp")});background-size:cover;background-position:center;height:260px;border-radius:8px 8px 0 0;"></div>
          <div style="background:${C.navy900};color:#fff;padding:10px 16px;font-family:Montserrat,sans-serif;font-size:13px;font-weight:600;text-align:center;">Brandon &amp; Valerie — Co-founders</div>
        </div>
      </div>`),
      spacer(10),
    ]),
    col50([
      spacer(10),
      tealBadge("Our Story"),
      spacer(10),
      headEl("Built on a Simple Idea","h2",C.navy900,"left"),
      spacer(8),
      textEl(`<p style="color:${C.gray600};text-align:left;line-height:1.85;">DooGoodScoopers was founded in 2024 by Brandon and Valerie — a husband-and-wife team from the Inland Empire who were tired of seeing neighbors struggle with one of the most dreaded yard chores.</p>`,"left"),
      spacer(8),
      textEl(`<p style="color:${C.gray600};text-align:left;line-height:1.85;">We started small in Rancho Cucamonga. Within months, word spread across the region. Today we proudly serve 90+ ZIP codes across San Bernardino and Los Angeles counties.</p>`,"left"),
      spacer(14),
      htmlEl(`<div style="display:flex;gap:24px;font-family:Montserrat,sans-serif;">
        ${[["2024","Founded"],["521+","Families Served"],["5.0★","Google Rating"]].map(([n,l])=>`
          <div style="text-align:center;">
            <div style="font-size:24px;font-weight:800;color:${C.teal500};">${n}</div>
            <div style="font-size:12px;color:${C.gray600};margin-top:2px;">${l}</div>
          </div>`).join("")}
      </div>`),
      spacer(10),
    ]),
  ], { ...bgWhite, padding:padSym("70","20") }));

  out.push(section([col100([
    headEl("Mission &amp; Vision","h2",C.navy900,"center"),
    spacer(8),
  ])], { ...bgGray, padding:pad("60","20","0","20") }));
  out.push(section([
    col50([iconBoxEl("fa-bullseye","Our Mission","To provide dependable, professional pet waste removal that gives families back their time and creates healthier outdoor environments across the Inland Empire.",C.teal500),spacer(10)]),
    col50([iconBoxEl("fa-eye","Our Vision","To become the most trusted pet waste management company in Southern California — known for reliability, professionalism, and genuine commitment to every yard.",C.navy700),spacer(10)]),
  ], { ...bgGray, padding:pad("10","20","60","20") }));

  out.push(section([
    col50([imgEl(img("/images/residential/scooper-professional.webp"),"Professional scooper team"),spacer(10)]),
    col50([
      spacer(10),
      headEl("Dedicated to Five-Star Service","h2",C.navy900,"left"),
      spacer(8),
      textEl(`<p style="color:${C.gray600};text-align:left;line-height:1.85;">Every team member is background-checked, trained, and passionate about making your yard a better place. We don't cut corners — on every visit we give 100%.</p>`,"left"),
      spacer(12),
      iconListEl(["Background Checked","Fully Insured","Pet-Friendly","Professionally Trained"],C.teal500),
      spacer(10),
    ]),
  ], { ...bgWhite, padding:padSym("70","20") }));

  out.push(section([col100([
    headEl("Our Core Values","h2",C.white),
    spacer(8),
  ])], { ...bgDark, padding:pad("60","20","0","20") }));
  out.push(section(
    [["fa-star","Excellence","Highest standards on every visit."],["fa-heart","Care","We treat every property as our own."],["fa-leaf","Eco-Friendly","Environmentally conscious disposal."],["fa-lock","Reliability","Consistent schedules you can count on."]].map(([ic,ti,de])=>col25([iconBoxEl(ic,ti,de,C.teal400),spacer(8)])),
    { ...bgDark, padding:pad("10","20","60","20") }
  ));

  out.push(...ctaSection("Ready to Reclaim Your Yard?","Join 500+ families across the Inland Empire who trust DooGoodScoopers."));
  out.push(footerSection());
  out.push(footerBar());
  return out;
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESIDENTIAL SERVICES PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const residentialPage = () => {
  const out = [];

  out.push(section([
    col50([
      tealBadge("Residential Services"),
      spacer(12),
      bebasH("Residential Pet Waste Removal","h1",C.navy900,"left",52),
      spacer(8),
      textEl(`<p style="color:${C.gray600};font-size:17px;text-align:left;">Professional, reliable, and hassle-free pooper scooper service for your home.<br>No contracts. Cancel anytime.</p>`,"left"),
      spacer(20),
      btnEl("Get My Free Quote","/quote",C.teal500,C.white,"left"),
      spacer(10),
    ]),
    col50([imgEl(img("/images/residential/scooper-icon.webp"),"Pooper scooper service icon")]),
  ], { ...bgGradTW, padding:padSym("100","20") }));

  // 5-step process
  out.push(section([col100([
    tealBadge("The Process"),
    spacer(10),
    headEl("Getting Started in 5 Easy Steps","h2",C.navy900),
    spacer(8),
  ])], { ...bgWhite, padding:pad("60","20","0","20") }));
  const steps = [
    ["fa-user-plus","Step 1 — Sign Up Online","Create your free account in minutes. Tell us your address, yard size, and number of dogs."],
    ["fa-calendar","Step 2 — Schedule Initial Cleanup","We do a thorough first-time cleanup to get your yard back to baseline."],
    ["fa-laptop","Step 3 — Access Your Portal","Log in to track visits, view confirmation photos, manage your schedule, and update billing."],
    ["fa-credit-card","Step 4 — Add Payment Method","Securely save your card. Billing is automated — no invoices, no reminders."],
    ["fa-face-smile","Step 5 — Enjoy Your Clean Yard","We come on your scheduled day, clean, and send you a confirmation photo. You relax."],
  ];
  out.push(section([col33a,col33b,col33b].map((fn,i)=>fn([iconBoxEl(steps[i][0],steps[i][1],steps[i][2],C.teal500),spacer(8)])),{ ...bgWhite, padding:pad("10","20","8","20") }));
  out.push(section([col33a,col33b,col33b].map((fn,i)=>fn([i<2?iconBoxEl(steps[3+i][0],steps[3+i][1],steps[3+i][2],C.teal500):spacer(10),spacer(8)])),{ ...bgWhite, padding:pad("8","20","60","20") }));

  // Service day
  out.push(section([
    col50([imgEl(img("/images/residential/scooper-professional.webp"),"Service day"),spacer(10)]),
    col50([
      spacer(10),
      headEl("What to Expect on Service Day","h2",C.navy900,"left"),
      spacer(8),
      iconListEl(["ETA text alert before arrival","Multi-pass sweep — nothing missed","Equipment disinfected before leaving","Confirmation photo sent on completion","All waste removed off-site"],C.teal500),
      spacer(10),
    ]),
  ], { ...bgGray, padding:padSym("70","20") }));

  // Deodorization
  out.push(section([
    col50([
      spacer(10),
      tealBadge("Add-On Service"),
      spacer(10),
      headEl("Yard Odor Destroyer","h2",C.navy900,"left"),
      spacer(8),
      textEl(`<p style="color:${C.gray600};text-align:left;line-height:1.85;">Upgrade your service with our professional-grade yard deodorization treatment. Eliminates pet odors at the source — not just masks them. Completely safe for kids, pets, and plants.</p>`,"left"),
      spacer(14),
      btnEl("Ask About This Add-On","/quote",C.teal500,C.white,"left"),
      spacer(10),
    ]),
    col50([imgEl(img("/images/residential/pump-sprayer.webp"),"Yard odor treatment sprayer")]),
  ], { ...bgWhite, padding:padSym("70","20") }));

  const feats = [
    ["fa-bell","ETA Alerts","Get a text when we're on our way."],
    ["fa-route","Optimized Routes","Smart scheduling keeps us in your area."],
    ["fa-rotate","Multiple Passes","Multiple sweeps — nothing missed."],
    ["fa-camera","Photo Verification","Confirmation photo after every visit."],
    ["fa-spray-can","Tool Disinfection","Equipment disinfected between yards."],
    ["fa-graduation-cap","Trained Staff","Background-checked and pet-friendly."],
  ];
  out.push(section([col100([headEl("What's Included With Every Visit","h2",C.navy900),spacer(8)])],{ ...bgGray, padding:pad("60","20","0","20") }));
  out.push(section([col33a,col33b,col33b].map((fn,i)=>fn([iconBoxEl(feats[i][0],feats[i][1],feats[i][2],C.teal500),spacer(8)])),{ ...bgGray, padding:pad("10","20","8","20") }));
  out.push(section([col33a,col33b,col33b].map((fn,i)=>fn([iconBoxEl(feats[3+i][0],feats[3+i][1],feats[3+i][2],C.teal500),spacer(8)])),{ ...bgGray, padding:pad("8","20","60","20") }));

  out.push(...ctaSection("Ready for a Cleaner Yard?","Get started today with a free quote. No contracts, no hassle — just a cleaner yard."));
  out.push(footerSection());
  out.push(footerBar());
  return out;
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMMERCIAL SERVICES PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const commercialPage = () => {
  const out = [];

  out.push(section([
    col50([
      navyBadge("Commercial Services"),
      spacer(12),
      bebasH("Professional Service for Commercial Properties","h1",C.navy900,"left",48),
      spacer(8),
      textEl(`<p style="color:${C.gray600};font-size:16px;text-align:left;">Reliable, scalable pet waste management for HOAs, apartment complexes, dog parks, and commercial properties.</p>`,"left"),
      spacer(20),
      btnEl("Get Free Quote","/quote",C.navy900,C.white,"left"),
      spacer(10),
      btnEl("Free Consultation","tel:9093663744","transparent",C.navy900,"left"),
      spacer(10),
    ]),
    col50([imgEl(img("/images/commercial/commercial-hero.webp"),"Commercial property service")]),
  ], { ...bgGradNW, padding:padSym("100","20") }));

  out.push(section([col100([headEl("Commercial Service Types","h2",C.navy900),spacer(8),textEl(`<p style="color:${C.gray600};">We tailor every plan to fit the unique needs of your property</p>`),spacer(8)])],{ ...bgGray, padding:pad("60","20","0","20") }));
  const svcs = [
    ["/images/commercial/community-grounds.webp","HOA Communities","Keep shared spaces, common areas, and walkways free from pet waste. We maintain strict standards for resident satisfaction."],
    ["/images/commercial/apartment-complex.webp","Apartment Complexes","Regular service for pet-friendly apartment communities. Maintain clean dog areas and reduce resident complaints."],
    ["/images/commercial/professional-team.webp","Dog Parks","Specialized high-frequency service for dog parks. Multiple daily or weekly visits to maintain sanitary conditions."],
    ["/images/commercial/waste-station.webp","Waste Station Maintenance","We service pet waste stations throughout your property — refilling bags, emptying receptacles, keeping everything tidy."],
  ];
  [[col50,col50],[col50,col50]].forEach(([a,b],ri)=>{
    out.push(section([
      a([imgEl(img(svcs[ri*2][0]),svcs[ri*2][1]),spacer(6),headEl(svcs[ri*2][1],"h3",C.navy900,"left"),spacer(4),textEl(`<p style="color:${C.gray600};text-align:left;">${svcs[ri*2][2]}</p>`,"left"),spacer(16)]),
      b([imgEl(img(svcs[ri*2+1][0]),svcs[ri*2+1][1]),spacer(6),headEl(svcs[ri*2+1][1],"h3",C.navy900,"left"),spacer(4),textEl(`<p style="color:${C.gray600};text-align:left;">${svcs[ri*2+1][2]}</p>`,"left"),spacer(16)]),
    ], { ...bgGray, padding:pad(ri?"8":"0","20",ri?"60":"8","20") }));
  });

  out.push(section([
    col50([imgEl(img("/images/commercial/team-scooping.webp"),"Commercial service team"),spacer(10)]),
    col50([
      spacer(10),
      headEl("What's Included","h2",C.white,"left"),
      spacer(8),
      iconListEl(["Scheduled recurring cleanup visits","Complete waste removal & off-site disposal","Equipment disinfection between properties","Post-visit confirmation & service reports","Scheduling around peak property hours","Dedicated account manager"],C.teal400),
      spacer(10),
    ]),
  ], { ...bgDark, padding:padSym("70","20") }));

  out.push(...ctaSection("Ready to Take Back Your Commercial Property?","Schedule a free on-site consultation. We'll build a custom plan for your property."));
  out.push(footerSection());
  out.push(footerBar());
  return out;
};

// ═══════════════════════════════════════════════════════════════════════════════
// FAQ PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const faqPage = () => {
  const out = [];
  out.push(section([col100([
    tealBadge("FAQ"), spacer(12),
    bebasH("Got Questions? We've Got Answers.","h1",C.navy900,"center",52),
    spacer(8),
    textEl(`<p style="color:${C.gray600};font-size:17px;">Everything you need to know about our service. Can't find your answer? Give us a call.</p>`),
    spacer(10),
  ])], { ...bgGradNW, padding:padSym("80","20") }));

  const faqs = [
    ["Do you service the entire yard?","We clean the entire yard — front, back, and side areas. On your first service we'll walk through to identify access points and specific areas."],
    ["Do you provide service year-round?","Yes — 52 weeks a year, rain or shine. In rare cases of extreme weather we'll reschedule and always notify you in advance."],
    ["How is pricing determined?","Pricing is based on the number of dogs and frequency (weekly, bi-weekly, or one-time). Get an instant quote online in under 2 minutes."],
    ["Is there a contract?","No contracts — ever. Pause or cancel anytime through your customer portal. We earn your business every single visit."],
    ["What do you do with the waste?","All waste is double-bagged and removed from your property following local waste management guidelines. Never left at your home."],
    ["Do my dogs need to be inside?","For safety, we ask dogs to be secured indoors or in a separate area. We'll send an ETA text before arriving."],
    ["How do I know when you're coming?","You'll receive SMS when your tech is on the way and when service is complete. View upcoming dates in your customer portal."],
    ["What if I'm not satisfied?","100% satisfaction guarantee. Let us know within 24 hours and we'll return to redo the service at no charge — no questions asked."],
  ];

  out.push(section([
    col66([accordionEl(faqs), spacer(10)]),
    col34([
      imgEl(img("/images/residential/yard-cleanup.webp"),"Clean yard"),
      spacer(18),
      htmlEl(`<div style="background:${C.teal50};border-radius:16px;padding:26px;font-family:Montserrat,sans-serif;">
        <h3 style="font-size:18px;font-weight:700;color:${C.navy900};margin:0 0 10px;">Can't Find Your Answer?</h3>
        <p style="font-size:14px;color:${C.gray600};line-height:1.8;margin:0 0 16px;">Our team is happy to help. Reach out and we'll get back to you right away.</p>
        <a href="tel:9093663744" style="display:block;color:${C.teal600};font-weight:700;font-size:16px;text-decoration:none;margin-bottom:14px;">📞 (909) 366-3744</a>
      </div>`),
      spacer(12),
      btnEl("Get a Free Quote","/quote",C.teal500,C.white),
      spacer(10),
    ]),
  ], { ...bgWhite, padding:padSym("70","20") }));

  out.push(...ctaSection());
  out.push(footerSection());
  out.push(footerBar());
  return out;
};

// ═══════════════════════════════════════════════════════════════════════════════
// QUOTE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const quotePage = () => {
  const out = [];
  out.push(section([col100([
    tealBadge("No Obligation — 100% Free"), spacer(12),
    bebasH("Get Your Free Quote","h1",C.navy900,"center",56),
    spacer(8),
    textEl(`<p style="color:${C.gray600};font-size:17px;">Tell us about your yard and dogs. Instant, transparent price — no hidden fees.</p>`),
    spacer(10),
  ])], { ...bgGradTW, padding:padSym("80","20") }));

  out.push(section([
    col33a([headEl("Why Choose Us?","h3",C.navy900),spacer(6),textEl(`<p style="color:${C.gray600};">Local, family-owned, 5.0 stars on Google. We show up on time and treat every yard as our own.</p>`),spacer(10)]),
    col33b([headEl("What You Get","h3",C.navy900),spacer(6),iconListEl(["Quote in 2 minutes","Zero pressure","25% off first month"],C.teal500),spacer(10)]),
    col33b([headEl("What's Included","h3",C.navy900),spacer(6),iconListEl(["Full yard inspection","Complete waste removal","Tool disinfection","Flexible scheduling","Satisfaction guarantee"],C.teal500),spacer(10)]),
  ], { ...bgGray, padding:padSym("50","20") }));

  out.push(section([col100([
    htmlEl(`<div style="background:#fff;border-radius:20px;padding:48px;max-width:760px;margin:0 auto;box-shadow:0 8px 40px rgba(0,40,66,0.1);font-family:Montserrat,sans-serif;">
      <h2 style="font-size:26px;font-weight:700;color:${C.navy900};text-align:center;margin:0 0 6px;">Request Your Free Quote</h2>
      <p style="font-size:14px;color:${C.gray600};text-align:center;margin:0 0 28px;">Fill out the form — we'll get back to you within minutes.</p>
      <div style="background:${C.teal50};border:2px dashed ${C.teal300};border-radius:12px;padding:40px;text-align:center;color:${C.teal700};font-weight:600;font-size:15px;">
        📋 Place your Quote Form widget here<br>
        <span style="font-size:13px;font-weight:400;color:${C.gray600};">(Drag in an Elementor Form widget, or paste a WPForms / CF7 shortcode)</span>
      </div>
    </div>`),
    spacer(20),
  ])], { ...bgWhite, padding:padSym("60","20") }));

  out.push(footerSection());
  out.push(footerBar());
  return out;
};

// ─── Write files ──────────────────────────────────────────────────────────────
const makeTemplate = (title,content) => ({ version:"0.4", title, type:"page", content, page_settings:{} });

const pages = [
  { file:"home.json",                 title:"Home",                 fn:homePage },
  { file:"about.json",                title:"About",                fn:aboutPage },
  { file:"residential-services.json", title:"Residential Services", fn:residentialPage },
  { file:"commercial-services.json",  title:"Commercial Services",  fn:commercialPage },
  { file:"faq.json",                  title:"FAQ",                  fn:faqPage },
  { file:"quote.json",                title:"Get a Quote",          fn:quotePage },
];

pages.forEach(({ file, title, fn }) => {
  _c = 0;
  const content = fn();
  const t = makeTemplate(title, content);
  const out = path.join(__dirname, file);
  fs.writeFileSync(out, JSON.stringify(t, null, 2), "utf8");
  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`✅  ${file.padEnd(32)} ${String(content.length).padStart(2)} sections  ${kb} KB`);
});
console.log(`\n🔗  BASE_URL="${BASE_URL}" — change line 17 if your domain differs`);
console.log(`🖼️   Upload the /public/ folder images to WordPress Media Library\n`);
