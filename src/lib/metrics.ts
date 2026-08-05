import type { Metric, Player, WeeklySummary } from "../types";

function finiteNumber(value: unknown): number | null {
  if (
    (typeof value === "string" && value.trim() === "") ||
    (typeof value !== "string" && typeof value !== "number")
  ) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function metricValue(
  row: WeeklySummary,
  metric: Metric,
): number | null {
  return finiteNumber(
    metric === "rating" ? row.average_rating : row.price,
  );
}

export function hasMetricValue(row: WeeklySummary, metric: Metric): boolean {
  return metricValue(row, metric) !== null;
}

export function formatMetric(value: number, metric: Metric): string {
  return metric === "price" ? `$${value.toFixed(2)}` : value.toFixed(2);
}

export function formatChange(value: number, metric: Metric): string {
  return `${value >= 0 ? "+" : "−"}${formatMetric(Math.abs(value), metric)}`;
}

export function movement(
  summaries: WeeklySummary[],
  playerId: number,
  week: number,
  metric: Metric,
): number | null {
  const current = summaries.find(
    (row) => row.player_id === playerId && row.week === week,
  );
  const previous = summaries.find(
    (row) => row.player_id === playerId && row.week === week - 1,
  );
  if (!current || !previous) {
    return null;
  }

  const currentValue = metricValue(current, metric);
  const previousValue = metricValue(previous, metric);
  return currentValue === null || previousValue === null
    ? null
    : currentValue - previousValue;
}

export function seasonWeeks(summaries: WeeklySummary[]): number[] {
  return [...new Set(summaries.map((row) => row.week))].sort(
    (left, right) => left - right,
  );
}

export function isPlayerEligibleInWeek(
  player: Player,
  week: number,
): boolean {
  return player.eviction_week === null || week <= player.eviction_week;
}

export function getFocusedDataWeek(
  player: Player,
  requestedWeek: number,
): number {
  return player.eviction_week !== null &&
    requestedWeek > player.eviction_week
    ? player.eviction_week
    : requestedWeek;
}

export function buildWeekRanking(
  summaries: WeeklySummary[],
  week: number,
  metric: Metric,
): WeeklySummary[] {
  return summaries
    .filter(
      (row) => row.week === week && hasMetricValue(row, metric),
    )
    .sort(
      (left, right) =>
        metricValue(right, metric)! - metricValue(left, metric)!,
    );
}
