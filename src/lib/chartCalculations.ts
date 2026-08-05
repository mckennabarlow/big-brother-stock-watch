import type { Metric, Player, WeeklySummary } from "../types";
import {
  hasMetricValue,
  isPlayerEligibleInWeek,
  metricValue,
} from "./metrics";

const PLAYER_COLORS = [
  "#A78BFA",
  "#38BDF8",
  "#34D399",
  "#FBBF24",
  "#FB7185",
  "#F472B6",
  "#22D3EE",
  "#C084FC",
  "#A3E635",
  "#FB923C",
  "#818CF8",
  "#2DD4BF",
  "#E879F9",
  "#FACC15",
  "#60A5FA",
];

export interface ChartPoint {
  week: number;
  value: number;
}

export interface PlayerChartSeries {
  player: Player;
  points: ChartPoint[];
}

export interface ChartTeam {
  id: string;
  name: string;
  players: Player[];
}

export interface TeamChartSeries extends ChartTeam {
  points: ChartPoint[];
}

export interface AxisBounds {
  min: number;
  max: number;
  tickStep: number;
  ticks: number[];
}

export function sortedUniqueWeeks(weeks: number[]): number[] {
  return [...new Set(weeks)].sort((left, right) => left - right);
}

export function buildPlayerSeries(
  players: Player[],
  summaries: WeeklySummary[],
  metric: Metric,
): PlayerChartSeries[] {
  return players.map((player) => {
    const pointsByWeek = new Map<number, ChartPoint>();

    for (const row of summaries) {
      if (
        row.player_id !== player.player_id ||
        !isPlayerEligibleInWeek(player, row.week) ||
        !hasMetricValue(row, metric)
      ) {
        continue;
      }
      pointsByWeek.set(row.week, {
        week: row.week,
        value: metricValue(row, metric)!,
      });
    }

    return {
      player,
      points: [...pointsByWeek.values()].sort(
        (left, right) => left.week - right.week,
      ),
    };
  });
}

export function buildTeamSeries(
  summaries: WeeklySummary[],
  teams: ChartTeam[],
  weeks: number[],
  metric: Metric,
): TeamChartSeries[] {
  const chartWeeks = sortedUniqueWeeks(weeks);

  return teams.map((team) => {
    const playersById = new Map(
      team.players.map((player) => [player.player_id, player]),
    );
    const points = chartWeeks.map((week) => {
      const value = summaries
        .filter((row) => {
          const player = playersById.get(row.player_id);
          return (
            player !== undefined &&
            row.week === week &&
            isPlayerEligibleInWeek(player, week) &&
            hasMetricValue(row, metric)
          );
        })
        .reduce((sum, row) => sum + metricValue(row, metric)!, 0);

      return { week, value };
    });

    return { ...team, points };
  });
}

function bounds(
  min: number,
  max: number,
  tickStep: number,
): AxisBounds {
  return {
    min,
    max,
    tickStep,
    ticks: Array.from(
      { length: Math.floor((max - min) / tickStep) + 1 },
      (_, index) => min + index * tickStep,
    ),
  };
}

export function playerAxisBounds(
  metric: Metric,
  values: number[],
): AxisBounds {
  if (metric === "rating") {
    return bounds(1, 10, 1);
  }

  const finiteValues = values.filter(Number.isFinite);
  const maximum = Math.max(10, ...finiteValues);
  return bounds(0, Math.ceil(maximum / 2) * 2, 2);
}

export function teamAxisBounds(values: number[]): AxisBounds {
  const finiteValues = values.filter(Number.isFinite);
  const maximum = Math.max(10, ...finiteValues);
  return bounds(0, Math.ceil(maximum / 5) * 5, 5);
}

export function playerColor(playerId: number, players: Player[]): string {
  const index = players.findIndex((player) => player.player_id === playerId);
  return PLAYER_COLORS[(index < 0 ? playerId : index) % PLAYER_COLORS.length];
}
