import type { DraftTeam } from "../teams";
import type {
  Metric,
  Player,
  StockWatchDataset,
  TeamScoreMode,
  WeeklySummary,
} from "../types";
import {
  formatChange,
  hasMetricValue,
  isPlayerEligibleInWeek,
  metricValue,
} from "./metrics";

export interface ResolvedDraftTeam extends DraftTeam {
  players: Player[];
  activeCount: number;
  evictedCount: number;
}

export interface DraftTeamResolution {
  teams: ResolvedDraftTeam[];
  unresolvedSlugs: string[];
  duplicateSlugs: string[];
}

export interface TeamStanding extends ResolvedDraftTeam {
  currentValue: number;
  cumulativeTotal: number;
  progress: number;
}

export interface PlayerStat {
  player: Player;
  currentValue: number | null;
  highestValue: number | null;
  cumulativeValue: number;
}

export interface TeamWeeklyValue {
  week: number;
  value: number;
}

export interface PlayerChange {
  player: Player;
  current: number;
  previous: number;
  change: number;
}

export interface PlayerChanges {
  previousWeek: number | undefined;
  changes: PlayerChange[];
  positiveDrivers: PlayerChange[];
  negativeDrivers: PlayerChange[];
}

export interface TeamMovement {
  currentValue: number;
  previousValue: number | null;
  change: number | null;
  biggestPlayerChange: PlayerChange | null;
  leadingDrivers: PlayerChange[];
  explanation: string;
  progress: number;
}

export interface TeamTrend {
  label: "Opening week" | "Trending up" | "Trending down" | "Holding steady" | "Mixed momentum";
  detail: string;
}

function isEvicted(player: Player): boolean {
  return player.status !== "active" || player.eviction_week !== null;
}

function eligibleValue(
  row: WeeklySummary | undefined,
  player: Player,
  metric: Metric,
): number | null {
  if (
    !row ||
    !isPlayerEligibleInWeek(player, row.week) ||
    !hasMetricValue(row, metric)
  ) {
    return null;
  }

  return metricValue(row, metric);
}

export function resolveDraftTeams(
  dataset: Pick<StockWatchDataset, "players">,
  definitions: DraftTeam[],
): DraftTeamResolution {
  const playersBySlug = new Map(
    dataset.players.map((player) => [player.slug, player]),
  );
  const claimedSlugs = new Set<string>();
  const unresolvedSlugs: string[] = [];
  const duplicateSlugs: string[] = [];

  const teams = definitions.map((team) => {
    const players: Player[] = [];

    for (const slug of team.playerSlugs) {
      if (claimedSlugs.has(slug)) {
        duplicateSlugs.push(slug);
        continue;
      }
      claimedSlugs.add(slug);

      const player = playersBySlug.get(slug);
      if (player) {
        players.push(player);
      } else {
        unresolvedSlugs.push(slug);
      }
    }

    const activeCount = players.filter((player) => !isEvicted(player)).length;
    return {
      ...team,
      players,
      activeCount,
      evictedCount: players.length - activeCount,
    };
  });

  return { teams, unresolvedSlugs, duplicateSlugs };
}

export function calculateTeamStandings(
  dataset: Pick<StockWatchDataset, "summaries">,
  teams: ResolvedDraftTeam[],
  metric: Metric,
  selectedWeek: number,
  scoreMode: TeamScoreMode = "total",
): TeamStanding[] {
  const standings = teams
    .map((team, rosterIndex) => {
      const playersById = new Map(
        team.players.map((player) => [player.player_id, player]),
      );
      let currentValue = 0;
      let currentContributors = 0;
      let cumulativeTotal = 0;
      let cumulativeContributors = 0;

      for (const row of dataset.summaries) {
        const player = playersById.get(row.player_id);
        if (!player || row.week > selectedWeek) {
          continue;
        }
        const value = eligibleValue(row, player, metric);
        if (value === null) {
          continue;
        }
        cumulativeTotal += value;
        cumulativeContributors += 1;
        if (row.week === selectedWeek) {
          currentValue += value;
          currentContributors += 1;
        }
      }

      return {
        ...team,
        currentValue:
          scoreMode === "normalized" && currentContributors > 0
            ? currentValue / currentContributors
            : currentValue,
        cumulativeTotal:
          scoreMode === "normalized" && cumulativeContributors > 0
            ? cumulativeTotal / cumulativeContributors
            : cumulativeTotal,
        rosterIndex,
      };
    })
    .sort(
      (left, right) =>
        right.currentValue - left.currentValue ||
        left.rosterIndex - right.rosterIndex,
    )
    .map(({ rosterIndex: _rosterIndex, ...team }) => team);
  const leadingScore = standings[0]?.currentValue ?? 0;

  return standings.map((team) => ({
    ...team,
    progress:
      leadingScore > 0 ? (team.currentValue / leadingScore) * 100 : 0,
  }));
}

export function calculatePlayerStats(
  dataset: Pick<StockWatchDataset, "summaries">,
  players: Player[],
  metric: Metric,
  selectedWeek: number,
): PlayerStat[] {
  return players.map((player) => {
    const valuesByWeek = dataset.summaries
      .filter(
        (row) =>
          row.player_id === player.player_id &&
          row.week <= selectedWeek &&
          isPlayerEligibleInWeek(player, row.week),
      )
      .map((row) => ({ week: row.week, value: metricValue(row, metric) }))
      .filter(
        (item): item is { week: number; value: number } =>
          item.value !== null,
      );
    const current =
      valuesByWeek.find((item) => item.week === selectedWeek)?.value ?? null;
    const values = valuesByWeek.map((item) => item.value);

    return {
      player,
      currentValue: current,
      highestValue: values.length ? Math.max(...values) : null,
      cumulativeValue: values.reduce((sum, value) => sum + value, 0),
    };
  });
}

