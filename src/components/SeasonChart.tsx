import { useEffect, useRef } from "react";
import type { Metric, Player, WeeklySummary } from "../types";

const COLORS = [
  "#A78BFA",
  "#38BDF8",
  "#34D399",
  "#FBBF24",
  "#FB7185",
  "#F472B6",
  "#22D3EE",
  "#C084FC",
  "#A3E635",
  "#FB923C",
  "#818CF8",
  "#2DD4BF",
  "#E879F9",
  "#FACC15",
  "#60A5FA",
];

export function playerColor(playerId: number, players: Player[]) {
  const index = players.findIndex((player) => player.player_id === playerId);
  return COLORS[(index < 0 ? playerId : index) % COLORS.length];
}

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
  const weeks = [...new Set(summaries.map((row) => row.week))].sort(
    (left, right) => left - right,
  );
  const visible = players.filter((player) =>
    visiblePlayerIds.has(player.player_id),
  );
  const values = summaries
    .filter((row) => metric === "rating" || row.price !== "")
    .map((row) =>
      metric === "rating" ? Number(row.average_rating) : Number(row.price),
    );
  const yMin = metric === "rating" ? 1 : 0;
  const yMax =
    metric === "rating"
      ? 10
      : Math.max(10, Math.ceil(Math.max(...values, 10) / 2) * 2);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const x = (week: number) =>
    padding.left +
    (weeks.length === 1
      ? chartWidth / 2
      : ((week - weeks[0]) / (weeks.at(-1)! - weeks[0])) * chartWidth);
  const y = (value: number) =>
    padding.top + ((yMax - value) / (yMax - yMin)) * chartHeight;
  const tickStep = metric === "rating" ? 1 : 2;
  const yTicks = Array.from(
    { length: Math.floor((yMax - yMin) / tickStep) + 1 },
    (_, index) => yMin + index * tickStep,
  );

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

        {visible.map((player) => {
          const rows = summaries
            .filter(
              (row) =>
                row.player_id === player.player_id &&
                (!player.eviction_week ||
                  row.week <= player.eviction_week) &&
                (metric === "rating" || row.price !== ""),
            )
            .sort((left, right) => left.week - right.week);
          const points = rows.map((row) => ({
            x: x(row.week),
            y: y(
              metric === "rating"
                ? Number(row.average_rating)
                : Number(row.price),
            ),
            value:
              metric === "rating"
                ? Number(row.average_rating)
                : Number(row.price),
            week: row.week,
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
