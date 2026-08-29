"use client";

import { TrendingUp, AlertTriangle, Target, Users } from "lucide-react";

/**
 * Turns a rank check into a short list of things to actually do.
 *
 * Everything here is derived from the scan in front of it — no generic SEO
 * listicle. If the data doesn't support a recommendation, it isn't shown.
 */

interface Point { lat: number; lng: number; rank: number | null; topNames: string | null }

/** "Fontana, California · A, B, C" → { place, ahead[] } */
function parsePoint(p: Point): { place: string; ahead: string[] } {
  const raw = p.topNames || "";
  const [place, rest] = raw.includes(" · ") ? raw.split(" · ") : ["", raw];
  const ahead = (rest || "").split(", ").map((s) => s.trim()).filter(Boolean);
  return { place: place || "This area", ahead };
}

export function RankAdvice({ points, keyword }: { points: Point[]; keyword: string }) {
  if (!points.length) return null;

  const rows = points.map((p) => ({ ...parsePoint(p), rank: p.rank }));
  const missing = rows.filter((r) => r.rank === null && !r.ahead.join(" ").includes("lookup failed"));
  const close = rows.filter((r) => r.rank !== null && (r.rank as number) > 3 && (r.rank as number) <= 10);
  const far = rows.filter((r) => r.rank !== null && (r.rank as number) > 10);
  const won = rows.filter((r) => r.rank !== null && (r.rank as number) <= 3);

  // Who actually stands between us and the 3-pack, counted across every city.
  const rivalCount = new Map<string, number>();
  for (const r of rows) {
    if (r.rank === null || r.rank > 3) {
      for (const name of r.ahead.slice(0, 10)) {
        if (/waste|scoop|poop|doo|pet|k9|paw/i.test(name)) {
          rivalCount.set(name, (rivalCount.get(name) || 0) + 1);
        }
      }
    }
  }
  const rivals = [...rivalCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const Section = ({ icon: Icon, tint, title, children }: { icon: React.ElementType; tint: string; title: string; children: React.ReactNode }) => (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: `${tint}1A` }}>
        <Icon className="w-4 h-4" style={{ color: tint }} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[14px] font-bold text-navy-900 mb-1">{title}</h3>
        <div className="text-[13px] text-gray-600 space-y-1.5">{children}</div>
      </div>
    </div>
  );

  return (
    <div className="dgs-card p-5 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-navy-900">How to improve these numbers</h2>
        <p className="text-[12.5px] text-gray-500 mt-0.5">Based on this check for &ldquo;{keyword}&rdquo;. Ordered by what moves the needle fastest.</p>
      </div>

      {far.length > 0 && (
        <Section icon={Target} tint="#D97706" title={`${far.length} cit${far.length === 1 ? "y" : "ies"} where you're on page 2`}>
          <p>{far.map((r) => `${r.place.split(",")[0]} (#${r.rank})`).join(", ")}.</p>
          <p>
            Ranked 11–20 means Google knows you but ranks you below a dozen rivals. For a service-area business the three levers that move this,
            in order: <b>an exact primary category</b> (&ldquo;Pet Waste Removal Service&rdquo;, not a generic pick),
            <b> every one of these cities listed in your GBP service area</b>, and <b>review recency</b> — a steady trickle outranks a big old pile.
          </p>
        </Section>
      )}

      {missing.length > 0 && (
        <Section icon={AlertTriangle} tint="#DC2626" title={`Not appearing in ${missing.length} cit${missing.length === 1 ? "y" : "ies"}`}>
          <p>{missing.map((r) => r.place.split(",")[0]).join(", ")}.</p>
          <p>
            Absent from the top 20 usually means one of two things: the city isn&apos;t in your GBP <b>service area</b> list, or you&apos;re too far
            from it for Google to consider you relevant. Check the service area first — it&apos;s free and takes two minutes.
          </p>
        </Section>
      )}

      {close.length > 0 && (
        <Section icon={TrendingUp} tint="#16A34A" title={`${close.length} cit${close.length === 1 ? "y" : "ies"} within reach of the 3-pack`}>
          <p>{close.map((r) => `${r.place.split(",")[0]} (#${r.rank})`).join(", ")}.</p>
          <p>
            This is where to spend effort — moving #6 to #3 is far cheaper than moving #15 to #3, and the 3-pack is where
            nearly all the clicks are. Ask recent happy customers <em>in these cities</em> for reviews; review location matters.
          </p>
        </Section>
      )}

      {won.length > 0 && (
        <Section icon={TrendingUp} tint="#16A34A" title={`Already in the 3-pack in ${won.length} cit${won.length === 1 ? "y" : "ies"}`}>
          <p>{won.map((r) => `${r.place.split(",")[0]} (#${r.rank})`).join(", ")}. Protect these — they&apos;re your lead engine.</p>
        </Section>
      )}

      {rivals.length > 0 && (
        <Section icon={Users} tint="#6D3EF0" title="Who's actually beating you">
          <ul className="space-y-1">
            {rivals.map(([name, n]) => (
              <li key={name} className="flex justify-between gap-3">
                <span className="truncate">{name}</span>
                <span className="text-gray-400 flex-shrink-0">ahead in {n} cit{n === 1 ? "y" : "ies"}</span>
              </li>
            ))}
          </ul>
          <p className="pt-1">
            Look at the top two: their category, their service-area list, how many reviews and how recent. That&apos;s the gap you&apos;re closing.
          </p>
        </Section>
      )}
    </div>
  );
}
