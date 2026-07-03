import { NextResponse } from "next/server";

const BASE = "https://knowledge.celerdata.com/starsight/api/public";

async function fetchAll(token: string, path: string) {
  const all: Record<string, unknown>[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${BASE}${path}&page=${page}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 }, // cache 5 min
    });
    if (!res.ok) break;
    const data = await res.json();
    all.push(...(data.data ?? []));
    if (page >= (data.meta?.totalPages ?? 1)) break;
    page++;
  }
  return all;
}

export async function GET() {
  const token = process.env.STARSIGHT_API_KEY;
  if (!token) {
    return NextResponse.json({ error: "STARSIGHT_API_KEY not set" }, { status: 500 });
  }

  const sessions = await fetchAll(token, "/sessions?");

  // Aggregate per user
  const userMap: Record<string, {
    tokens: number; cost: number; sessions: number; activeDays: Set<string>;
  }> = {};

  for (const s of sessions) {
    const uid = ((s.userIds as string[]) ?? [])[0];
    if (!uid) continue;
    if (!userMap[uid]) {
      userMap[uid] = { tokens: 0, cost: 0, sessions: 0, activeDays: new Set() };
    }
    const u = userMap[uid];
    u.tokens += (s.totalTokens as number) ?? 0;
    u.cost += (s.totalCost as number) ?? 0;
    u.sessions += 1;
    const day = ((s.createdAt as string) ?? "").slice(0, 10);
    if (day) u.activeDays.add(day);
  }

  const users = Object.entries(userMap).map(([id, d]) => ({
    userId: id,
    isEmail: id.includes("@"),
    activeDays: d.activeDays.size,
    sessions: d.sessions,
    tokens: d.tokens,
    costUsd: Math.round(d.cost * 100) / 100,
  })).sort((a, b) => b.costUsd - a.costUsd);

  const identified = users.filter(u => u.isEmail);
  const totalTokens = users.reduce((s, u) => s + u.tokens, 0);
  const totalCost = users.reduce((s, u) => s + u.costUsd, 0);
  const totalSessions = sessions.length;

  // Annualised run rate: daily avg * 365
  const allDates = new Set(
    sessions.map(s => ((s.createdAt as string) ?? "").slice(0, 10)).filter(Boolean)
  );
  const daySpan = allDates.size || 1;
  const dailyAvgCost = totalCost / daySpan;
  const annualisedRunRate = Math.round(dailyAvgCost * 365);

  return NextResponse.json({
    asOf: new Date().toISOString(),
    dataWindowDays: daySpan,
    totalUsersReporting: users.length,
    identifiedUsers: identified.length,
    totalSessions,
    totalTokens,
    totalCostUsd: Math.round(totalCost * 100) / 100,
    annualisedRunRateUsd: annualisedRunRate,
    users,
  });
}
