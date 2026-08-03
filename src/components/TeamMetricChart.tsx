import { useEffect, useRef } from "react";
import type { Metric, Player, StockWatchDataset } from "../types";

const TEAM_COLORS = ["#A78BFA", "#38BDF8", "#34D399", "#FBBF24", "#FB7185"];

interface ChartTeam {
  id: string;
  name: string;
  players: Player[];
}

interface TeamMetricChartProps {
  dataset: StockWatchDataset;
  teams: ChartTeam[];
  weeks: number[];
  metric: Metric;
  selectedTeamId: string;
  onSelectTeam: (teamId: string) => void;
}

export function TeamMetricChart({
  dataset,
  teams,
  weeks,
  metric,
  selectedTeamId,
  onSelectTeam,
}: TeamMetricChartProps) {
  const scrollContainer = useRef<HTMLDivElement>(null);
  const width = 980;
  const height = 410;
  const padding = { top: 28, right: 64, bottom: 48, left: 64 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const series = teams.map((team, teamIndex) => {
    const playersById = new Map(
      team.players.map((player) => [player.player_id, player]),
    );
    const points = weeks.map((week) => {
      const value = dataset.summaries
        .filter((row) => {
          const player = playersById.get(row.player_id);
          return (
            player &&
            row.week === week &&
            (metric === "rating" || row.price !== "") &&
            (player.eviction_week === null || week <= player.eviction_week)
          );
        })
        .reduce(
          (sum, row) =>
            sum +
            (metric === "rating"
              ? Number(row.average_rating)
              : Number(row.price)),
          0,
        );

      return { week, value };
    });

    return {
      ...team,
      color: TEAM_COLORS[teamIndex % TEAM_COLORS.length],
      points,
    };
  });
  const values = series.flatMap((team) =>
    team.points.map((point) => point.value),
  );
  const yMax = Math.max(10, Math.ceil(Math.max(...values, 10) / 5) * 5);
  const yTicks = Array.from(
    { length: yMax / 5 + 1 },
    (_, index) => index * 5,
  );
  const x = (week: number) =>
    padding.left +
    (weeks.length === 1
      ? chartWidth / 2
      : ((week - weeks[0]) / (weeks.at(-1)! - weeks[0])) * chartWidth);
  const y = (value: number) =>
    padding.top + ((yMax - value) / yMax) * chartHeight;

  useEffect(() => {
    const container = scrollContainer.current;
    if (!container) {
      return;
    }
    container.scrollTo({ left: container.scrollWidth, behavior: "instant" });
  }, [weeks.length]);

  return (
    <section className="glass-card overflow-hidden p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-light">
            Portfolio trajectory
          </p>
          <h2 className="mt-1 text-2xl font-bold">
            Team {metric === "price" ? "stock value" : "ratings"} over time
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Combined weekly {metric === "price" ? "stock prices" : "ratings"}{" "}
            for each roster. A player&apos;s eviction-week result is their final
            contribution.
          </p>
        </div>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          {series.map((team) => (
            <button
              type="button"
              key={team.id}
              onClick={() => onSelectTeam(team.id)}
              aria-pressed={selectedTeamId === team.id}
              className="flex min-h-touch shrink-0 items-center gap-2 rounded-full border border-border-subtle bg-neutral-bg3 px-3 text-xs font-bold text-text-secondary transition-colors hover:border-border hover:text-white"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: team.color }}
              />
              {team.name}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scrollContainer}
        className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[720px]"
          role="img"
          aria-label={`Team ${metric === "price" ? "stock prices" : "ratings"} by week`}
        >
          <rect
            x={padding.left}
            y={padding.top}
            width={chartWidth}
            height={chartHeight}
            rx="18"
            fill="rgba(130,81,238,0.06)"
          />

          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="rgba(255,255,255,0.08)"
              />
              <text
                x={padding.left - 14}
                y={y(tick) + 4}
                textAnchor="end"
                fill="#77778A"
                fontSize="12"
              >
                {metric === "price" ? `$${tick}` : tick}
              </text>
              <text
                x={width - padding.right + 14}
                y={y(tick) + 4}
                textAnchor="start"
                fill="#77778A"
                fontSize="12"
              >
                {metric === "price" ? `$${tick}` : tick}
              </text>
            </g>
          ))}

          {weeks.map((week) => (
            <g key={week}>
              <line
                x1={x(week)}
                x2={x(week)}
                y1={padding.top}
                y2={height - padding.bottom}
                stroke="rgba(255,255,255,0.045)"
              />
              <text
                x={x(week)}
                y={height - 18}
                textAnchor="middle"
                fill="#B5B5C3"
                fontSize="13"
                fontWeight="600"
              >
                Week {week}
              </text>
            </g>
          ))}

          {series.map((team) => {
            const selected = team.id === selectedTeamId;
            const path = team.points
              .map(
                (point, index) =>
                  `${index === 0 ? "M" : "L"} ${x(point.week)} ${y(point.value)}`,
              )
              .join(" ");

            return (
              <g
                key={team.id}
                opacity={selected ? 1 : 0.62}
                className="cursor-pointer"
                onClick={() => onSelectTeam(team.id)}
              >
                <path
                  d={path}
                  fill="none"
                  stroke={team.color}
                  strokeWidth={selected ? 5 : 3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {team.points.map((point) => (
                  <circle
                    key={point.week}
                    cx={x(point.week)}
                    cy={y(point.value)}
                    r={selected ? 7 : 5}
                    fill="#121218"
                    stroke={team.color}
                    strokeWidth="3"
                  >
                    <title>
                      {team.name}, week {point.week}:{" "}
                      {metric === "price" ? "$" : ""}
                      {point.value.toFixed(2)}
                    </title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
