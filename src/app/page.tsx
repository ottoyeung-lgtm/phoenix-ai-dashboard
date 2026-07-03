"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
} from "recharts";
import teamData from "@/data/team_rollup.json";
import engineerData from "@/data/engineers.json";

interface AiUsageData {
  asOf: string;
  dataWindowDays: number;
  totalUsersReporting: number;
  identifiedUsers: number;
  totalSessions: number;
  totalTokens: number;
  totalCostUsd: number;
  annualisedRunRateUsd: number;
}

function useAiUsage() {
  const [data, setData] = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/ai-usage")
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((d: AiUsageData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  return { data, loading };
}

const COLORS = ["#6366f1", "#22d3ee", "#34d399", "#f59e0b", "#f87171"];

const fmt = {
  usd: (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(2)}M`
      : `$${n.toLocaleString()}`,
  pct: (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`),
  hrs: (n: number | null) => {
    if (n == null) return "—";
    if (n < 1) return `${Math.round(n * 60)}m`;
    if (n < 48) return `${n.toFixed(1)}h`;
    return `${(n / 24).toFixed(1)}d`;
  },
  num: (n: number | null) => (n == null ? "—" : n.toLocaleString()),
};

const totals = teamData.reduce(
  (acc, t) => ({
    headcount: acc.headcount + t.headcount,
    prs: acc.prs + t.prs_merged,
    bugs: acc.bugs + t.bug_count,
    loaded: acc.loaded + t.loaded_annual_cost_usd,
    seat: acc.seat + t.monthly_seat_cost_usd,
  }),
  { headcount: 0, prs: 0, bugs: 0, loaded: 0, seat: 0 }
);

// Computed client-side only to avoid hydration mismatch
function useUpdatedDate() {
  const [date, setDate] = useState("");
  useEffect(() => {
    setDate(new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
  }, []);
  return date;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 flex flex-col gap-1">
      <span className="text-slate-400 text-xs uppercase tracking-widest">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {sub && <span className="text-slate-500 text-xs">{sub}</span>}
    </div>
  );
}

function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-amber-900/40 text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full border border-amber-700/50">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      Awaiting Analytics API
    </span>
  );
}