export function buildTeamWeeklySeries(
  dataset: Pick<StockWatchDataset, "summaries">,
  team: Pick<ResolvedDraftTeam, "players">,
  metric: Metric,
  weeks: number[],
  selectedWeek = Number.POSITIVE_INFINITY,
  scoreMode: TeamScoreMode = "total",
): TeamWeeklyValue[] {
  return weeks
    .filter((week) => week <= selectedWeek)
    .map((week) => {
      const values = team.players.flatMap((player) => {
        const row = dataset.summaries.find(
          (summary) =>
            summary.player_id === player.player_id &&
            summary.week === week,
        );
        const value = eligibleValue(row, player, metric);
        return value === null ? [] : [value];
      });
      const total = values.reduce((sum, value) => sum + value, 0);
      return {
        week,
        value:
          scoreMode === "normalized" && values.length > 0
            ? total / values.length
            : total,
      };
    });
}

export function previousAvailableWeek(
  weeks: number[],
  selectedWeek: number,
): number | undefined {
  return weeks
    .filter((week) => week < selectedWeek)
    .sort((left, right) => left - right)
    .at(-1);
}

export function calculatePlayerChanges(
  dataset: Pick<StockWatchDataset, "summaries">,
  players: Player[],
  metric: Metric,
  selectedWeek: number,
  weeks: number[],
): PlayerChanges {
  const previousWeek = previousAvailableWeek(weeks, selectedWeek);
  if (previousWeek === undefined) {
    return {
      previousWeek,
      changes: [],
      positiveDrivers: [],
      negativeDrivers: [],
    };
  }

  const changes = players
    .map((player, rosterIndex) => {
      const current = eligibleValue(
        dataset.summaries.find(
          (row) =>
            row.player_id === player.player_id && row.week === selectedWeek,
        ),
        player,
        metric,
      );
      const previous = eligibleValue(
        dataset.summaries.find(
          (row) =>
            row.player_id === player.player_id && row.week === previousWeek,
        ),
        player,
        metric,
      );
      return current === null || previous === null
        ? null
        : {
            player,
            current,
            previous,
            change: current - previous,
            rosterIndex,
          };
    })
    .filter(
      (
        item,
      ): item is PlayerChange & { rosterIndex: number } => item !== null,
    )
    .sort(
      (left, right) =>
        Math.abs(right.change) - Math.abs(left.change) ||
        left.rosterIndex - right.rosterIndex,
    )
    .map(({ rosterIndex: _rosterIndex, ...change }) => change);

  return {
    previousWeek,
    changes,
    positiveDrivers: changes.filter((item) => item.change > 0),
    negativeDrivers: changes.filter((item) => item.change < 0),
  };
}

export function summarizeTeamMovement(
  teamName: string,
  series: TeamWeeklyValue[],
  playerChanges: PlayerChange[],
  leadingTeamScore: number,
  metric: Metric,
): TeamMovement {
  const currentValue = series.at(-1)?.value ?? 0;
  const previousValue =
    series.length > 1 ? series.at(-2)!.value : null;
  const change =
    previousValue === null ? null : currentValue - previousValue;
  const leadingDrivers = playerChanges
    .filter((item) =>
      change === null || change === 0
        ? item.change !== 0
        : Math.sign(item.change) === Math.sign(change),
    )
    .slice(0, 2);
  const explanation =
    change === null
      ? "This is the opening week, so there is no prior result to compare."
      : change === 0
        ? "The team's combined result was unchanged from the previous week."
        : leadingDrivers.length > 0
          ? `${change > 0 ? "The gain was led by" : "The decline was driven by"} ${leadingDrivers
              .map(
                (item) =>
                  `${item.player.nickname || item.player.first_name} (${formatChange(item.change, metric)})`,
              )
              .join(" and ")}.`
          : "Roster changes account for most of the week-over-week movement.";

  return {
    currentValue,
    previousValue,
    change,
    biggestPlayerChange: playerChanges[0] ?? null,
    leadingDrivers,
    explanation,
    progress:
      leadingTeamScore > 0 ? (currentValue / leadingTeamScore) * 100 : 0,
  };
}

export function calculateTrend(
  teamName: string,
  series: TeamWeeklyValue[],
): TeamTrend {
  const recentChanges = series
    .slice(1)
    .map((item, index) => item.value - series[index].value)
    .slice(-2);

  if (recentChanges.length === 0) {
    return {
      label: "Opening week",
      detail: "More weeks are needed to establish a trend.",
    };
  }
  if (recentChanges.every((change) => change > 0)) {
    return {
      label: "Trending up",
      detail: `${teamName} has gained in ${recentChanges.length} consecutive week${recentChanges.length === 1 ? "" : "s"}.`,
    };
  }
  if (recentChanges.every((change) => change < 0)) {
    return {
      label: "Trending down",
      detail: `${teamName} has declined in ${recentChanges.length} consecutive week${recentChanges.length === 1 ? "" : "s"}.`,
    };
  }
  if (recentChanges.every((change) => change === 0)) {
    return {
      label: "Holding steady",
      detail: `${teamName}'s result was unchanged in ${recentChanges.length} consecutive week${recentChanges.length === 1 ? "" : "s"}.`,
    };
  }
  return {
    label: "Mixed momentum",
    detail: "Recent weekly movement has changed direction.",
  };
}
