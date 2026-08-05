import { describe, expect, it } from "vitest";
import {
  buildTeamWeeklySeries,
  calculatePlayerChanges,
  calculatePlayerStats,
  calculateTeamStandings,
  calculateTrend,
  previousAvailableWeek,
  resolveDraftTeams,
  summarizeTeamMovement,
  type PlayerChange,
  type ResolvedDraftTeam,
  type TeamWeeklyValue,
} from "../src/lib/draftCalculations";
import type { DraftTeam } from "../src/teams";
import type {
  Metric,
  Player,
  StockWatchDataset,
  WeeklySummary,
} from "../src/types";

function player(
  playerId: number,
  slug: string,
  evictionWeek: number | null = null,
): Player {
  return {
    season: "test",
    player_id: playerId,
    first_name: slug[0].toUpperCase() + slug.slice(1),
    last_name: "Player",
    nickname: slug.toUpperCase(),
    slug,
    status: evictionWeek === null ? "active" : "evicted",
    eviction_week: evictionWeek,
    image_url: "",
  };
}

function summary(
  player: Player,
  week: number,
  rating: number | string,
  price: number | string,
): WeeklySummary {
  return {
    season: "test",
    week,
    player_id: player.player_id,
    player_slug: player.slug,
    player_name: player.nickname,
    average_rating: String(rating),
    rounded_rating: Math.round(Number(rating)),
    rating_count: 4,
    price: String(price),
  };
}

function dataset(
  players: Player[],
  summaries: WeeklySummary[],
): StockWatchDataset {
  return {
    metadata: {
      id: 1,
      name: "Test",
      slug: "test",
      status: "open",
      current_week: 6,
      closes_at: null,
      source: "fixture",
      extracted_at: "2026-01-01T00:00:00.000Z",
    },
    players,
    summaries,
    ratings: [],
    prices: [],
  };
}

const alpha = player(1, "alpha");
const bravo = player(2, "bravo", 2);
const charlie = player(3, "charlie");
const delta = player(4, "delta");
const players = [alpha, bravo, charlie, delta];
const summaries = [
  summary(alpha, 1, 4, 5),
  summary(alpha, 3, 8, ""),
  summary(alpha, 6, 6, 0),
  summary(bravo, 1, 7, 10),
  summary(bravo, 2, 9, 12),
  // A stale post-eviction row must never affect historical calculations.
  summary(bravo, 3, 100, 100),
  summary(charlie, 1, 2, 3),
  summary(charlie, 3, 6, 7),
  summary(charlie, 6, 10, 11),
];
const fixture = dataset(players, summaries);
const definitions: DraftTeam[] = [
  { id: "one", name: "One", playerSlugs: ["alpha", "bravo"] },
  { id: "two", name: "Two", playerSlugs: ["charlie"] },
  { id: "empty", name: "Empty", playerSlugs: ["missing"] },
];

function resolvedTeams(): ResolvedDraftTeam[] {
  return resolveDraftTeams(fixture, definitions).teams;
}

describe("resolveDraftTeams", () => {
  it("resolves players in roster order and computes active and evicted counts", () => {
    const result = resolveDraftTeams(fixture, definitions);

    expect(result.teams[0].players.map((item) => item.slug)).toEqual([
      "alpha",
      "bravo",
    ]);
    expect(result.teams[0]).toMatchObject({
      activeCount: 1,
      evictedCount: 1,
    });
    expect(result.teams[1]).toMatchObject({
      activeCount: 1,
      evictedCount: 0,
    });
  });

  it("reports unknown and duplicate slugs in deterministic encounter order", () => {
    const result = resolveDraftTeams(fixture, [
      { id: "first", name: "First", playerSlugs: ["alpha", "ghost"] },
      {
        id: "second",
        name: "Second",
        playerSlugs: ["alpha", "phantom", "ghost"],
      },
      { id: "solo", name: "Solo", playerSlugs: ["charlie"] },
    ]);

    expect(result.unresolvedSlugs).toEqual(["ghost", "phantom"]);
    expect(result.duplicateSlugs).toEqual(["alpha", "ghost"]);
    expect(result.teams[1].players).toEqual([]);
    expect(result.teams[2].players).toEqual([charlie]);
  });
});

