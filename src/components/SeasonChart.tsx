import { useEffect, useRef } from "react";
import {
  buildPlayerSeries,
  playerAxisBounds,
  playerColor,
} from "../lib/chartCalculations";
import { seasonWeeks } from "../lib/metrics";
import type { Metric, Player, WeeklySummary } from "../types";

export { playerColor } from "../lib/chartCalculations";

interface SeasonChartProps {
  metric: Metric;
  players: Player[];
  summaries: WeeklySummary[];
  visiblePlayerIds: Set<number>;
  focusedPlayerId: number;
  onFocusPlayer: (playerId: number) => void;
}

export function SeasonChart({
  metric,
  players,
  summaries,
  visiblePlayerIds,
  focusedPlayerId,
  onFocusPlayer,
}: SeasonChartProps) {
  const scrollContainer = useRef<HTMLDivElement>(null);
  const width = 980;
  const height = 450;
  const padding = { top: 26, right: 58, bottom: 48, left: 58 };
  const weeks = seasonWeeks(summaries);
  const series = buildPlayerSeries(players, summaries, metric);
  const visible = series.filter(({ player }) =>
    visiblePlayerIds.has(player.player_id),
  );
  const axis = playerAxisBounds(
    metric,
    series.flatMap((item) => item.points.map((point) => point.value)),
  );
  const yMin = axis.min;
  const yMax = axis.max;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const x = (week: number) =>
    padding.left +
    (weeks.length === 1
      ? chartWidth / 2
      : ((week - weeks[0]) / (weeks.at(-1)! - weeks[0])) * chartWidth);
  const y = (value: number) =>
    padding.top + ((yMax - value) / (yMax - yMin)) * chartHeight;
  const yTicks = axis.ticks;

  useEffect(() => {
    const container = scrollContainer.current;
    if (!container) {
      return;
    }
    container.scrollTo({ left: container.scrollWidth, behavior: "instant" });
  }, [metric, weeks.length]);

  return (
    <div
      ref={scrollContainer}
      className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label={`${metric === "rating" ? "Average rating" : "Stock price"} trends by week`}
      >
        <defs>
          <linearGradient id="chartFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8251EE" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#8251EE" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight}
          rx="18"
          fill="url(#chartFade)"
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

        {visible.map(({ player, points: seriesPoints }) => {
          const points = seriesPoints.map((point) => ({
            x: x(point.week),
            y: y(point.value),
            value: point.value,
            week: point.week,
          }));
          const path = points
            .map(
              (point, index) =>
                `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
            )
            .join(" ");
          if (points.length === 0) {
            return null;
          }
          const color = playerColor(player.player_id, players);
          const focused = focusedPlayerId === player.player_id;

          return (
            <g
              key={`${metric}-${player.player_id}`}
              opacity={focused ? 1 : 0.72}
              className="cursor-pointer"
              onClick={() => onFocusPlayer(player.player_id)}
            >
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={focused ? 5 : 3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((point) => (
                <circle
                  key={point.week}
                  cx={point.x}
                  cy={point.y}
                  r={focused ? 7 : 5}
                  fill={
                    player.eviction_week === point.week ? "#FB7185" : "#121218"
                  }
                  stroke={
                    player.eviction_week === point.week ? "#FB7185" : color
                  }
                  strokeWidth="3"
                >
                  <title>
                    {player.nickname || player.first_name}, week {point.week}:{" "}
                    {metric === "price"
                      ? `$${point.value.toFixed(2)}`
                      : point.value.toFixed(2)}
                    {player.eviction_week === point.week ? " (evicted)" : ""}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
