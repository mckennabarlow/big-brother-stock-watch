// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TeamMetricChart } from "../../src/components/TeamMetricChart";
import type {
  Metric,
  Player,
  StockWatchDataset,
  WeeklySummary,
} from "../../src/types";

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(cleanup);

const alpha: Player = {
  season: "test",
  player_id: 1,
  first_name: "Alpha",
  last_name: "Player",
  nickname: "ALPHA",
  slug: "alpha",
  status: "active",
  eviction_week: null,
  image_url: "",
};
const row: WeeklySummary = {
  season: "test",
  week: 1,
  player_id: 1,
  player_slug: "alpha",
  player_name: "ALPHA",
  average_rating: "7.00",
  rounded_rating: 7,
  rating_count: 4,
  price: "11.00",
};
const dataset: StockWatchDataset = {
  metadata: {
    id: 1,
    name: "Test",
    slug: "test",
    status: "open",
    current_week: 1,
    closes_at: null,
    source: "fixture",
    extracted_at: "2026-01-01T00:00:00.000Z",
  },
  players: [alpha],
  ratings: [],
  prices: [],
  summaries: [row],
};
const teams = [
  { id: "one", name: "Team One", players: [alpha] },
  { id: "two", name: "Team Two", players: [] },
];

function renderChart(
  metric: Metric,
  onSelectTeam = vi.fn(),
  events: { week: number; type: "hoh"; player_slug: string }[] = [],
) {
  const result = render(
    <TeamMetricChart
      dataset={dataset}
      teams={teams}
      weeks={[1]}
      metric={metric}
      events={events}
      selectedTeamId="one"
      onSelectTeam={onSelectTeam}
    />,
  );
  return { ...result, onSelectTeam };
}

describe("TeamMetricChart", () => {
  it("exposes selected state and reports team button clicks", () => {
    const { onSelectTeam } = renderChart("rating");
    const selected = screen.getByRole("button", { name: "Team One" });
    const other = screen.getByRole("button", { name: "Team Two" });

    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(other).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(other);

    expect(onSelectTeam).toHaveBeenCalledOnce();
    expect(onSelectTeam).toHaveBeenCalledWith("two");
  });

  it.each([
    [
      "rating",
      "Team ratings by week",
      "Team ratings over time",
      "Team One, week 1: 7.00",
    ],
    [
      "price",
      "Team stock prices by week",
      "Team stock value over time",
      "Team One, week 1: $11.00",
    ],
  ] satisfies [Metric, string, string, string][])(
    "exposes its %s chart through a stable accessible name",
    (metric, name, heading, pointLabel) => {
      renderChart(metric);

      expect(screen.getByRole("img", { name })).toHaveAccessibleName(name);
      expect(screen.getByRole("heading", { name: heading }))
        .toBeInTheDocument();
      expect(screen.getByText(pointLabel)).toBeInTheDocument();
    },
  );

  it("formats point values and reports a chart-series click", () => {
    const { onSelectTeam } = renderChart("price");
    const point = screen.getByText("Team One, week 1: $11.00");

    fireEvent.click(point);

    expect(onSelectTeam).toHaveBeenCalledOnce();
    expect(onSelectTeam).toHaveBeenCalledWith("one");
  });

  it("marks the correct team and week when a rostered player wins HOH", () => {
    const { container } = renderChart("rating", vi.fn(), [
      { week: 1, type: "hoh", player_slug: "alpha" },
    ]);

    expect(
      screen.getByText("Team One, week 1: 7.00; HOH: ALPHA"),
    ).toBeInTheDocument();
    expect(container.querySelector('path[fill="#fbbf24"]')).not.toBeNull();
  });
});
