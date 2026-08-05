import clsx from "clsx";
import type { ResolvedDraftTeam } from "../../lib/draftCalculations";
import type { Player } from "../../types";
import { PlayerAvatar } from "../PlayerAvatar";
import { isEvicted, playerName } from "./helpers";

interface DraftBoardProps {
  players: Player[];
  teams: ResolvedDraftTeam[];
  onViewPlayer: (playerId: number) => void;
}

export function DraftBoard({
  players,
  teams,
  onViewPlayer,
}: DraftBoardProps) {
  return (
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
          {players.filter((player) => !isEvicted(player)).length} of{" "}
          {players.length} houseguests remaining
        </p>
      </div>

      <div className="-mx-3 pb-1 sm:mx-0 sm:pb-3">
        <div className="grid grid-cols-5 gap-0.5 sm:gap-2 lg:gap-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className="min-w-0 overflow-hidden rounded-sm border border-border-subtle bg-neutral-bg3 sm:rounded-xl"
            >
              <div className="border-b border-border-subtle bg-neutral-bg4 px-0.5 py-1.5 text-center sm:px-3 sm:py-3">
                <h3 className="truncate text-[9px] font-bold leading-none sm:text-base sm:leading-normal">
                  {team.name}
                </h3>
                <p
                  className={clsx(
                    "mt-1 text-[7px] font-semibold leading-none sm:mt-0.5 sm:text-xs sm:leading-normal",
                    team.activeCount > 0
                      ? "text-status-success"
                      : "text-status-error",
                  )}
                >
                  <span className="sm:hidden">{team.activeCount} left</span>
                  <span className="hidden sm:inline">
                    {team.activeCount} remaining
                  </span>
                </p>
              </div>
              <div className="space-y-0.5 p-0.5 sm:space-y-2 sm:p-2">
                {team.players.map((player) => {
                  const evicted = isEvicted(player);

                  return (
                    <button
                      type="button"
                      key={player.player_id}
                      onClick={() => onViewPlayer(player.player_id)}
                      className={clsx(
                        "group relative block aspect-[4/5] w-full overflow-hidden rounded-[3px] border bg-neutral-bg2 text-left sm:rounded-lg",
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
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent px-0.5 pb-0.5 pt-4 sm:px-2 sm:pb-2 sm:pt-8">
                        <p className="truncate text-[7px] font-black uppercase leading-none tracking-tight text-white sm:text-sm sm:leading-normal sm:tracking-wide">
                          {playerName(player)}
                        </p>
                        <p
                          className={clsx(
                            "mt-0.5 text-[6px] font-bold uppercase leading-none sm:text-[10px] sm:leading-normal sm:tracking-wider",
                            evicted
                              ? "text-status-error"
                              : "text-status-success",
                          )}
                        >
                          <span className="sm:hidden">
                            {evicted ? `Out W${player.eviction_week}` : "In"}
                          </span>
                          <span className="hidden sm:inline">
                            {evicted
                              ? `Evicted W${player.eviction_week}`
                              : "In the house"}
                          </span>
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
  );
}
