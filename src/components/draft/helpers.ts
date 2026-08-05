import type { Player } from "../../types";

export function playerName(player: Player) {
  return player.nickname || player.first_name;
}

export function isEvicted(player: Player) {
  return player.status !== "active" || player.eviction_week !== null;
}

export function ordinal(rank: number) {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}
