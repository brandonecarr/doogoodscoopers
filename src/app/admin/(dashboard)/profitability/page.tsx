import { redirect } from "next/navigation";
import { TrendingUp, DollarSign, Wallet, Percent, Target } from "lucide-react";
import { getSession } from "@/lib/auth";
import { PageHero } from "@/components/admin/PageHero";
import { ExpenseManager } from "@/components/admin/ExpenseManager";
import { getProfitability, EXPENSE_CATEGORIES } from "@/lib/profitability";

export const dynamic = "force-dynamic";

const money = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money2 = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const fmtMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
};

export default async function ProfitabilityPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const p = await getProfitability(12);
  const current = p.rows[p.rows.length - 1];
  const prior = p.rows[p.rows.length - 2];
  const ytd = p.rows.reduce(
    (a, r) => ({ rev: a.rev + r.revenueCents, exp: a.exp + r.expenseCents, profit: a.profit + r.profitCents }),
    { rev: 0, exp: 0, profit: 0 }
  );

  const tiles = [
    { icon: DollarSign, label: "Revenue this month", value: money(current.revenueCents), sub: `${current.customers} customers billed`, tint: "#16A34A" },
    { icon: Wallet, label: "Costs this month", value: p.hasExpenses ? money(current.expenseCents) : "—", sub: p.hasExpenses ? `${money(current.recurringCents)} overhead + ${money(current.onetimeCents)} one-off` : "add expenses below", tint: "#DC2626" },
    { icon: TrendingUp, label: "Profit this month", value: p.hasExpenses ? money(current.profitCents) : "—", sub: prior && p.hasExpenses ? `${prior.profitCents <= current.profitCents ? "▲" : "▼"} vs ${fmtMonth(prior.month)}` : "revenue minus costs", tint: current.profitCents >= 0 ? "#6D3EF0" : "#DC2626" },
    { icon: Percent, label: "Margin", value: p.hasExpenses && current.marginPct !== null ? `${current.marginPct.toFixed(0)}%` : "—", sub: "profit ÷ revenue", tint: "#0EA5E9" },
  ];

  return (
    <div className="space-y-3.5 pb-20 lg:pb-0">
      <PageHero
        title="Profitability"
        subtitle="Real collected revenue against your costs — what the business actually keeps"
        backHref="/admin/customers"
        icon={
          <div className="w-11 h-11 rounded-[13px] flex items-center justify-center" style={{ background: "linear-gradient(150deg,#8B6BFF,#6D3EF0)" }}>
            <TrendingUp className="w-[22px] h-[22px] text-white" />
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="dgs-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ background: `${t.tint}1A` }}>
              <t.icon className="w-5 h-5" style={{ color: t.tint }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t.label}</p>
              <p className="text-[22px] font-extrabold text-navy-900 leading-tight tracking-[-0.02em]">{t.value}</p>
              <p className="text-[11.5px] text-gray-500 truncate">{t.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Break-even — the number that says how many customers just pay the bills. */}
      {p.breakEvenCustomers !== null && (
        <div className="dgs-card p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ background: "#F59E0B1A" }}>
            <Target className="w-5 h-5" style={{ color: "#D97706" }} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-navy-900">
              You need about {p.breakEvenCustomers} customers just to cover overhead
            </p>
            <p className="text-[12.5px] text-gray-600 mt-0.5">
              {money2(p.monthlyOverheadCents)}/mo of fixed costs ÷ {money2(p.avgRevenuePerCustomerCents)} average revenue per customer.
              Everyone past #{p.breakEvenCustomers} is what you actually take home
              {current.customers > 0 && ` — you're billing ${current.customers}`}.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        {/* P&L */}
        <div className="lg:col-span-2 dgs-card p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold text-navy-900">Month by month</h2>
            <span className="text-[12px] text-gray-500">
              12-month total: {money(ytd.rev)} in{p.hasExpenses ? ` · ${money(ytd.profit)} kept` : ""}
            </span>
          </div>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                  <th className="px-2 py-2 font-semibold">Month</th>
                  <th className="px-2 py-2 font-semibold text-right">Customers</th>
                  <th className="px-2 py-2 font-semibold text-right">Revenue</th>
                  <th className="px-2 py-2 font-semibold text-right">Costs</th>
                  <th className="px-2 py-2 font-semibold text-right">Profit</th>
                  <th className="px-2 py-2 font-semibold text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {[...p.rows].reverse().map((r) => (
                  <tr key={r.month} className="border-b border-gray-50 last:border-0">
                    <td className="px-2 py-2.5 text-navy-900 font-medium whitespace-nowrap">{fmtMonth(r.month)}</td>
                    <td className="px-2 py-2.5 text-right text-gray-600">{r.customers || "—"}</td>
                    <td className="px-2 py-2.5 text-right text-navy-900">{money2(r.revenueCents)}</td>
                    <td className="px-2 py-2.5 text-right text-gray-600">{p.hasExpenses ? money2(r.expenseCents) : "—"}</td>
                    <td className={`px-2 py-2.5 text-right font-semibold ${!p.hasExpenses ? "text-gray-400" : r.profitCents >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {p.hasExpenses ? money2(r.profitCents) : "—"}
                    </td>
                    <td className="px-2 py-2.5 text-right text-gray-600">
                      {p.hasExpenses && r.marginPct !== null ? `${r.marginPct.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11.5px] text-gray-500 mt-3">
            Revenue is money actually collected on Sweep&amp;Go invoices (paid minus refunds) — not what was billed.
          </p>

          {p.byCategory.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <h3 className="text-[13px] font-bold text-navy-900 mb-2">Where the money goes (12 mo)</h3>
              <ul className="space-y-1.5">
                {p.byCategory.map((c) => {
                  const top = p.byCategory[0].cents || 1;
                  return (
                    <li key={c.category}>
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="text-gray-700">{c.label}</span>
                        <span className="font-semibold text-navy-900">{money2(c.cents)}</span>
                      </div>
                      <div className="mt-0.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(c.cents / top) * 100}%`, background: "#8B6BFF" }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <ExpenseManager categories={EXPENSE_CATEGORIES} />
      </div>
    </div>
  );
}
