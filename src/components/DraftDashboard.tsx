import { useMemo, useState } from "react";
import clsx from "clsx";
import { DRAFT_TEAMS } from "../teams";
import type { Player, StockWatchDataset } from "../types";
import { PlayerAvatar } from "./PlayerAvatar";
import { playerColor } from "./SeasonChart";

interface DraftDashboardProps {
  dataset: StockWatchDataset;
  weeks: number[];
  selectedWeek: number;
  onSelectWeek: (week: number) => void;
  onViewPlayer: (playerId: number) => void;
}

function playerName(player: Player) {
  return player.nickname || player.first_name;
}

function isEvicted(player: Player) {
  return player.status !== "active" || player.eviction_week !== null;
}

function ordinal(rank: number) {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

export default function DraftDashboard({
  dataset,
  weeks,
  selectedWeek,
  onSelectWeek,
  onViewPlayer,
}: DraftDashboardProps) {
  const [selectedTeamId, setSelectedTeamId] = useState(DRAFT_TEAMS[0].id);
  const teams = useMemo(
    () =>
      DRAFT_TEAMS.map((team) => {
        const players = team.playerSlugs
          .map((slug) =>
            dataset.players.find((player) => player.slug === slug),
          )
          .filter((player): player is Player => Boolean(player));
        const playerIds = new Set(players.map((player) => player.player_id));
        const activePlayerIds = new Set(
          players
            .filter((player) => !isEvicted(player))
            .map((player) => player.player_id),
        );
        const rows = dataset.summaries.filter(
          (row) =>
            playerIds.has(row.player_id) && row.week <= selectedWeek,
        );

        return {
          ...team,
          players,
          activeCount: players.filter((player) => !isEvicted(player)).length,
          currentStockValue: dataset.summaries
            .filter(
              (row) =>
                activePlayerIds.has(row.player_id) &&
                row.week === selectedWeek &&
                row.price !== "",
            )
            .reduce((sum, row) => sum + Number(row.price), 0),
          cumulativeTotal: rows.reduce(
            (sum, row) => sum + Number(row.average_rating),
            0,
          ),
        };
      }),
    [dataset, selectedWeek],
  );
  const teamStandings = [...teams].sort(
    (left, right) => right.currentStockValue - left.currentStockValue,
  );
  const selectedTeam =
    teams.find((team) => team.id === selectedTeamId) ?? teams[0];
  const leadingTeamScore = teamStandings[0]?.currentStockValue ?? 0;
  const selectedTeamPlayerStats = selectedTeam.players.map((player) => {
    const rows = dataset.summaries
      .filter(
        (row) =>
          row.player_id === player.player_id && row.week <= selectedWeek,
      )
      .sort((left, right) => left.week - right.week);
    const current = rows.find((row) => row.week === selectedWeek);
    const scores = rows.map((row) => Number(row.average_rating));

    return {
      player,
      currentScore: current ? Number(current.average_rating) : null,
      highestScore: scores.length ? Math.max(...scores) : null,
      cumulativeScore: scores.reduce((sum, score) => sum + score, 0),
    };
  });

  return (
    <div className="space-y-6">
      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-light">
              Draft board
            </p>
            <h2 className="mt-1 text-2xl font-bold">Who's still in the house?</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Active rosters at a glance. Evicted houseguests remain visible in
              grayscale.
            </p>
          </div>
          <p className="text-xs text-text-muted">
            {dataset.players.filter((player) => !isEvicted(player)).length} of{" "}
            {dataset.players.length} houseguests remaining
          </p>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          <div className="grid min-w-[820px] grid-cols-5 gap-2 lg:gap-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="overflow-hidden rounded-xl border border-border-subtle bg-neutral-bg3"
              >
                <div className="border-b border-border-subtle bg-neutral-bg4 px-3 py-3 text-center">
                  <h3 className="font-bold">{team.name}</h3>
                  <p
                    className={clsx(
                      "mt-0.5 text-xs font-semibold",
                      team.activeCount > 0
                        ? "text-status-success"
                        : "text-status-error",
                    )}
                  >
                    {team.activeCount} remaining
                  </p>
                </div>
                <div className="space-y-2 p-2">
                  {team.players.map((player) => {
                    const evicted = isEvicted(player);

                    return (
                      <button
                        type="button"
                        key={player.player_id}
                        onClick={() => onViewPlayer(player.player_id)}
                        className={clsx(
                          "group relative block aspect-[4/5] w-full overflow-hidden rounded-lg border bg-neutral-bg2 text-left",
                          evicted
                            ? "border-status-error/70"
                            : "border-border-subtle",
                        )}
                      >
                        <PlayerAvatar
                          player={player}
                          className="h-full w-full transition-transform duration-200 group-hover:scale-[1.02]"
                          square
                          evicted={evicted}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent px-2 pb-2 pt-8">
                          <p className="truncate text-sm font-black uppercase tracking-wide text-white">
                            {playerName(player)}
                          </p>
                          <p
                            className={clsx(
                              "text-[10px] font-bold uppercase tracking-wider",
                              evicted
                                ? "text-status-error"
                                : "text-status-success",
                            )}
                          >
                            {evicted
                              ? `Evicted W${player.eviction_week}`
                              : "In the house"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-light">
              Team analytics
            </p>
            <h2 className="mt-1 text-2xl font-bold">Draft standings</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Ranked by active players&apos; combined Week {selectedWeek} stock
              price.
            </p>
          </div>
          <div
            className="flex gap-1 overflow-x-auto rounded-xl bg-neutral-bg2 p-1"
            role="group"
            aria-label="Draft week"
          >
            {weeks.map((week) => (
              <button
                type="button"
                key={week}
                onClick={() => onSelectWeek(week)}
                className={clsx(
                  "min-h-touch min-w-touch shrink-0 rounded-lg px-3 text-sm font-semibold transition-colors",
                  selectedWeek === week
                    ? "bg-brand text-white"
                    : "text-text-muted hover:bg-neutral-bg4 hover:text-white",
                )}
              >
                W{week}
              </button>
            ))}
          </div>
        </div>

        <ol className="space-y-2">
          {teamStandings.map((team, index) => {
            const selected = team.id === selectedTeam.id;
            const progress =
              leadingTeamScore > 0
                ? (team.currentStockValue / leadingTeamScore) * 100
                : 0;

            return (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  className={clsx(
                    "grid w-full grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3 text-left transition-colors sm:grid-cols-[72px_minmax(0,1fr)_150px]",
                    selected
                      ? "border-brand/60 bg-brand/10"
                      : "border-border-subtle bg-neutral-bg3 hover:border-border",
                  )}
                >
                  <span
                    className={clsx(
                      "text-center text-xl font-black sm:text-2xl",
                      index === 0
                        ? "text-brand-light"
                        : "text-text-secondary",
                    )}
                  >
                    {ordinal(index + 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-base font-bold sm:text-lg">
                        {team.name}
                      </span>
                      <span className="shrink-0 text-xs text-text-muted">
                        {team.activeCount} remaining
                      </span>
                    </span>
                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-neutral-bg4">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-brand to-cyan-400"
                        style={{ width: `${progress}%` }}
                      />
                    </span>
                    <span className="mt-1.5 block text-[11px] text-text-muted">
                      {team.cumulativeTotal.toFixed(2)} cumulative rating points
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-xl font-black text-brand-light sm:text-2xl">
                      ${team.currentStockValue.toFixed(2)}
                    </span>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      Week {selectedWeek} stock
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 border-t border-border-subtle pt-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold">{selectedTeam.name}'s team</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Individual performance through Week {selectedWeek}
              </p>
            </div>
            <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold text-brand-light">
              {selectedTeam.players.length} players
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {selectedTeamPlayerStats.map(
              ({
                player,
                currentScore,
                highestScore,
                cumulativeScore,
              }) => {
                const evicted = isEvicted(player);

                return (
                  <button
                    type="button"
                    key={player.player_id}
                    onClick={() => onViewPlayer(player.player_id)}
                    className="rounded-xl border border-border-subtle bg-neutral-bg3 p-4 text-left transition-colors hover:border-border"
                  >
                    <div className="flex items-center gap-3">
                      <PlayerAvatar
                        player={player}
                        className="h-12 w-12"
                        ringColor={
                          evicted
                            ? "#FB7185"
                            : playerColor(player.player_id, dataset.players)
                        }
                        evicted={evicted}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">
                          {playerName(player)}
                        </p>
                        <p
                          className={clsx(
                            "mt-0.5 text-xs",
                            evicted
                              ? "text-status-error"
                              : "text-status-success",
                          )}
                        >
                          {evicted
                            ? `Evicted Week ${player.eviction_week}`
                            : "Active"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <TeamMetric
                        label={`Week ${selectedWeek}`}
                        value={
                          currentScore === null
                            ? "—"
                            : currentScore.toFixed(2)
                        }
                      />
                      <TeamMetric
                        label="Highest"
                        value={
                          highestScore === null
                            ? "—"
                            : highestScore.toFixed(2)
                        }
                      />
                      <TeamMetric
                        label="Cumulative"
                        value={cumulativeScore.toFixed(2)}
                        accent
                      />
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function TeamMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-neutral-bg4 p-2.5">
      <p className="truncate text-[9px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p
        className={clsx(
          "mt-1 text-base font-bold",
          accent && "text-brand-light",
        )}
      >
        {value}
      </p>
    </div>
  );
}
