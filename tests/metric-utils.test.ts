import { describe, expect, it } from "vitest";
import {
  buildWeekRanking,
  formatChange,
  formatMetric,
  getFocusedDataWeek,
  hasMetricValue,
  isPlayerEligibleInWeek,
  metricValue,
  movement,
  seasonWeeks,
} from "../src/lib/metrics";
import type { Metric, Player, WeeklySummary } from "../src/types";

function summary(
  week: number,
  averageRating: string,
  price: string,
  playerId = 7,
): WeeklySummary {
  return {
    season: "bb28",
    week,
    player_id: playerId,
    player_slug: `player-${playerId}`,
    player_name: `Player ${playerId}`,
    average_rating: averageRating,
    rounded_rating: Math.round(Number(averageRating)),
    rating_count: 4,
    price,
  };
}

function player(evictionWeek: number | null): Player {
  return {
    season: "bb28",
    player_id: 7,
    first_name: "Test",
    last_name: "Player",
    nickname: "Tester",
    slug: "tester",
    status: evictionWeek === null ? "active" : "evicted",
    eviction_week: evictionWeek,
    image_url: "",
  };
}

describe("metric utilities", () => {
  it.each([
    ["rating", summary(1, "7.25", "12.50"), 7.25],
    ["price", summary(1, "7.25", "12.50"), 12.5],
    ["price", summary(1, "7.25", "0.00"), 0],
  ] satisfies [Metric, WeeklySummary, number][])(
    "metricValue reads a finite %s value",
    (metric, row, expected) => {
      expect(metricValue(row, metric)).toBe(expected);
      expect(hasMetricValue(row, metric)).toBe(true);
    },
  );

  it.each([
    ["rating", ""],
    ["rating", "not-a-number"],
    ["rating", "NaN"],
    ["rating", "Infinity"],
    ["rating", "-Infinity"],
    ["price", ""],
    ["price", "  "],
    ["price", "not-a-number"],
    ["price", "NaN"],
    ["price", "Infinity"],
    ["price", "-Infinity"],
  ] satisfies [Metric, string][])(
    "classifies an invalid %s value of %j as missing",
    (metric, value) => {
      const row =
        metric === "rating"
          ? summary(1, value, "10.00")
          : summary(1, "6.00", value);

      expect(metricValue(row, metric)).toBeNull();
      expect(hasMetricValue(row, metric)).toBe(false);
    },
  );

  it.each([
    [7.2, "rating", "7.20"],
    [0, "rating", "0.00"],
    [12.5, "price", "$12.50"],
    [0, "price", "$0.00"],
  ] satisfies [number, Metric, string][])(
    "formatMetric formats %s as %s",
    (value, metric, expected) => {
      expect(formatMetric(value, metric)).toBe(expected);
    },
  );

  it.each([
    [1.25, "rating", "+1.25"],
    [0, "rating", "+0.00"],
    [-1.25, "rating", "−1.25"],
    [2.5, "price", "+$2.50"],
    [0, "price", "+$0.00"],
    [-2.5, "price", "−$2.50"],
  ] satisfies [number, Metric, string][])(
    "formatChange formats %s %s change",
    (value, metric, expected) => {
      expect(formatChange(value, metric)).toBe(expected);
    },
  );

  it.each([
    ["rating", [summary(1, "5.00", "8.00"), summary(2, "7.50", "9.00")], 2.5],
    ["rating", [summary(1, "7.50", "8.00"), summary(2, "7.50", "9.00")], 0],
    ["rating", [summary(1, "8.00", "8.00"), summary(2, "6.50", "9.00")], -1.5],
    ["price", [summary(1, "5.00", "8.00"), summary(2, "7.50", "10.25")], 2.25],
  ] satisfies [Metric, WeeklySummary[], number][])(
    "movement computes consecutive %s movement",
    (metric, rows, expected) => {
      expect(movement(rows, 7, 2, metric)).toBe(expected);
    },
  );

  it.each([
    ["opening week", [summary(1, "5.00", "8.00")], 1, "rating"],
    ["absent current row", [summary(1, "5.00", "8.00")], 2, "rating"],
    ["absent previous row", [summary(2, "5.00", "8.00")], 2, "rating"],
    [
      "blank current price",
      [summary(1, "5.00", "8.00"), summary(2, "6.00", "")],
      2,
      "price",
    ],
    [
      "blank previous price",
      [summary(1, "5.00", ""), summary(2, "6.00", "8.00")],
      2,
      "price",
    ],
    [
      "nonconsecutive week gap",
      [summary(1, "5.00", "8.00"), summary(3, "6.00", "9.00")],
      3,
      "rating",
    ],
  ] satisfies [string, WeeklySummary[], number, Metric][])(
    "movement returns null for %s",
    (_case, rows, week, metric) => {
      expect(movement(rows, 7, week, metric)).toBeNull();
    },
  );

  it("seasonWeeks deduplicates and numerically sorts weeks", () => {
    const rows = [
      summary(10, "5.00", "8.00"),
      summary(2, "6.00", "9.00"),
      summary(1, "7.00", "10.00"),
      summary(2, "8.00", "11.00", 8),
    ];

    expect(seasonWeeks(rows)).toEqual([1, 2, 10]);
    expect(rows.map((row) => row.week)).toEqual([10, 2, 1, 2]);
  });

  it("buildWeekRanking selects the requested week, excludes missing values, and sorts descending", () => {
    const rows = [
      summary(2, "6.00", "10.00", 1),
      summary(2, "8.00", "", 2),
      summary(1, "9.00", "20.00", 3),
      summary(2, "7.00", "15.00", 4),
    ];

    expect(
      buildWeekRanking(rows, 2, "price").map((row) => row.player_id),
    ).toEqual([4, 1]);
    expect(rows.map((row) => row.player_id)).toEqual([1, 2, 3, 4]);
  });

  it.each([
    [null, 99, true],
    [3, 2, true],
    [3, 3, true],
    [3, 4, false],
  ])(
    "eligibility for eviction week %s and requested week %s is %s",
    (evictionWeek, week, expected) => {
      expect(isPlayerEligibleInWeek(player(evictionWeek), week)).toBe(
        expected,
      );
    },
  );

  it.each([
    [null, 4, 4],
    [3, 2, 2],
    [3, 3, 3],
    [3, 4, 3],
  ])(
    "focused week for eviction week %s and request %s is %s",
    (evictionWeek, requestedWeek, expected) => {
      expect(
        getFocusedDataWeek(player(evictionWeek), requestedWeek),
      ).toBe(expected);
    },
  );
});
