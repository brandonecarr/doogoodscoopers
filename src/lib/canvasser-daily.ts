import prisma from "@/lib/prisma";
import { brevoSend, isBrevoConfigured, parseAddr } from "@/lib/brevo-email";

// End-of-day recap emailed to each canvasser who worked that day: doors knocked,
// the disposition breakdown, leads, homes to follow up, and their running totals.
// Runs on a daily cron in the evening (Pacific). Deterministic — no AI dependency.

const FROM = "DooGoodScoopers <service@doogoodscoopers.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doogoodscoopers.vercel.app";

const STATUS_LABEL: Record<string, string> = {
  NOT_HOME: "Not home", CALLBACK: "Call back", INTERESTED: "Interested",
  NOT_INTERESTED: "Not interested", LEAD: "Lead", DO_NOT_KNOCK: "Do not knock",
};
const ORDER = ["INTERESTED", "CALLBACK", "LEAD", "NOT_HOME", "NOT_INTERESTED", "DO_NOT_KNOCK"];

/** Midnight (start of day) Pacific time, as a Date. */
function ptDayStart(now = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(now).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  ) as Record<string, string>;
  const wallAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offsetMs = wallAsUtc - now.getTime();
  const midnightWall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, 0, 0, 0);
  return new Date(midnightWall - offsetMs);
}

function digestHtml(name: string, s: {
  doorsToday: number; byDispoToday: Record<string, number>; leadsToday: number;
  aiToday: number; followups: number; doorsAll: number; leadsAll: number; dateLabel: string;
}): string {
  const chips = ORDER.filter((k) => s.byDispoToday[k]).map((k) =>
    `<span style="display:inline-block;background:#F2F4F7;border-radius:8px;padding:5px 10px;margin:0 6px 6px 0;font-size:13px;color:#344054"><b>${s.byDispoToday[k]}</b> ${STATUS_LABEL[k]}</span>`
  ).join("");
  const first = name.split(" ")[0] || "there";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:8px">
    <div style="font-size:18px;font-weight:800;color:#101828">Nice work today, ${first} 👊</div>
    <div style="font-size:13px;color:#667085;margin:2px 0 16px">Your canvassing recap · ${s.dateLabel}</div>
    <div style="display:flex;gap:10px;margin-bottom:14px">
      <div style="flex:1;background:#F5FAFF;border:1px solid #E3F0FB;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:26px;font-weight:800;color:#0077d6;line-height:1">${s.doorsToday}</div>
        <div style="font-size:11px;font-weight:600;color:#7a8894;text-transform:uppercase;letter-spacing:.03em;margin-top:4px">Doors today</div>
      </div>
      <div style="flex:1;background:#F0FDF4;border:1px solid #DCFCE7;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:26px;font-weight:800;color:#16A34A;line-height:1">${s.leadsToday}</div>
        <div style="font-size:11px;font-weight:600;color:#7a8894;text-transform:uppercase;letter-spacing:.03em;margin-top:4px">Leads today</div>
      </div>
    </div>
    <div style="margin-bottom:14px">${chips || '<span style="font-size:13px;color:#98A2B3">No dispositions recorded.</span>'}</div>
    ${s.followups ? `<div style="background:#FFFAEB;border:1px solid #FEF0C7;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:13.5px;color:#93370D"><b>${s.followups}</b> home${s.followups === 1 ? "" : "s"} to follow up (interested + call-backs). Hit those first tomorrow.</div>` : ""}
    ${s.aiToday ? `<div style="font-size:12.5px;color:#667085;margin-bottom:14px">🎙️ You captured AI notes at <b>${s.aiToday}</b> door${s.aiToday === 1 ? "" : "s"} today.</div>` : ""}
    <div style="font-size:12.5px;color:#667085;border-top:1px solid #EAECF0;padding-top:12px">All-time: <b>${s.doorsAll}</b> doors · <b>${s.leadsAll}</b> leads.</div>
    <a href="${APP_URL}/app/canvasser/ask" style="display:inline-block;margin-top:14px;font-size:13px;font-weight:700;color:#6D3EF0;text-decoration:none">Ask your AI coach about today →</a>
  </div>`;
}

export async function runCanvasserDaily(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const today = ptDayStart(now);
  const dateLabel = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "long", month: "short", day: "numeric" }).format(now);

  const canvassers = await prisma.canvasser.findMany({ where: { active: true, passwordHash: { not: null } } });
  let sent = 0, skipped = 0;

  for (const c of canvassers) {
    const scope = { canvasserId: c.id };
    const [dispoToday, doorsToday, leadsToday, aiToday, doorsAll, leadsAll] = await Promise.all([
      prisma.canvassVisit.groupBy({ by: ["status"], where: { ...scope, createdAt: { gte: today } }, _count: { _all: true } }),
      prisma.canvassVisit.count({ where: { ...scope, createdAt: { gte: today } } }),
      prisma.canvasserLead.count({ where: { ...scope, createdAt: { gte: today } } }),
      prisma.canvassVisit.count({ where: { ...scope, createdAt: { gte: today }, aiNotes: { not: null } } }),
      prisma.canvassVisit.count({ where: scope }),
      prisma.canvasserLead.count({ where: scope }),
    ]);

    if (doorsToday === 0) { skipped++; continue; } // only recap days they worked

    const byDispoToday: Record<string, number> = {};
    for (const d of dispoToday) byDispoToday[d.status] = d._count._all;
    const followups = (byDispoToday.INTERESTED ?? 0) + (byDispoToday.CALLBACK ?? 0);

    if (!isBrevoConfigured()) { skipped++; continue; }
    const res = await brevoSend({
      from: parseAddr(FROM),
      to: [parseAddr(c.email)],
      subject: `Your canvassing recap — ${dateLabel}`,
      html: digestHtml(c.name, { doorsToday, byDispoToday, leadsToday, aiToday, followups, doorsAll, leadsAll, dateLabel }),
      tags: ["canvasser-daily"],
    });
    if (res.error) { console.error("[canvasser-daily]", c.email, res.error); skipped++; }
    else sent++;
  }

  return { sent, skipped };
}
