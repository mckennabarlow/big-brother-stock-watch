export interface DraftTeam {
  id: string;
  name: string;
  playerSlugs: string[];
}

export const DRAFT_TEAMS: DraftTeam[] = [
  {
    id: "daria",
    name: "Daria",
    playerSlugs: ["dee", "melody", "taylor", "lyric"],
  },
  {
    id: "mckenna",
    name: "McKenna",
    playerSlugs: ["barrett", "latrice", "haley", "kamu"],
  },
  {
    id: "rachel",
    name: "Rachel",
    playerSlugs: ["devens", "angela", "chuk", "ashley"],
  },
  {
    id: "cecelia",
    name: "Cecelia",
    playerSlugs: ["jason", "drew", "mallory", "rome"],
  },
  {
    id: "rhetta",
    name: "Rhetta",
    playerSlugs: ["yash"],
  },
];
