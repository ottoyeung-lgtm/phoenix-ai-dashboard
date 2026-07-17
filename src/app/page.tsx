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
import providerData from "@/data/provider_breakdown.json";

interface AiUsageData {
  asOf: string;
  dataWindowDays: number;
  totalUsersReporting: number;
  identifiedUsers: number;
  totalSessions: number;
  totalTokens: number;
  totalCostUsd: number;
  annualisedRunRateUsd: number;
  byEngId: Record<string, { activeDays: number; tokens: number; costUsd: number }>;
  byProvider: Record<string, { costUsd: number; traces: number }>;
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
        {/* Provider breakdown — static from 500-trace sample */}
        {(() => {
          const providers = [
            { key: "claude-code",         label: "Claude Code (CLI)",     pct: 90.6, hex: "#6366f1" },
            { key: "claude-code-desktop", label: "Claude Code (Desktop)", pct: 8.3,  hex: "#22d3ee" },
            { key: "codex_cli_rs",        label: "Codex CLI",             pct: 1.1,  hex: "#f59e0b" },
          ];
          return (
            <div className="mb-5">
              <p className="text-slate-400 text-xs font-medium mb-2 uppercase tracking-wider">Provider Mix — by spend (500-trace sample)</p>
              <div className="flex h-3 rounded-full overflow-hidden mb-3" style={{ gap: "2px" }}>
                {providers.map((p) => (
                  <div key={p.key} style={{ width: `${p.pct}%`, backgroundColor: p.hex }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                {providers.map((p) => (
                  <div key={p.key} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.hex }} />
                    <span className="text-slate-300 text-xs">{p.label}</span>
                    <span className="text-xs font-medium" style={{ color: p.hex }}>{p.pct}%</span>
                  </div>
                ))}
              </div>
              <p className="text-slate-600 text-xs mt-1.5">Jul 2–9 2026 · Codex spend is entirely non-roster (CTO personal Gmail)</p>
            </div>
          );
        })()}

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
                  <td className="px-4 py-3 text-slate-300">—</td>
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
          {aiData?.byEngId && Object.keys(aiData.byEngId).length > 0 ? (
            <span className="inline-flex items-center gap-1.5 bg-emerald-900/40 text-emerald-400 text-xs font-medium px-3 py-1.5 rounded-full border border-emerald-700/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live · refreshes every 5 min
            </span>
          ) : (
            <PendingBadge />
          )}
        </div>
        <p className="text-slate-500 text-xs mb-4">
          Each dot is one engineer, coloured by team. Grows automatically as more engineers onboard to StarSight.
        </p>
        {(() => {
          // Merge static throughput data with live AI data from StarSight
          const enriched = engineerData.map(e => {
            const live = aiData?.byEngId?.[e.id];
            return {
              ...e,
              ai_active_days: live !== undefined ? live.activeDays : e.ai_active_days,
            };
          });
          const withBoth = enriched.filter(e => e.ai_active_days !== null && e.prs_merged !== null);
          if (withBoth.length < 3) {
            return (
              <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-slate-600 bg-slate-900/40">
                <div className="text-center space-y-2">
                  <div className="text-slate-500 text-3xl">◌</div>
                  <p className="text-slate-500 text-sm">
                    {withBoth.length === 0
                      ? "Scatter plot will appear here once AI active-day data is available"
                      : `${withBoth.length} engineer${withBoth.length > 1 ? "s" : ""} with complete data so far — needs more coverage to show meaningful correlation`}
                  </p>
                  <p className="text-slate-600 text-xs">X axis: AI Active Days · Y axis: PRs Merged · Colour: Team</p>
                </div>
              </div>
            );
          }
          const teams = Array.from(new Set(enriched.map((e) => e.team)));
          const byTeam = teams.map((t) => ({
            name: t,
            data: enriched
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
                  formatter={(v: number, name: string) => [v, name]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                {byTeam.map((t, i) => (
                  <Scatter key={t.name} name={t.name} data={t.data} fill={COLORS[i % COLORS.length]} opacity={0.85} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          );
        })()}
      </section>

      {/* Per-Engineer Table */}
      {(() => {
        const enriched = engineerData.map(e => {
          const live = aiData?.byEngId?.[e.id];
          const aiDays = live !== undefined ? live.activeDays : (e.ai_active_days ?? 0);
          const aiTokens = live !== undefined ? live.tokens : (e.ai_tokens ?? 0);
          const aiSpend = live !== undefined ? live.costUsd : (e.ai_spend_usd ?? 0);
          const cohort = aiDays === 0 ? "Never" : aiDays >= 15 ? "Power" : aiDays >= 5 ? "Occasional" : "Dormant";
          return { ...e, aiDays, aiTokens, aiSpend, cohort };
        });
        const COHORT_COLOR: Record<string, string> = {
          Power: "text-emerald-400 bg-emerald-900/30 border-emerald-700/40",
          Occasional: "text-amber-400 bg-amber-900/30 border-amber-700/40",
          Dormant: "text-slate-400 bg-slate-800 border-slate-600/40",
          Never: "text-slate-600 bg-slate-900/50 border-slate-700/30",
        };
        return (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Engineer Detail</h2>
              <span className="inline-flex items-center gap-1.5 bg-blue-900/40 text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full border border-blue-700/50">
                IDs anonymised · {enriched.length} engineers
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                    {["ID","Team","Cohort","AI Days","AI Tokens","AI Spend","PRs","Cycle Time","Bugs","Defect Rate"].map(h => (
                      <th key={h} className="px-3 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((e, i) => (
                    <tr key={e.id} className={`border-t border-slate-700/50 hover:bg-slate-800/40 transition-colors ${i % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/20"}`}>
                      <td className="px-3 py-2.5 font-mono text-slate-300 text-xs">{e.id}</td>
                      <td className="px-3 py-2.5 text-slate-300 whitespace-nowrap">{e.team}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${COHORT_COLOR[e.cohort]}`}>
                          {e.cohort}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">{e.aiDays > 0 ? String(e.aiDays) : <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-2.5 text-slate-300">{e.aiTokens > 0 ? (e.aiTokens / 1_000_000).toFixed(1) + "M" : <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-2.5 text-slate-300">{e.aiSpend > 0 ? `$${e.aiSpend.toFixed(2)}` : <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-2.5 text-slate-300">{e.prs_merged != null ? String(e.prs_merged) : <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-2.5 text-slate-300">{fmt.hrs(e.median_cycle_time_hrs)}</td>
                      <td className="px-3 py-2.5 text-slate-300">{e.bug_count != null ? String(e.bug_count) : <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-2.5">
                        {e.prs_merged != null && e.prs_merged > 0 && e.bug_count != null
                          ? (() => { const r = e.bug_count / e.prs_merged; return (
                              <span className={`font-medium ${r > 0.2 ? "text-red-400" : r > 0.1 ? "text-amber-400" : "text-emerald-400"}`}>
                                {(r * 100).toFixed(0)}%
                              </span>
                            ); })()
                          : <span className="text-slate-600">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-slate-600 text-xs mt-2">
              Cohort: Power ≥15 AI active days · Occasional 5–14 · Dormant 1–4 · Never 0. ¹Dormant also flags anyone last active 7+ days ago regardless of total count. AI data live from StarSight; throughput from GitHub + Jira.
            </p>
          </section>
        );
      })()}

      {/* Footer */}
      <footer className="text-slate-600 text-xs pt-4 border-t border-slate-800 space-y-1">
        <p>
          Engineer IDs are anonymised. Mapping available to Finance &amp; VP Eng only.
          Defect rate = bugs assigned / PRs merged (last 30 days, Jira + GitHub).
        </p>
        <p>
          Loaded cost includes salary, benefits, and estimated employer taxes; multi-currency
          converted to USD at spot rates as of Jun 30, 2026.
        </p>
      </footer>
    </div>
  );
}
