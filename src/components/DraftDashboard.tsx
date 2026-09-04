import { useMemo, useState } from "react";
import {
  eventPlayer,
  hohEventForWeek,
  seasonEvents,
} from "../events";
import {
  buildTeamWeeklySeries,
  calculatePlayerChanges,
  calculatePlayerStats,
  calculateTeamStandings,
  calculateTrend,
  resolveDraftTeams,
  summarizeTeamMovement,
} from "../lib/draftCalculations";
import { DRAFT_TEAMS } from "../teams";
import type { Metric, StockWatchDataset, TeamScoreMode } from "../types";
import { DraftBoard } from "./draft/DraftBoard";
import { DraftStandings } from "./draft/DraftStandings";
import { TeamInsights } from "./draft/TeamInsights";
import { TeamMetricChart } from "./TeamMetricChart";

interface DraftDashboardProps {
  dataset: StockWatchDataset;
  weeks: number[];
  selectedWeek: number;
  metric: Metric;
  onSelectWeek: (week: number) => void;
  onViewPlayer: (playerId: number) => void;
}

export default function DraftDashboard({
  dataset,
  weeks,
  selectedWeek,
  metric,
  onSelectWeek,
  onViewPlayer,
}: DraftDashboardProps) {
  const [selectedTeamId, setSelectedTeamId] = useState(DRAFT_TEAMS[0].id);
  const [scoreMode, setScoreMode] = useState<TeamScoreMode>("total");
  const events = useMemo(
    () => seasonEvents(dataset.metadata.slug),
    [dataset.metadata.slug],
  );
  const selectedWeekHoh = eventPlayer(
    hohEventForWeek(events, selectedWeek),
    dataset.players,
  );
  const teams = useMemo(
    () => resolveDraftTeams(dataset, DRAFT_TEAMS).teams,
    [dataset],
  );
  const teamStandings = useMemo(
    () =>
      calculateTeamStandings(dataset, teams, metric, selectedWeek, scoreMode),
    [dataset, teams, metric, selectedWeek, scoreMode],
  );
  const handleScoreModeChange = (nextScoreMode: TeamScoreMode) => {
    setScoreMode(nextScoreMode);
    const leader = calculateTeamStandings(
      dataset,
      teams,
      metric,
      selectedWeek,
      nextScoreMode,
    )[0];
    if (leader) {
      setSelectedTeamId(leader.id);
    }
  };
  const selectedTeam =
    teams.find((team) => team.id === selectedTeamId) ?? teams[0];
  const selectedTeamPlayerStats = calculatePlayerStats(
    dataset,
    selectedTeam.players,
    metric,
    selectedWeek,
  );
  const teamWeeklyValues = buildTeamWeeklySeries(
    dataset,
    selectedTeam,
    metric,
    weeks,
    selectedWeek,
    scoreMode,
  );
  const playerChangeResult = calculatePlayerChanges(
    dataset,
    selectedTeam.players,
    metric,
    selectedWeek,
    weeks,
  );
  const movement = summarizeTeamMovement(
    selectedTeam.name,
    teamWeeklyValues,
    playerChangeResult.changes,
    teamStandings[0]?.currentValue ?? 0,
    metric,
  );
  const trend = calculateTrend(selectedTeam.name, teamWeeklyValues);

  return (
    <div className="space-y-6">
      <DraftBoard
        players={dataset.players}
        teams={teams}
        selectedWeek={selectedWeek}
        hohPlayer={selectedWeekHoh}
        onViewPlayer={onViewPlayer}
      />

      <TeamMetricChart
        dataset={dataset}
        teams={teams}
        weeks={weeks}
        metric={metric}
        scoreMode={scoreMode}
        events={events}
        selectedTeamId={selectedTeam.id}
        onSelectTeam={setSelectedTeamId}
      />

      <DraftStandings
        players={dataset.players}
        weeks={weeks}
        selectedWeek={selectedWeek}
        metric={metric}
        scoreMode={scoreMode}
        onScoreModeChange={handleScoreModeChange}
        teamStandings={teamStandings}
        selectedTeam={selectedTeam}
        selectedTeamPlayerStats={selectedTeamPlayerStats}
        hohPlayer={selectedWeekHoh}
        onSelectWeek={onSelectWeek}
        onSelectTeam={setSelectedTeamId}
        onViewPlayer={onViewPlayer}
      >
        <TeamInsights
          selectedTeam={selectedTeam}
          selectedWeek={selectedWeek}
          previousWeek={playerChangeResult.previousWeek}
          metric={metric}
          scoreMode={scoreMode}
          currentTeamValue={movement.currentValue}
          teamChange={movement.change}
          biggestPlayerChange={movement.biggestPlayerChange}
          movementExplanation={movement.explanation}
          trend={trend}
          hohPlayer={
            selectedWeekHoh &&
            selectedTeam.players.some(
              (player) => player.player_id === selectedWeekHoh.player_id,
            )
              ? selectedWeekHoh
              : null
          }
          hohPlayerChange={
            selectedWeekHoh
              ? (playerChangeResult.changes.find(
                  (change) =>
                    change.player.player_id === selectedWeekHoh.player_id,
                ) ?? null)
              : null
          }
        />
      </DraftStandings>
    </div>
  );
}
