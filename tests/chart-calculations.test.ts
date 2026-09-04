import { describe, expect, it } from "vitest";
import {
  buildPlayerSeries,
  buildTeamSeries,
  playerAxisBounds,
  playerColor,
  teamAxisBounds,
} from "../src/lib/chartCalculations";
import type { Metric, Player, WeeklySummary } from "../src/types";

function player(
  playerId: number,
  slug: string,
  evictionWeek: number | null = null,
): Player {
  return {
    season: "test",
    player_id: playerId,
    first_name: slug,
    last_name: "Player",
    nickname: slug.toUpperCase(),
    slug,
    status: evictionWeek === null ? "active" : "evicted",
    eviction_week: evictionWeek,
    image_url: `https://example.test/${slug}.jpg`,
  };
}

function summary(
  subject: Player,
  week: number,
  rating: string,
  price: string,
): WeeklySummary {
  return {
    season: "test",
    week,
    player_id: subject.player_id,
    player_slug: subject.slug,
    player_name: subject.nickname,
    average_rating: rating,
    rounded_rating: Math.round(Number(rating)),
    rating_count: 4,
    price,
  };
}

const alpha = player(1, "alpha");
const bravo = player(2, "bravo", 2);
const rows = [
  summary(alpha, 3, "8.00", "0.00"),
  summary(alpha, 1, "4.00", "5.00"),
  summary(alpha, 3, "9.00", "0.00"),
  summary(bravo, 1, "6.00", ""),
  summary(bravo, 2, "7.00", "12.00"),
  summary(bravo, 3, "100.00", "100.00"),
];

describe("chart calculations", () => {
  it.each([
    ["rating", [4, 9]],
    ["price", [5, 0]],
  ] satisfies [Metric, number[]][])(
    "buildPlayerSeries sorts unique weeks and selects %s values",
    (metric, expectedValues) => {
      const [series] = buildPlayerSeries([alpha], rows, metric);

      expect(series.points.map((point) => point.week)).toEqual([1, 3]);
      expect(series.points.map((point) => point.value)).toEqual(
        expectedValues,
      );
    },
  );

  it("omits blank prices but retains a valid zero price", () => {
    const series = buildPlayerSeries([alpha, bravo], rows, "price");

    expect(series[0].points).toContainEqual({ week: 3, value: 0 });
    expect(series[1].points.map((point) => point.week)).toEqual([2]);
  });

  it("includes an eviction-week player point and excludes later stale data", () => {
    const [series] = buildPlayerSeries([bravo], rows, "rating");

    expect(series.points).toEqual([
      { week: 1, value: 6 },
      { week: 2, value: 7 },
    ]);
  });

  it("buildTeamSeries sorts unique weeks and sums only eligible metric values", () => {
    const [series] = buildTeamSeries(
      rows,
      [{ id: "one", name: "One", players: [alpha, bravo] }],
      [3, 1, 2, 3],
      "price",
    );

    expect(series.points).toEqual([
      { week: 1, value: 5 },
      { week: 2, value: 12 },
      { week: 3, value: 0 },
    ]);
  });

  it("buildTeamSeries excludes players who are not on the requested team", () => {
    const [series] = buildTeamSeries(
      rows,
      [{ id: "alpha-only", name: "Alpha only", players: [alpha] }],
      [1, 2, 3],
      "rating",
    );

    expect(series.points).toEqual([
      { week: 1, value: 4 },
      { week: 2, value: 0 },
      { week: 3, value: 17 },
    ]);
  });

  it("normalizes each team week by eligible players with recorded values", () => {
    const [series] = buildTeamSeries(
      rows,
      [{ id: "one", name: "One", players: [alpha, bravo] }],
      [1, 2, 3],
      "rating",
      "normalized",
    );

    expect(series.points).toEqual([
      { week: 1, value: 5 },
      { week: 2, value: 7 },
      { week: 3, value: 9 },
    ]);
  });

  it.each([
    ["player price empty", playerAxisBounds("price", [])],
    ["player price single", playerAxisBounds("price", [13])],
    ["team empty", teamAxisBounds([])],
    ["team single", teamAxisBounds([13])],
  ])("%s axis bounds are finite and ordered", (_case, axis) => {
    expect(Number.isFinite(axis.min)).toBe(true);
    expect(Number.isFinite(axis.max)).toBe(true);
    expect(axis.max).toBeGreaterThan(axis.min);
    expect(axis.ticks.at(0)).toBe(axis.min);
    expect(axis.ticks.at(-1)).toBe(axis.max);
  });

  it("uses fixed rating ticks and rounds price axes up to their step", () => {
    expect(playerAxisBounds("rating", [100])).toEqual({
      min: 1,
      max: 10,
      tickStep: 1,
      ticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });
    expect(playerAxisBounds("price", [13, Number.NaN])).toEqual({
      min: 0,
      max: 14,
      tickStep: 2,
      ticks: [0, 2, 4, 6, 8, 10, 12, 14],
    });
    expect(teamAxisBounds([13, Number.POSITIVE_INFINITY])).toEqual({
      min: 0,
      max: 15,
      tickStep: 5,
      ticks: [0, 5, 10, 15],
    });
  });

  it("playerColor is deterministic for known and unknown player IDs", () => {
    const players = [alpha, bravo];

    expect(playerColor(alpha.player_id, players)).toBe("#A78BFA");
    expect(playerColor(bravo.player_id, players)).toBe("#38BDF8");
    expect(playerColor(23, players)).toBe("#A3E635");
    expect(playerColor(23, [...players].reverse())).toBe("#A3E635");
  });
});
