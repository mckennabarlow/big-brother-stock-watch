import { describe, expect, it } from "vitest";
import dataset from "../data/processed/bb28/dataset.json";
import {
  eventPlayer,
  hohEventForWeek,
  seasonEvents,
} from "../src/events";
import { DRAFT_TEAMS } from "../src/teams";
import type { Player, WeeklyEvent } from "../src/types";

const players = dataset.players as Player[];

describe("weekly events", () => {
  it("records the completed BB28 HOH winners in week order", () => {
    expect(seasonEvents("bb28")).toEqual([
      { week: 1, type: "hoh", player_slug: "dee" },
      { week: 2, type: "hoh", player_slug: "devens" },
      { week: 3, type: "hoh", player_slug: "kamu" },
      { week: 4, type: "hoh", player_slug: "haley" },
      { week: 5, type: "hoh", player_slug: "latrice" },
      { week: 9, type: "hoh", player_slug: "barrett" },
    ]);
  });

  it("resolves each HOH winner to the intended draft owner", () => {
    const ownership = seasonEvents("bb28").map((event) => ({
      week: event.week,
      team: DRAFT_TEAMS.find((team) =>
        team.playerSlugs.includes(event.player_slug),
      )?.name,
    }));

    expect(ownership).toEqual([
      { week: 1, team: "Daria" },
      { week: 2, team: "Rachel" },
      { week: 3, team: "McKenna" },
      { week: 4, team: "McKenna" },
      { week: 5, team: "McKenna" },
      { week: 9, team: "McKenna" },
    ]);
  });

  it("finds the selected week's HOH and resolves the player", () => {
    const event = hohEventForWeek(seasonEvents("bb28"), 2);

    expect(event).toEqual({
      week: 2,
      type: "hoh",
      player_slug: "devens",
    });
    expect(eventPlayer(event, players)?.slug).toBe("devens");
  });

  it("returns null for missing weeks and invalid player slugs", () => {
    const invalidEvent: WeeklyEvent = {
      week: 5,
      type: "hoh",
      player_slug: "not-a-houseguest",
    };

    expect(hohEventForWeek(seasonEvents("bb28"), 99)).toBeNull();
    expect(eventPlayer(invalidEvent, players)).toBeNull();
    expect(seasonEvents("unknown")).toEqual([]);
  });
});
