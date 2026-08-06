import rawEvents from "../config/weekly-events.json";
import type { Player, WeeklyEvent } from "./types";

const eventsBySeason = rawEvents as Record<string, WeeklyEvent[]>;

export function seasonEvents(season: string): WeeklyEvent[] {
  return eventsBySeason[season] ?? [];
}

export function hohEventForWeek(
  events: WeeklyEvent[],
  week: number,
): WeeklyEvent | null {
  return (
    events.find((event) => event.type === "hoh" && event.week === week) ?? null
  );
}

export function eventPlayer(
  event: WeeklyEvent | null,
  players: Player[],
): Player | null {
  if (!event) {
    return null;
  }
  return (
    players.find((player) => player.slug === event.player_slug) ?? null
  );
}
