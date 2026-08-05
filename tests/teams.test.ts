import { describe, expect, it } from "vitest";
import dataset from "../data/processed/bb28/dataset.json";
import { DRAFT_TEAMS } from "../src/teams";

describe("draft team configuration", () => {
  it("defines five uniquely identified teams in display order", () => {
    expect(DRAFT_TEAMS.map((team) => team.id)).toEqual([
      "daria",
      "mckenna",
      "rachel",
      "cecelia",
      "rhetta",
    ]);
    expect(new Set(DRAFT_TEAMS.map((team) => team.id)).size).toBe(5);
  });

  it("assigns all 17 slugs exactly once with the intended roster sizes", () => {
    const slugs = DRAFT_TEAMS.flatMap((team) => team.playerSlugs);

    expect(DRAFT_TEAMS.map((team) => team.playerSlugs.length)).toEqual([
      4, 4, 4, 4, 1,
    ]);
    expect(slugs).toHaveLength(17);
    expect(new Set(slugs).size).toBe(17);
  });

  it("keeps Yash as Rhetta's one-player roster", () => {
    expect(DRAFT_TEAMS.find((team) => team.id === "rhetta")).toEqual({
      id: "rhetta",
      name: "Rhetta",
      playerSlugs: ["yash"],
    });
  });

  it("keeps every player on the intended draft roster", () => {
    expect(DRAFT_TEAMS.map(({ name, playerSlugs }) => ({
      name,
      playerSlugs,
    }))).toEqual([
      { name: "Daria", playerSlugs: ["dee", "melody", "taylor", "lyric"] },
      {
        name: "McKenna",
        playerSlugs: ["barrett", "latrice", "haley", "kamu"],
      },
      {
        name: "Rachel",
        playerSlugs: ["devens", "angela", "chuk", "ashley"],
      },
      {
        name: "Cecelia",
        playerSlugs: ["jason", "drew", "mallory", "rome"],
      },
      { name: "Rhetta", playerSlugs: ["yash"] },
    ]);
  });

  it("resolves every configured slug against the committed BB28 dataset", () => {
    const configured = DRAFT_TEAMS.flatMap((team) => team.playerSlugs);
    const available = new Set(dataset.players.map((player) => player.slug));

    expect(configured.filter((slug) => !available.has(slug))).toEqual([]);
    expect(configured.every((slug) => available.has(slug))).toBe(true);
  });
});