export default function Dashboard() {
  const { data: aiData, loading: aiLoading } = useAiUsage();
  const UPDATED = useUpdatedDate();
  const prData = teamData.map((t) => ({ team: t.team.split(" ")[0], prs: t.prs_merged }));
  const defectData = teamData
    .filter((t) => t.defect_rate != null)
    .map((t) => ({ team: t.team.split(" ")[0], rate: +(t.defect_rate! * 100).toFixed(1) }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Phoenix AI — Engineering Adoption Baseline
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Last 30 days · Data as of {UPDATED}
          </p>
        </div>
        <span className="self-start sm:self-auto inline-flex items-center gap-1.5 bg-blue-900/40 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full border border-blue-700/50">
          Team-level view — names omitted
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Engineers" value={totals.headcount.toString()} sub="Active seats" />
        <StatCard label="Teams" value={teamData.length.toString()} />
        <StatCard
          label="Total Loaded Cost"
          value={fmt.usd(totals.loaded)}
          sub="Annual, all teams"
        />
        <StatCard
          label="Seat Spend"
          value={`$${totals.seat.toLocaleString()}/mo`}
          sub="Claude seats"
        />
      </div>

      {/* AI Usage — live from StarSight */}
      <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold">AI Usage — Claude Code &amp; Codex</h2>
          <span className="inline-flex items-center gap-1.5 bg-emerald-900/40 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full border border-emerald-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live · refreshes every 5 min
          </span>
        </div>
        <p className="text-slate-500 text-xs mb-5">
          AI tracing launched <strong className="text-slate-400">Jul 2, 2026</strong> via StarSight OTEL (Claude Code + Codex).
          {aiData && !aiLoading && (
            <> Data window: <strong className="text-slate-400">{aiData.dataWindowDays} day{aiData.dataWindowDays !== 1 ? "s" : ""}</strong>.
            Full 30-day baseline available ~Aug 1. Last updated: {new Date(aiData.asOf).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}.</>
          )}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {[
            {
              label: "Users Reporting",
              value: aiLoading ? "…" : `${aiData?.totalUsersReporting ?? "—"}`,
              sub: aiLoading ? "" : `${aiData?.identifiedUsers ?? 0} by work email`,
            },
            {
              label: "Total Tokens",
              value: aiLoading ? "…" : aiData ? `${(aiData.totalTokens / 1_000_000).toFixed(0)}M` : "—",
              sub: "all reporting users",
            },
            {
              label: "Total AI Spend",
              value: aiLoading ? "…" : aiData ? `$${aiData.totalCostUsd.toLocaleString()}` : "—",
              sub: "since tracing launched",
              highlight: true,
            },
            {
              label: "Ann. Run Rate",
              value: aiLoading ? "…" : aiData ? `~$${(aiData.annualisedRunRateUsd).toLocaleString()}` : "—",
              sub: "extrapolated · partial coverage",
            },
          ].map(({ label, value, sub, highlight }) => (
            <div key={label} className="bg-slate-900/60 rounded-lg p-4 flex flex-col gap-1">
              <span className="text-slate-400 text-xs uppercase tracking-wider">{label}</span>
              <span className={`text-2xl font-bold ${highlight ? "text-emerald-400" : "text-white"}`}>{value}</span>
              <span className="text-slate-500 text-xs">{sub}</span>
            </div>
          ))}
        </div>
        <div className="bg-slate-900/40 rounded-lg p-4 border border-slate-700/50">
          <p className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">What&apos;s coming once full coverage is reached</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-500">
            <div className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">◎</span><span>AI active days per engineer → Power / Occasional / Dormant cohort assignment</span></div>
            <div className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">◎</span><span>Per-team token &amp; spend rollup vs loaded cost</span></div>
            <div className="flex items-start gap-2"><span className="text-indigo-400 mt-0.5">◎</span><span>AI active days vs PRs merged scatter — correlation between usage and throughput</span></div>
          </div>
        </div>
      </section>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PRs by team */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">PRs Merged (last 30d)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={prData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="team" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                labelStyle={{ color: "#e2e8f0" }}
                itemStyle={{ color: "#22d3ee" }}
              />
              <Bar dataKey="prs" radius={[4, 4, 0, 0]}>
                {prData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Defect rate by team */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">
            Defect Rate — Bugs / PRs (%)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={defectData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="team" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} unit="%" />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                labelStyle={{ color: "#e2e8f0" }}
                itemStyle={{ color: "#f59e0b" }}
                formatter={(v: number) => [`${v}%`, "Defect Rate"]}
              />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {defectData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full team table */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Team Breakdown</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                {[
                  "Team",
                  "HC",
                  "PRs",
                  "Median Cycle",
                  "Bugs",
                  "Defect Rate",
                  "Reverts",
                  "Loaded Cost",
                  "Seat/mo",
                  "Avg AI Days",
                  "AI Spend",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamData.map((t, i) => (
                <tr
                  key={t.team}
                  className={`border-t border-slate-700/50 hover:bg-slate-800/40 transition-colors ${
                    i % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/20"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-200 whitespace-nowrap">{t.team}</td>
                  <td className="px-4 py-3 text-slate-300">{t.headcount}</td>
                  <td className="px-4 py-3 text-slate-300">{fmt.num(t.prs_merged)}</td>
                  <td className="px-4 py-3 text-slate-300">{fmt.hrs(t.median_cycle_time_hrs)}</td>
                  <td className="px-4 py-3 text-slate-300">{t.bug_count}</td>
                  <td className="px-4 py-3">
                    {t.defect_rate != null ? (
                      <span
                        className={`font-medium ${
                          t.defect_rate > 0.2
                            ? "text-red-400"
                            : t.defect_rate > 0.1
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {fmt.pct(t.defect_rate)}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{t.revert_count}</td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    {fmt.usd(t.loaded_annual_cost_usd)}
                  </td>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                    ${t.monthly_seat_cost_usd.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-amber-500/70 text-xs">pending</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-amber-500/70 text-xs">pending</span>
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="border-t-2 border-slate-600 bg-slate-800 font-semibold text-slate-200">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3">{totals.headcount}</td>
                <td className="px-4 py-3">{totals.prs}</td>
                <td className="px-4 py-3 text-slate-500">—</td>
                <td className="px-4 py-3">{totals.bugs}</td>
                <td className="px-4 py-3 text-slate-500">—</td>
                <td className="px-4 py-3">0</td>
                <td className="px-4 py-3">{fmt.usd(totals.loaded)}</td>
                <td className="px-4 py-3">${totals.seat.toLocaleString()}/mo</td>
                <td className="px-4 py-3 text-slate-500">—</td>
                <td className="px-4 py-3 text-slate-500">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Scatter: AI Active Days vs PRs Merged */}
      <section className="bg-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-slate-300">
            AI Active Days vs PRs Merged — per engineer (anonymised)
          </h3>
          <PendingBadge />
        </div>
        <p className="text-slate-500 text-xs mb-4">
          Each dot is one engineer, coloured by team. Engineers with more active AI days should trend toward higher PR output. Populate once Analytics API data lands.
        </p>
        {engineerData.every((e) => e.ai_active_days === null) ? (
          <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-slate-600 bg-slate-900/40">
            <div className="text-center space-y-2">
              <div className="text-slate-500 text-3xl">◌</div>
              <p className="text-slate-500 text-sm">
                Scatter plot will appear here once AI active-day data is available
              </p>
              <p className="text-slate-600 text-xs">X axis: AI Active Days · Y axis: PRs Merged · Colour: Team</p>
            </div>
          </div>
        ) : (
          (() => {
            const teams = Array.from(new Set(engineerData.map((e) => e.team)));
            const byTeam = teams.map((t) => ({
              name: t,
              data: engineerData
                .filter((e) => e.team === t && e.ai_active_days !== null && e.prs_merged !== null)
                .map((e) => ({ x: e.ai_active_days, y: e.prs_merged, id: e.id })),
            }));
            return (
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    type="number" dataKey="x" name="AI Active Days"
                    domain={[0, 30]} label={{ value: "AI Active Days", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 11 }}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                  />
                  <YAxis
                    type="number" dataKey="y" name="PRs Merged"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                  />
                  <ZAxis range={[60, 60]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                    formatter={(v, name) => [v, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                  {byTeam.map((t, i) => (
                    <Scatter key={t.name} name={t.name} data={t.data} fill={COLORS[i % COLORS.length]} opacity={0.85} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            );
          })()
        )}
      </section>

      {/* Footer */}
      <footer className="text-slate-600 text-xs pt-4 border-t border-slate-800 space-y-1">
        <p>
          Per-person data is restricted to Finance &amp; People Ops. This view shows team-level
          rollups only. Defect rate = bugs assigned / PRs merged (last 30 days, Jira + GitHub).
        </p>
        <p>
          AI Usage columns pending Analytics API access. Loaded cost includes salary, benefits, and
          estimated employer taxes; multi-currency converted to USD at spot rates as of Jun 30,
          2026.
        </p>
      </footer>
    </div>
  );
}
