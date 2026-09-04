import clsx from "clsx";
import type {
  PlayerChange,
  ResolvedDraftTeam,
  TeamTrend,
} from "../../lib/draftCalculations";
import { formatChange, formatMetric } from "../../lib/metrics";
import type { Metric, Player, TeamScoreMode } from "../../types";
import { CrownIcon } from "./CrownIcon";
import { isEvicted, playerName } from "./helpers";

interface TeamInsightsProps {
  selectedTeam: ResolvedDraftTeam;
  selectedWeek: number;
  previousWeek: number | undefined;
  metric: Metric;
  scoreMode: TeamScoreMode;
  currentTeamValue: number;
  teamChange: number | null;
  biggestPlayerChange: PlayerChange | null;
  movementExplanation: string;
  trend: TeamTrend;
  hohPlayer: Player | null;
  hohPlayerChange: PlayerChange | null;
}

export function TeamInsights({
  selectedTeam,
  selectedWeek,
  previousWeek,
  metric,
  scoreMode,
  currentTeamValue,
  teamChange,
  biggestPlayerChange,
  movementExplanation,
  trend,
  hohPlayer,
  hohPlayerChange,
}: TeamInsightsProps) {
  const activePlayers = selectedTeam.players.filter(
    (player) => !isEvicted(player),
  );
  const evictedPlayers = selectedTeam.players.filter(isEvicted);

  return (
    <div className="mt-6 border-t border-brand/20 pt-5">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-light">
          Data-driven insights
        </p>
        <h2 className="mt-1 text-2xl font-bold">Team insights</h2>
        <p className="mt-1 text-sm text-text-secondary">
          What changed through Week {selectedWeek} and which players drove the
          movement.
        </p>
      </div>

      {hohPlayer && (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-amber-400/50 bg-amber-400/10 p-4">
          <span className="rounded-full bg-amber-300 p-2 text-amber-950">
            <CrownIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
              Week {selectedWeek} Head of Household
            </p>
            <p className="mt-1 text-lg font-bold text-amber-100">
              {playerName(hohPlayer)} gives {selectedTeam.name} control of the
              house.
            </p>
            <p className="mt-1 text-sm text-amber-100/75">
              {hohPlayerChange
                ? `Their ${metric} moved ${formatChange(hohPlayerChange.change, metric)} from Week ${previousWeek} to Week ${selectedWeek}.`
                : `This is contextual only and does not add bonus points to the team's ${metric} total.`}
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          label="Team movement"
          value={
            teamChange === null
              ? "Opening week"
              : formatChange(teamChange, metric)
          }
          detail={movementExplanation}
          tone={
            teamChange === null || teamChange === 0
              ? "neutral"
              : teamChange > 0
                ? "positive"
                : "negative"
          }
        />
        <InsightCard
          label="Biggest player swing"
          value={
            biggestPlayerChange
              ? playerName(biggestPlayerChange.player)
              : "No comparison"
          }
          detail={
            biggestPlayerChange
              ? `${formatChange(biggestPlayerChange.change, metric)} from Week ${previousWeek} to Week ${selectedWeek} (${formatMetric(biggestPlayerChange.previous, metric)} → ${formatMetric(biggestPlayerChange.current, metric)}).`
              : "No player has values in both the current and previous week."
          }
          tone={
            !biggestPlayerChange || biggestPlayerChange.change === 0
              ? "neutral"
              : biggestPlayerChange.change > 0
                ? "positive"
                : "negative"
          }
        />
        <InsightCard
          label="Trend analysis"
          value={trend.label}
          detail={`${trend.detail} Current ${scoreMode === "normalized" ? "normalized score" : "team total"}: ${formatMetric(currentTeamValue, metric)}.`}
          tone={
            trend.label === "Trending up"
              ? "positive"
              : trend.label === "Trending down"
                ? "negative"
                : "neutral"
          }
        />
        <InsightCard
          label="Roster health"
          value={`${activePlayers.length} of ${selectedTeam.players.length} active`}
          detail={
            evictedPlayers.length
              ? `Out: ${evictedPlayers.map(playerName).join(", ")}.`
              : "The full drafted roster remains in the house."
          }
          tone={evictedPlayers.length ? "negative" : "positive"}
        />
      </div>
    </div>
  );
}

function InsightCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "positive" | "negative" | "neutral";
}) {
  return (
    <article className="rounded-xl border border-border-subtle bg-neutral-bg3 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-text-muted">
        {label}
      </p>
      <p
        className={clsx(
          "mt-2 text-xl font-bold",
          tone === "positive" && "text-status-success",
          tone === "negative" && "text-status-error",
          tone === "neutral" && "text-text-primary",
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        {detail}
      </p>
    </article>
  );
}
