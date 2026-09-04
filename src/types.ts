export interface SeasonMetadata {
  id: number;
  name: string;
  slug: string;
  status: string;
  current_week: number;
  closes_at: string | null;
  source: string;
  extracted_at: string;
}

export interface Player {
  season: string;
  player_id: number;
  first_name: string;
  last_name: string;
  nickname: string;
  slug: string;
  status: string;
  eviction_week: number | null;
  image_url: string;
}

export interface Rating {
  season: string;
  week: number;
  player_id: number;
  player_slug: string;
  player_name: string;
  rater_id: number;
  rater_name: string;
  rater_role: string;
  rating: number;
  recorded_at: string | null;
}

export interface Price {
  season: string;
  week: number;
  player_id: number;
  player_slug: string;
  player_name: string;
  price: string;
  recorded_at: string;
}

export interface WeeklySummary {
  season: string;
  week: number;
  player_id: number;
  player_slug: string;
  player_name: string;
  average_rating: string;
  rounded_rating: number;
  rating_count: number;
  price: string;
}

export interface StockWatchDataset {
  metadata: SeasonMetadata;
  players: Player[];
  ratings: Rating[];
  prices: Price[];
  summaries: WeeklySummary[];
}

export interface WeeklyEvent {
  week: number;
  type: "hoh";
  player_slug: string;
}

export type Metric = "rating" | "price";

export type TeamScoreMode = "total" | "normalized";
