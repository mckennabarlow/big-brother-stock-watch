import { useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import rawDataset from "../data/processed/bb28/dataset.json";
import { PlayerAvatar } from "./components/PlayerAvatar";
import { SeasonChart, playerColor } from "./components/SeasonChart";
import type {
  Metric,
  Player,
  StockWatchDataset,
  WeeklySummary,
} from "./types";

const dataset = rawDataset as StockWatchDataset;

function playerName(player: Player) {
  return player.nickname || player.first_name;
}

function isEvicted(player: Player) {
  return player.status !== "active" || player.eviction_week !== null;
}

function metricValue(row: WeeklySummary, metric: Metric) {
  return metric === "rating" ? Number(row.average_rating) : Number(row.price);
}

function hasMetricValue(row: WeeklySummary, metric: Metric) {
  return metric === "rating" || row.price !== "";
}

function formatMetric(value: number, metric: Metric) {
  return metric === "rating" ? value.toFixed(2) : `$${value.toFixed(2)}`;
}

function movement(
  summaries: WeeklySummary[],
  playerId: number,
  week: number,
  metric: Metric,
) {
  const current = summaries.find(
    (row) => row.player_id === playerId && row.week === week,
  );
  const previous = summaries.find(
    (row) => row.player_id === playerId && row.week === week - 1,
  );
  if (!current || !previous) {
    return null;
  }
  if (
    !hasMetricValue(current, metric) ||
    !hasMetricValue(previous, metric)
  ) {
    return null;
  }
  return metricValue(current, metric) - metricValue(previous, metric);
}

export default function App() {
  const weeks = useMemo(
    () =>
      [...new Set(dataset.summaries.map((row) => row.week))].sort(
        (left, right) => left - right,
      ),
    [],
  );
  const latestWeek = weeks.at(-1) ?? 1;
  const latestRanking = useMemo(
    () =>
      dataset.summaries
        .filter((row) => row.week === latestWeek)
        .sort(
          (left, right) =>
            Number(right.average_rating) - Number(left.average_rating),
        ),
    [latestWeek],
  );
  const defaultPlayerIds = useMemo(
    () => new Set(latestRanking.slice(0, 6).map((row) => row.player_id)),
    [latestRanking],
  );

  const [metric, setMetric] = useState<Metric>("rating");
  const [selectedWeek, setSelectedWeek] = useState(latestWeek);
  const [visiblePlayerIds, setVisiblePlayerIds] =
    useState<Set<number>>(defaultPlayerIds);
  const [focusedPlayerId, setFocusedPlayerId] = useState(
    latestRanking[0]?.player_id ?? dataset.players[0].player_id,
  );

  const weekRanking = useMemo(
    () =>
      dataset.summaries
        .filter(
          (row) =>
            row.week === selectedWeek && hasMetricValue(row, metric),
        )
        .sort(
          (left, right) =>
            metricValue(right, metric) - metricValue(left, metric),
        ),
    [metric, selectedWeek],
  );
  const focusedPlayer = dataset.players.find(
    (player) => player.player_id === focusedPlayerId,
  )!;
  const focusedSummary = dataset.summaries.find(
    (row) =>
      row.player_id === focusedPlayerId && row.week === selectedWeek,
  );
  const focusedRatings = dataset.ratings
    .filter(
      (row) =>
        row.player_id === focusedPlayerId && row.week === selectedWeek,
    )
    .sort((left, right) => left.rater_id - right.rater_id);
  const topPlayer = weekRanking[0];
  const biggestMover = weekRanking
    .map((row) => ({
      row,
      change: movement(
        dataset.summaries,
        row.player_id,
        selectedWeek,
        metric,
      ),
    }))
    .filter(
      (item): item is { row: WeeklySummary; change: number } =>
        item.change !== null,
    )
    .sort((left, right) => right.change - left.change)[0];

  function togglePlayer(playerId: number) {
    setVisiblePlayerIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) {
        if (next.size > 1) {
          next.delete(playerId);
        }
      } else {
        next.add(playerId);
      }
      return next;
    });
    setFocusedPlayerId(playerId);
  }

  function focusPlayer(playerId: number) {
    setFocusedPlayerId(playerId);
    setVisiblePlayerIds((current) => new Set(current).add(playerId));
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-bg1 text-text-primary">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-32 top-12 hidden h-96 w-96 rounded-full bg-brand/15 blur-[120px] md:block" />
        <div className="absolute -right-24 top-80 hidden h-80 w-80 rounded-full bg-cyan-500/10 blur-[120px] md:block" />
      </div>

      <main className="relative mx-auto max-w-[1500px] px-4 py-6 pb-safe-bottom sm:px-6 lg:px-10 lg:py-10">
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-brand/30 bg-brand/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-light">
                RHAP Roundtable
              </span>
              <span className="text-sm text-text-muted">
                Updated{" "}
                {new Date(dataset.metadata.extracted_at).toLocaleDateString()}
              </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Big Brother{" "}
              <span className="bg-gradient-to-r from-brand-light to-cyan-300 bg-clip-text text-transparent">
                Stock Watch
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-base text-text-secondary">
              Follow every houseguest&apos;s weekly rating, momentum, and market
              value throughout {dataset.metadata.name}.
            </p>
          </div>

          <div
            className="grid w-full grid-cols-2 rounded-xl border border-border bg-neutral-bg2/80 p-1 sm:inline-flex sm:w-auto"
            role="group"
            aria-label="Chart metric"
          >
            {(["rating", "price"] as Metric[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMetric(option)}
                className={clsx(
                  "min-h-touch rounded-lg px-5 text-sm font-semibold transition-colors",
                  metric === option
                    ? "bg-brand text-white shadow-glow"
                    : "text-text-secondary hover:bg-neutral-bg4 hover:text-white",
                )}
              >
                {option === "rating" ? "Ratings" : "Stock price"}
              </button>
            ))}
          </div>
        </header>

        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <StatCard
            label="Viewing"
            value={`Week ${selectedWeek}`}
            detail={`${dataset.players.length} houseguests tracked`}
          />
          <StatCard
            label={metric === "rating" ? "Week leader" : "Most valuable"}
            value={topPlayer?.player_name ?? "—"}
            detail={
              topPlayer
                ? formatMetric(metricValue(topPlayer, metric), metric)
                : "No data"
            }
            accent
          />
          <StatCard
            label="Biggest rise"
            value={biggestMover?.row.player_name ?? "First week"}
            detail={
              biggestMover
                ? `+${formatMetric(biggestMover.change, metric)}`
                : "Movement starts in week 2"
            }
          />
        </section>

        <section className="glass-card mb-6 overflow-hidden p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Season trajectory</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Swipe the chart on mobile. Tap a line or leaderboard card for
                details.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <ControlButton
                onClick={() =>
                  setVisiblePlayerIds(
                    new Set(dataset.players.map((player) => player.player_id)),
                  )
                }
              >
                Show all
              </ControlButton>
              <ControlButton
                onClick={() => setVisiblePlayerIds(new Set(defaultPlayerIds))}
              >
                Top six
              </ControlButton>
            </div>
          </div>

          <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {dataset.players.map((player) => {
              const active = visiblePlayerIds.has(player.player_id);
              const evicted = isEvicted(player);
              const color = playerColor(player.player_id, dataset.players);
              return (
                <button
                  type="button"
                  key={player.player_id}
                  onClick={() => togglePlayer(player.player_id)}
                  aria-pressed={active}
                  className={clsx(
                    "flex min-h-touch shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? evicted
                        ? "border-status-error/70 bg-status-error/10 text-white"
                        : "border-border-strong bg-neutral-bg4 text-white"
                      : "border-border-subtle bg-neutral-bg2/60 text-text-muted",
                  )}
                >
                  <PlayerAvatar
                    player={player}
                    className="h-7 w-7"
                    ringColor={
                      evicted ? "#FB7185" : active ? color : undefined
                    }
                    evicted={evicted}
                    preserveColor
                  />
                  {playerName(player)}
                </button>
              );
            })}
          </div>

          <SeasonChart
            metric={metric}
            players={dataset.players}
            summaries={dataset.summaries}
            visiblePlayerIds={visiblePlayerIds}
            focusedPlayerId={focusedPlayerId}
            onFocusPlayer={focusPlayer}
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.75fr)]">
          <section className="glass-card p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Weekly leaderboard</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Ranked by{" "}
                  {metric === "rating" ? "average score" : "stock price"}.
                </p>
              </div>
              <div className="flex gap-1 overflow-x-auto rounded-xl bg-neutral-bg2 p-1">
                {weeks.map((week) => (
                  <button
                    type="button"
                    key={week}
                    onClick={() => setSelectedWeek(week)}
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

            <div
              key={`${metric}-${selectedWeek}`}
              className="grid gap-3 md:grid-cols-2"
            >
              {weekRanking.map((row, index) => {
                const player = dataset.players.find(
                  (item) => item.player_id === row.player_id,
                )!;
                const change = movement(
                  dataset.summaries,
                  row.player_id,
                  selectedWeek,
                  metric,
                );
                const color = playerColor(player.player_id, dataset.players);
                const evicted = isEvicted(player);
                return (
                  <button
                    type="button"
                    key={row.player_id}
                    onClick={() => focusPlayer(row.player_id)}
                    className={clsx(
                      "flex min-h-[76px] items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      focusedPlayerId === row.player_id
                        ? evicted
                          ? "border-status-error/60 bg-status-error/10"
                          : "border-brand/50 bg-brand/10"
                        : "border-border-subtle bg-neutral-bg2/55 hover:border-border",
                    )}
                  >
                    <span className="w-6 text-center text-sm font-bold text-text-muted">
                      {index + 1}
                    </span>
                    <PlayerAvatar
                      player={player}
                      className="h-12 w-12"
                      ringColor={evicted ? "#FB7185" : color}
                      evicted={evicted}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {playerName(player)}
                      </span>
                      <span
                        className={clsx(
                          "mt-1 block text-xs font-semibold",
                          change === null || change === 0
                            ? "text-text-muted"
                            : change > 0
                              ? "text-status-success"
                              : "text-status-error",
                        )}
                      >
                        {change === null
                          ? "Opening week"
                          : change === 0
                            ? "No change"
                            : `${change > 0 ? "▲" : "▼"} ${formatMetric(Math.abs(change), metric)}`}
                      </span>
                    </span>
                    <span className="text-lg font-bold" style={{ color }}>
                      {formatMetric(metricValue(row, metric), metric)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside
            key={`${focusedPlayerId}-${selectedWeek}`}
            className={clsx(
              "glass-card self-start overflow-hidden",
              isEvicted(focusedPlayer) && "border-status-error/50",
            )}
          >
            <div className="relative h-52 overflow-hidden border-b border-border-subtle bg-neutral-bg3">
              <div
                className="absolute inset-0 opacity-25 blur-3xl"
                style={{
                  background: playerColor(
                    focusedPlayer.player_id,
                    dataset.players,
                  ),
                }}
              />
              <PlayerAvatar
                player={focusedPlayer}
                className="absolute bottom-0 left-1/2 h-48 w-48 -translate-x-1/2 bg-transparent"
                square
                evicted={isEvicted(focusedPlayer)}
              />
              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-neutral-bg2 to-transparent" />
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-light">
                    {isEvicted(focusedPlayer)
                      ? `Evicted after week ${focusedPlayer.eviction_week ?? "—"}`
                      : `Week ${selectedWeek} breakdown`}
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">
                    {playerName(focusedPlayer)}
                  </h2>
                  <p className="text-sm text-text-secondary">
                    {focusedPlayer.first_name} {focusedPlayer.last_name}
                  </p>
                </div>
                <div className="rounded-xl bg-brand/15 px-3 py-2 text-center">
                  <div className="text-2xl font-bold text-brand-light">
                    {focusedSummary
                      ? Number(focusedSummary.average_rating).toFixed(2)
                      : "—"}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    Average
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {focusedRatings.map((rating) => (
                  <div key={rating.rater_id}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="text-text-secondary">
                        {rating.rater_name}
                      </span>
                      <span className="font-bold">{rating.rating}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-bg4">
                      <div
                        style={{ width: `${rating.rating * 10}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-brand to-cyan-400"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border-subtle pt-5">
                <DetailStat
                  label="Stock price"
                  value={
                    focusedSummary?.price
                      ? `$${focusedSummary.price}`
                      : "Unavailable"
                  }
                />
                <DetailStat
                  label="Weekly move"
                  value={(() => {
                    const change = movement(
                      dataset.summaries,
                      focusedPlayerId,
                      selectedWeek,
                      metric,
                    );
                    return change === null
                      ? "Opening"
                      : `${change >= 0 ? "+" : ""}${formatMetric(change, metric)}`;
                  })()}
                />
              </div>
            </div>
          </aside>
        </div>

        <footer className="mt-8 flex flex-col gap-2 border-t border-border-subtle py-6 text-xs text-text-muted sm:flex-row sm:justify-between">
          <p>
            Ratings and prices sourced from{" "}
            <a
              className="text-text-secondary underline decoration-border-strong underline-offset-4 hover:text-white"
              href="https://realitystockwatch.com/trades"
              target="_blank"
              rel="noreferrer"
            >
              Reality Stock Watch
            </a>
            .
          </p>
          <p>Unofficial fan visualization. Not affiliated with CBS or RHAP.</p>
        </footer>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={clsx(
        "glass-card p-5",
        accent && "border-brand/30 bg-brand/10 shadow-glow",
      )}
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-text-secondary">{detail}</p>
    </div>
  );
}

function ControlButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-touch rounded-lg border border-border bg-neutral-bg3 px-4 text-sm font-semibold text-text-secondary transition-colors hover:bg-neutral-bg4 hover:text-white"
    >
      {children}
    </button>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-bg3 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
