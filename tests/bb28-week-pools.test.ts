import { describe, expect, it } from "vitest";
import rawDataset from "../data/processed/bb28/dataset.json";
import {
  hasMetricValue,
  isPlayerEligibleInWeek,
  metricValue,
  seasonWeeks,
} from "../src/lib/metrics";
import type { StockWatchDataset } from "../src/types";

const dataset = rawDataset as StockWatchDataset;

describe("BB28 Week 1-6 pools", () => {
  it.each([
    [1, 17],
    [2, 16],
    [3, 15],
    [4, 14],
    [5, 12],
    [6, 12],
  ])("Week %s has exactly %s summary players", (week, expected) => {
    const rows = dataset.summaries.filter((row) => row.week === week);

    expect(rows).toHaveLength(expected);
    expect(new Set(rows.map((row) => row.player_id)).size).toBe(expected);
  });

  it.each([
    ["ashley", 1, 1],
    ["chuk", 5, 4],
    ["rome", 2, 2],
    ["jason", 3, 3],
    ["lyric", 4, 4],
  ])(
    "%s was evicted in Week %s after being scored through Week %s",
    (slug, evictionWeek, lastScoredWeek) => {
      const player = dataset.players.find((item) => item.slug === slug);
      expect(player).toBeDefined();
      expect(player?.eviction_week).toBe(evictionWeek);

      const representedWeeks = dataset.summaries
        .filter((row) => row.player_id === player?.player_id)
        .map((row) => row.week);
      expect(representedWeeks).toEqual(
        Array.from({ length: lastScoredWeek }, (_, index) => index + 1),
      );
      expect(
        isPlayerEligibleInWeek(player!, evictionWeek),
      ).toBe(true);
      expect(
        isPlayerEligibleInWeek(player!, evictionWeek + 1),
      ).toBe(false);
    },
  );

  it.each([
    [1, 15],
    [2, 15],
    [3, 15],
    [4, 14],
    [5, 12],
    [6, 12],
  ])(
    "Week %s has exactly %s price-bearing summaries",
    (week, expected) => {
      const rows = dataset.summaries.filter((row) => row.week === week);
      const priced = rows.filter((row) => hasMetricValue(row, "price"));
      const missing = rows.filter(
        (row) => !hasMetricValue(row, "price"),
      );

      expect(priced).toHaveLength(expected);
      expect(
        priced.every((row) => metricValue(row, "price") !== null),
      ).toBe(true);
      expect(missing.every((row) => row.price === "")).toBe(true);
      expect(
        missing.some((row) => metricValue(row, "price") === 0),
      ).toBe(false);
    },
  );

  it("contains exactly the six available weeks without duplicates", () => {
    expect(seasonWeeks(dataset.summaries)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(dataset.metadata.current_week).toBe(6);
  });
});