describe("calculateTeamStandings", () => {
  it.each([
    ["rating", 2, ["one", "two", "empty"], [9, 0, 0]],
    ["price", 2, ["one", "two", "empty"], [12, 0, 0]],
    ["price", 3, ["two", "one", "empty"], [7, 0, 0]],
  ] satisfies [Metric, number, string[], number[]][])(
    "uses eviction-week-inclusive %s semantics in Week %s",
    (metric, week, expectedIds, expectedScores) => {
      const result = calculateTeamStandings(
        fixture,
        resolvedTeams(),
        metric,
        week,
      );

      expect(result.map((team) => team.id)).toEqual(expectedIds);
      expect(result.map((team) => team.currentValue)).toEqual(expectedScores);
    },
  );

  it("excludes stale post-eviction rows from current and cumulative totals", () => {
    const [team] = calculateTeamStandings(
      fixture,
      [resolvedTeams()[0]],
      "rating",
      3,
    );

    expect(team.currentValue).toBe(8);
    expect(team.cumulativeTotal).toBe(28);
  });

  it("scales each positive team score relative to the leader", () => {
    const result = calculateTeamStandings(
      fixture,
      resolvedTeams().slice(0, 2),
      "rating",
      3,
    );

    expect(result.map((team) => [team.id, team.currentValue, team.progress]))
      .toEqual([
        ["one", 8, 100],
        ["two", 6, 75],
      ]);
  });

  it("retains roster order for ties and scores empty teams as zero", () => {
    const result = calculateTeamStandings(
      dataset(players, []),
      resolvedTeams(),
      "price",
      6,
    );

    expect(result.map((team) => team.id)).toEqual(["one", "two", "empty"]);
    expect(result.map((team) => team.currentValue)).toEqual([0, 0, 0]);
    expect(result.map((team) => team.progress)).toEqual([0, 0, 0]);
    expect(result.every((team) => Number.isFinite(team.progress))).toBe(true);
  });
});

describe("calculatePlayerStats", () => {
  it("returns current, highest, and cumulative values through the selected week", () => {
    const [result] = calculatePlayerStats(fixture, [alpha], "rating", 3);

    expect(result).toMatchObject({
      currentValue: 8,
      highestValue: 8,
      cumulativeValue: 12,
    });
    expect(result.player).toBe(alpha);
  });

  it("treats blank prices and absent summaries as missing while retaining valid zero", () => {
    const atWeekThree = calculatePlayerStats(
      fixture,
      [alpha, delta],
      "price",
      3,
    );
    const [atWeekSix] = calculatePlayerStats(
      fixture,
      [alpha],
      "price",
      6,
    );

    expect(atWeekThree.map((item) => item.currentValue)).toEqual([null, null]);
    expect(atWeekThree[1]).toMatchObject({
      highestValue: null,
      cumulativeValue: 0,
    });
    expect(atWeekSix).toMatchObject({
      currentValue: 0,
      highestValue: 5,
      cumulativeValue: 5,
    });
  });

  it("includes an evicted player's final week and ignores later stale rows", () => {
    const atEviction = calculatePlayerStats(
      fixture,
      [bravo],
      "price",
      2,
    )[0];
    const afterEviction = calculatePlayerStats(
      fixture,
      [bravo],
      "price",
      3,
    )[0];

    expect(atEviction).toMatchObject({
      currentValue: 12,
      highestValue: 12,
      cumulativeValue: 22,
    });
    expect(afterEviction).toMatchObject({
      currentValue: null,
      highestValue: 12,
      cumulativeValue: 22,
    });
  });
});

describe("buildTeamWeeklySeries", () => {
  it("uses requested nonconsecutive weeks and includes only eligible finite values", () => {
    const result = buildTeamWeeklySeries(
      fixture,
      resolvedTeams()[0],
      "price",
      [1, 3, 6],
    );

    expect(result).toEqual([
      { week: 1, value: 15 },
      { week: 3, value: 0 },
      { week: 6, value: 0 },
    ]);
    expect(result.every((item) => Number.isFinite(item.value))).toBe(true);
  });

  it("includes the eviction-week result and stops at the selected week", () => {
    const result = buildTeamWeeklySeries(
      fixture,
      resolvedTeams()[0],
      "rating",
      [1, 2, 3, 6],
      3,
    );

    expect(result).toEqual([
      { week: 1, value: 11 },
      { week: 2, value: 9 },
      { week: 3, value: 8 },
    ]);
  });
});

