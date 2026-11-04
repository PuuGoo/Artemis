import { requireAdmin, db, COLLECTIONS } from "../../lib/adminAuth.js";
import { json, fail } from "../../lib/http.js";

export const config = { runtime: "nodejs" };

/**
 * GET /api/admin/stats
 * Tổng quan hệ thống cho dashboard quản trị.
 */
export async function GET(request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const database = await db();
  const players = database.collection(COLLECTIONS.players);
  const saves = database.collection(COLLECTIONS.saves);

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 3600 * 1000);
  const weekAgo = new Date(now - 7 * 24 * 3600 * 1000);

  const [
    totalPlayers, newToday, newWeek, activeToday,
    totalSaves, agg, topPlayers,
  ] = await Promise.all([
    players.countDocuments({}),
    players.countDocuments({ createdAt: { $gte: dayAgo } }),
    players.countDocuments({ createdAt: { $gte: weekAgo } }),
    players.countDocuments({ lastLoginAt: { $gte: dayAgo } }),
    saves.countDocuments({}),
    saves.aggregate([
      {
        $group: {
          _id: null,
          totalGold: { $sum: "$data.gold" },
          totalGems: { $sum: "$data.gems" },
          totalKills: { $sum: "$data.lifetimeStats.kills" },
          totalRuns: { $sum: "$data.lifetimeStats.runs" },
          avgGold: { $avg: "$data.gold" },
        },
      },
    ]).toArray(),
    saves.aggregate([
      { $sort: { "data.lifetimeStats.kills": -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          playerId: 1,
          username: 1,
          kills: "$data.lifetimeStats.kills",
          runs: "$data.lifetimeStats.runs",
          wins: "$data.lifetimeStats.wins",
          gold: "$data.gold",
        },
      },
    ]).toArray(),
  ]);

  const totals = agg[0] || {};

  return json({
    ok: true,
    players: { total: totalPlayers, newToday, newWeek, activeToday },
    saves: { total: totalSaves },
    economy: {
      totalGold: Math.round(totals.totalGold || 0),
      totalGems: Math.round(totals.totalGems || 0),
      avgGold: Math.round(totals.avgGold || 0),
    },
    gameplay: {
      totalKills: Math.round(totals.totalKills || 0),
      totalRuns: Math.round(totals.totalRuns || 0),
    },
    topPlayers,
    generatedAt: new Date().toISOString(),
  });
}
