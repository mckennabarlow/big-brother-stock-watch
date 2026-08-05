// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SeasonChart } from "../../src/components/SeasonChart";
import type { Metric, Player, WeeklySummary } from "../../src/types";

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
const bravo: Player = {
  ...alpha,
  player_id: 2,
  first_name: "Bravo",
  nickname: "BRAVO",
  slug: "bravo",
  eviction_week: 1,
  status: "evicted",
};

function summary(
  subject: Player,
  week: number,
  rating: string,
  price: string,
): WeeklySummary {
  return {
    season: "test",
    week,
    player_id: subject.player_id,
    player_slug: subject.slug,
    player_name: subject.nickname,
    average_rating: rating,
    rounded_rating: Math.round(Number(rating)),
    rating_count: 4,
    price,
  };
}

const summaries = [
  summary(alpha, 1, "7.00", "11.00"),
  summary(bravo, 2, "9.00", "13.00"),
];

function renderChart(
  metric: Metric,
  onFocusPlayer = vi.fn(),
  chartSummaries = summaries,
  visiblePlayerIds = new Set([1, 2]),
) {
  render(
    <SeasonChart
      metric={metric}
      players={[alpha, bravo]}
      summaries={chartSummaries}
      visiblePlayerIds={visiblePlayerIds}
      focusedPlayerId={1}
      onFocusPlayer={onFocusPlayer}
    />,
  );
  return onFocusPlayer;
}

describe("SeasonChart", () => {
  it.each([
    ["rating", "Average rating trends by week", "ALPHA, week 1: 7.00"],
    ["price", "Stock price trends by week", "ALPHA, week 1: $11.00"],
  ] satisfies [Metric, string, string][])(
    "exposes its %s chart through a stable accessible name",
    (metric, name, pointLabel) => {
      renderChart(metric);

      const chart = screen.getByRole("img", { name });
      expect(chart).toHaveAccessibleName(name);
      expect(chart).toHaveTextContent(pointLabel);
    },
  );

  it("does not render a player without eligible metric points", () => {
    renderChart("rating");

    expect(screen.queryByText(/BRAVO, week/)).not.toBeInTheDocument();
    expect(screen.getByText("ALPHA, week 1: 7.00")).toBeInTheDocument();
  });

  it("reports the player ID when a rendered series is clicked", () => {
    const onFocusPlayer = renderChart("rating");

    fireEvent.click(screen.getByText("ALPHA, week 1: 7.00"));

    expect(onFocusPlayer).toHaveBeenCalledOnce();
    expect(onFocusPlayer).toHaveBeenCalledWith(1);
  });

  it("does not render an eligible series that is not selected as visible", () => {
    renderChart(
      "rating",
      vi.fn(),
      [summary(alpha, 1, "7.00", "11.00"), summary(bravo, 1, "8.00", "12.00")],
      new Set([1]),
    );

    expect(screen.getByText("ALPHA, week 1: 7.00")).toBeInTheDocument();
    expect(screen.queryByText("BRAVO, week 1: 8.00 (evicted)"))
      .not.toBeInTheDocument();
  });

  it("formats price points and marks an eviction-week point", () => {
    const pointLabel = "BRAVO, week 1: $12.00 (evicted)";
    renderChart(
      "price",
      vi.fn(),
      [summary(bravo, 1, "8.00", "12.00")],
      new Set([2]),
    );

    expect(screen.getByText(pointLabel)).toHaveTextContent(pointLabel);
  });
});