describe("week comparisons and player changes", () => {
  it.each([
    [[1, 3, 6], 6, 3],
    [[6, 1, 3], 3, 1],
    [[1, 3, 6], 1, undefined],
  ] satisfies [number[], number, number | undefined][])(
    "selects the previous available week from %j before %s",
    (weeks, selectedWeek, expected) => {
      expect(previousAvailableWeek(weeks, selectedWeek)).toBe(expected);
    },
  );

  it("returns no comparison for the opening week or players missing either value", () => {
    const opening = calculatePlayerChanges(
      fixture,
      [alpha],
      "rating",
      1,
      [1, 3],
    );
    const missing = calculatePlayerChanges(
      fixture,
      [delta],
      "rating",
      3,
      [1, 3],
    );

    expect(opening).toMatchObject({ previousWeek: undefined, changes: [] });
    expect(missing).toMatchObject({ previousWeek: 1, changes: [] });
  });

  it("orders equal absolute swings by roster order and separates driver signs", () => {
    const changes = calculatePlayerChanges(
      fixture,
      [alpha, charlie],
      "rating",
      3,
      [1, 3, 6],
    );
    const decliningFixture = dataset(
      [alpha, charlie],
      [
        summary(alpha, 1, 9, 1),
        summary(alpha, 3, 4, 1),
        summary(charlie, 1, 2, 1),
        summary(charlie, 3, 6, 1),
      ],
    );
    const mixed = calculatePlayerChanges(
      decliningFixture,
      [alpha, charlie],
      "rating",
      3,
      [1, 3],
    );

    expect(changes.changes.map((item) => item.player.slug)).toEqual([
      "alpha",
      "charlie",
    ]);
    expect(changes.positiveDrivers.map((item) => item.change)).toEqual([4, 4]);
    expect(mixed.changes.map((item) => item.change)).toEqual([-5, 4]);
    expect(mixed.positiveDrivers.map((item) => item.player.slug)).toEqual([
      "charlie",
    ]);
    expect(mixed.negativeDrivers.map((item) => item.player.slug)).toEqual([
      "alpha",
    ]);
  });
});

describe("summarizeTeamMovement", () => {
  const change = (
    changedPlayer: Player,
    amount: number,
  ): PlayerChange => ({
    player: changedPlayer,
    previous: 5,
    current: 5 + amount,
    change: amount,
  });

  it.each([
    [
      [{ week: 1, value: 10 }],
      [],
      null,
      "This is the opening week, so there is no prior result to compare.",
    ],
    [
      [
        { week: 1, value: 10 },
        { week: 3, value: 10 },
      ],
      [change(alpha, 2), change(charlie, -2)],
      0,
      "The team's combined result was unchanged from the previous week.",
    ],
    [
      [
        { week: 1, value: 10 },
        { week: 3, value: 14 },
      ],
      [change(alpha, 3), change(charlie, 1)],
      4,
      "The gain was led by ALPHA (+3.00) and CHARLIE (+1.00).",
    ],
    [
      [
        { week: 1, value: 10 },
        { week: 3, value: 4 },
      ],
      [change(alpha, -4), change(charlie, -2)],
      -6,
      "The decline was driven by ALPHA (−4.00) and CHARLIE (−2.00).",
    ],
    [
      [
        { week: 1, value: 10 },
        { week: 3, value: 0 },
      ],
      [],
      -10,
      "Roster changes account for most of the week-over-week movement.",
    ],
  ] satisfies [TeamWeeklyValue[], PlayerChange[], number | null, string][])(
    "summarizes movement for case %#",
    (series, changes, expectedChange, expectedExplanation) => {
      const result = summarizeTeamMovement(
        "One",
        series,
        changes,
        0,
        "rating",
      );

      expect(result.change).toBe(expectedChange);
      expect(result.explanation).toBe(expectedExplanation);
      expect(result.progress).toBe(0);
      expect(Number.isFinite(result.progress)).toBe(true);
    },
  );

  it("returns the compared totals, strongest driver, matching drivers, and leader-relative progress", () => {
    const alphaChange = change(alpha, 3);
    const charlieChange = change(charlie, 1);
    const oppositeChange = change(delta, -2);

    expect(
      summarizeTeamMovement(
        "One",
        [{ week: 1, value: 10 }, { week: 3, value: 14 }],
        [alphaChange, oppositeChange, charlieChange],
        20,
        "rating",
      ),
    ).toMatchObject({
      currentValue: 14,
      previousValue: 10,
      change: 4,
      biggestPlayerChange: alphaChange,
      leadingDrivers: [alphaChange, charlieChange],
      progress: 70,
    });
  });
});

describe("calculateTrend", () => {
  it.each([
    [[5], "Opening week", "More weeks are needed to establish a trend."],
    [[5, 6], "Trending up", "One has gained in 1 consecutive week."],
    [[5, 6, 8], "Trending up", "One has gained in 2 consecutive weeks."],
    [[8, 6], "Trending down", "One has declined in 1 consecutive week."],
    [[8, 6, 5], "Trending down", "One has declined in 2 consecutive weeks."],
    [[5, 5, 5], "Holding steady", "One's result was unchanged in 2 consecutive weeks."],
    [[5, 7, 6], "Mixed momentum", "Recent weekly movement has changed direction."],
  ])("classifies %j as %s", (values, label, detail) => {
    const series = values.map((value, index) => ({
      week: index + 1,
      value,
    }));

    expect(calculateTrend("One", series)).toEqual({ label, detail });
  });

  it("classifies trends from only the two most recent movements", () => {
    const series = [10, 5, 6, 8].map((value, index) => ({
      week: index + 1,
      value,
    }));

    expect(calculateTrend("One", series)).toEqual({
      label: "Trending up",
      detail: "One has gained in 2 consecutive weeks.",
    });
  });
});
