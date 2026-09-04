import type { ReactNode } from "react";
import clsx from "clsx";
import type {
  PlayerStat,
  ResolvedDraftTeam,
  TeamStanding,
} from "../../lib/draftCalculations";
import { playerColor } from "../../lib/chartCalculations";
import { formatMetric } from "../../lib/metrics";
import type { Metric, Player, TeamScoreMode } from "../../types";
import { PlayerAvatar } from "../PlayerAvatar";
import { CrownIcon } from "./CrownIcon";
import { isEvicted, ordinal, playerName } from "./helpers";

interface DraftStandingsProps {
  players: Player[];
  weeks: number[];
  selectedWeek: number;
  metric: Metric;
  scoreMode: TeamScoreMode;
  hohPlayer: Player | null;
  teamStandings: TeamStanding[];
  selectedTeam: ResolvedDraftTeam;
  selectedTeamPlayerStats: PlayerStat[];
  onSelectWeek: (week: number) => void;
  onScoreModeChange: (scoreMode: TeamScoreMode) => void;
  onSelectTeam: (teamId: string) => void;
  onViewPlayer: (playerId: number) => void;
  children?: ReactNode;
}

export function DraftStandings({
  players,
  weeks,
  selectedWeek,
  metric,
  scoreMode,
  hohPlayer,
  teamStandings,
  selectedTeam,
  selectedTeamPlayerStats,
  onSelectWeek,
  onScoreModeChange,
  onSelectTeam,
  onViewPlayer,
  children,
}: DraftStandingsProps) {
  return (
    <section className="glass-card overflow-hidden p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-light">
            Team analytics
          </p>
          <h2 className="mt-1 text-2xl font-bold">Draft standings</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {scoreMode === "normalized"
              ? `Ranked by average Week ${selectedWeek} ${metric === "price" ? "stock price" : "rating"} per eligible player with a recorded value.`
              : metric === "price"
              ? `Ranked by eligible players' combined Week ${selectedWeek} stock price, including eviction-week results.`
              : `Ranked by every scored player's combined Week ${selectedWeek} rating, including eviction-week results.`}
          </p>
          <p className="mt-2 text-xs font-semibold text-brand-light">
            Select a team below to update its player breakdown.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <div
            className="flex gap-1 self-end rounded-xl bg-neutral-bg2 p-1"
            role="group"
            aria-label="Draft scoring mode"
          >
            {(["total", "normalized"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                onClick={() => onScoreModeChange(mode)}
                aria-pressed={scoreMode === mode}
                className={clsx(
                  "min-h-touch rounded-lg px-3 text-sm font-semibold transition-colors",
                  scoreMode === mode
                    ? "bg-brand text-white"
                    : "text-text-muted hover:bg-neutral-bg4 hover:text-white",
                )}
              >
                {mode === "total" ? "Total" : "Normalized"}
              </button>
            ))}
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
      </div>

      <ol className="space-y-2">
        {teamStandings.map((team, index) => {
          const selected = team.id === selectedTeam.id;
          const teamHasHoh = team.players.some(
            (player) => player.player_id === hohPlayer?.player_id,
          );

          return (
            <li key={team.id}>
              <button
                type="button"
                onClick={() => onSelectTeam(team.id)}
                aria-pressed={selected}
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
                    index === 0 ? "text-brand-light" : "text-text-secondary",
                  )}
                >
                  {ordinal(index + 1)}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-base font-bold sm:text-lg">
                      {team.name}
                    </span>
                    {selected && (
                      <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                        Viewing
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-text-muted">
                      {team.activeCount} remaining
                    </span>
                  </span>
                  {teamHasHoh && hohPlayer && (
                    <span className="mt-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-300">
                      <CrownIcon className="h-3 w-3" />
                      HOH: {playerName(hohPlayer)}
                    </span>
                  )}
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-neutral-bg4">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-brand to-cyan-400"
                      style={{ width: `${team.progress}%` }}
                    />
                  </span>
                  <span className="mt-1.5 block text-[11px] text-text-muted">
                    {formatMetric(team.cumulativeTotal, metric)}{" "}
                    {scoreMode === "normalized" ? "average" : "cumulative"}{" "}
                    {metric === "price" ? "stock value" : "rating points"}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-xl font-black text-brand-light sm:text-2xl">
                    {formatMetric(team.currentValue, metric)}
                  </span>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    Week {selectedWeek}{" "}
                    {metric === "price" ? "stock" : "rating"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 rounded-xl border border-brand/25 bg-brand/5 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-light">
              Selected team
            </p>
            <h3 className="mt-1 text-xl font-bold">{selectedTeam.name}'s team</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Individual performance through Week {selectedWeek}. Select a
              player to open their season details.
            </p>
          </div>
          <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold text-brand-light">
            {selectedTeam.players.length} players
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {selectedTeamPlayerStats.map(
            ({ player, currentValue, highestValue, cumulativeValue }) => {
              const evicted = isEvicted(player);
              const isHoh = player.player_id === hohPlayer?.player_id;

              return (
                <button
                  type="button"
                  key={player.player_id}
                  onClick={() => onViewPlayer(player.player_id)}
                  className={clsx(
                    "rounded-xl border bg-neutral-bg3 p-4 text-left transition-colors hover:border-border",
                    isHoh
                      ? "border-amber-400/70 shadow-[0_0_16px_rgba(251,191,36,0.16)]"
                      : "border-border-subtle",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <PlayerAvatar
                      player={player}
                      className="h-12 w-12"
                      ringColor={
                        evicted
                          ? "#FB7185"
                          : playerColor(player.player_id, players)
                      }
                      evicted={evicted}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate font-bold">
                        {isHoh && (
                          <CrownIcon className="h-4 w-4 shrink-0 text-amber-300" />
                        )}
                        <span className="truncate">{playerName(player)}</span>
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
                        currentValue === null
                          ? "—"
                          : formatMetric(currentValue, metric)
                      }
                    />
                    <TeamMetric
                      label="Highest"
                      value={
                        highestValue === null
                          ? "—"
                          : formatMetric(highestValue, metric)
                      }
                    />
                    <TeamMetric
                      label="Cumulative"
                      value={formatMetric(cumulativeValue, metric)}
                      accent
                    />
                  </div>
                  <p className="mt-3 text-xs font-bold text-brand-light">
                    View season details →
                  </p>
                </button>
              );
            },
          )}
        </div>

        {children}
      </div>
    </section>
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
