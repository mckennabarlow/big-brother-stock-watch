import { join, resolve } from "node:path";

export const DEFAULT_URL = "https://realitystockwatch.com/trades";

const RATER_ROLES = new Map([
  [1, ["Audience", "audience"]],
  [4, ["Taran Armstrong", "host"]],
  [9, ["Melissa Deni", "host"]],
]);

export function parseArgs(argv, projectRoot = resolve(".")) {
  const result = {
    url: DEFAULT_URL,
    input: null,
    outputRoot: join(projectRoot, "data"),
    maxMissingPlayers: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--url" && value) {
      result.url = value;
      index += 1;
    } else if (argument === "--input" && value) {
      result.input = resolve(value);
      index += 1;
    } else if (argument === "--output-root" && value) {
      result.outputRoot = resolve(value);
      index += 1;
    } else if (argument === "--allow-player-drop" && value) {
      const count = Number(value);
      if (!Number.isInteger(count) || count < 0) {
        throw new Error("--allow-player-drop must be a non-negative integer");
      }
      result.maxMissingPlayers = count;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  if (result.input && argv.includes("--url")) {
    throw new Error("--input and --url cannot be used together");
  }
  return result;
}

export function decodeHtmlEntities(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

export function extractSeason(page) {
  const match = page.match(
    /<guest-trade-panel\b[^>]*\s:season=(["'])(?<data>.*?)\1/s,
  );
  if (!match?.groups?.data) {
    throw new Error("Could not find the guest-trade-panel season attribute");
  }
  return JSON.parse(decodeHtmlEntities(match.groups.data));
}

export function identifyRater(userId, seasonSlug, week, overrides = {}) {
  if (RATER_ROLES.has(userId)) {
    return RATER_ROLES.get(userId);
  }
  const override = overrides[seasonSlug]?.[String(week)]?.[String(userId)];
  return [override ?? `Guest (user ${userId})`, "guest"];
}

export function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function finiteNumber(value, label) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    throw new Error(`${label} must be a finite number`);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a finite number`);
  }
  return number;
}

const playerName = (player) => player.nickname || player.first_name;
const ratingKey = (row) => `${row.week}:${row.player_id}:${row.rater_id}`;
const playerWeekKey = (row) => `${row.week}:${row.player_id}`;

function sortPlayers(rows) {
  return rows.sort(
    (left, right) =>
      playerName(left).localeCompare(playerName(right), "en", {
        sensitivity: "base",
      }) || left.player_id - right.player_id,
  );
}

function sortRatings(rows) {
  return rows.sort(
    (left, right) =>
      left.week - right.week ||
      left.player_name.localeCompare(right.player_name) ||
      left.player_id - right.player_id ||
      left.rater_id - right.rater_id,
  );
}

function sortPlayerWeeks(rows) {
  return rows.sort(
    (left, right) =>
      left.week - right.week ||
      left.player_name.localeCompare(right.player_name) ||
      left.player_id - right.player_id,
  );
}

export function normalize(
  season,
  source,
  extractedAt,
  overrides = {},
) {
  const seasonSlug = season.short_name;
  const players = [];
  const ratings = [];
  const prices = [];

  for (const sourcePlayer of season.houseguests ?? []) {
    const player = {
      season: seasonSlug,
      player_id: sourcePlayer.id,
      first_name: sourcePlayer.first_name,
      last_name: sourcePlayer.last_name ?? "",
      nickname: sourcePlayer.nickname ?? "",
      slug: sourcePlayer.slug,
      status: sourcePlayer.status,
      eviction_week: null,
      image_url: new URL(sourcePlayer.image_url, DEFAULT_URL).href,
    };
    players.push(player);

    for (const item of sourcePlayer.ratings ?? []) {
      const rating = finiteNumber(
        item.rating,
        `Rating for player ${sourcePlayer.id}, week ${item.week}`,
      );
      const [raterName, raterRole] = identifyRater(
        item.user_id,
        seasonSlug,
        item.week,
        overrides,
      );
      ratings.push({
        season: seasonSlug,
        week: item.week,
        player_id: sourcePlayer.id,
        player_slug: sourcePlayer.slug,
        player_name: playerName(sourcePlayer),
        rater_id: item.user_id,
        rater_name: raterName,
        rater_role: raterRole,
        rating,
        recorded_at: item.created_at,
      });
    }

    for (const item of sourcePlayer.prices ?? []) {
      const price = finiteNumber(
        item.price,
        `Price for player ${sourcePlayer.id}, week ${item.week}`,
      );
      prices.push({
        season: seasonSlug,
        week: item.week,
        player_id: sourcePlayer.id,
        player_slug: sourcePlayer.slug,
        player_name: playerName(sourcePlayer),
        price: price.toFixed(2),
        recorded_at: item.created_at,
      });
    }
  }

  sortPlayers(players);
  sortRatings(ratings);
  sortPlayerWeeks(prices);

  const groupedRatings = new Map();
  for (const row of ratings) {
    const key = playerWeekKey(row);
    const values = groupedRatings.get(key) ?? [];
    values.push(row.rating);
    groupedRatings.set(key, values);
  }
  const priceLookup = new Map(prices.map((row) => [playerWeekKey(row), row.price]));
  const playerLookup = new Map(players.map((row) => [row.player_id, row]));

  const summaries = [...groupedRatings.entries()].map(([key, values]) => {
    const [week, playerId] = key.split(":").map(Number);
    const player = playerLookup.get(playerId);
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return {
      season: seasonSlug,
      week,
      player_id: playerId,
      player_slug: player.slug,
      player_name: playerName(player),
      average_rating: average.toFixed(2),
      rounded_rating: Math.round(average),
      rating_count: values.length,
      price: priceLookup.get(key) ?? "",
    };
  });
  sortPlayerWeeks(summaries);

  return {
    metadata: {
      id: season.id,
      name: season.name,
      slug: seasonSlug,
      status: season.status,
      current_week: season.current_week,
      closes_at: season.closes_at ?? null,
      source,
      extracted_at: extractedAt,
    },
    players,
    ratings,
    prices,
    summaries,
  };
}

export function mergeRows(currentRows, previousRows, keyFor) {
  const merged = new Map();
  for (const row of previousRows) {
    merged.set(keyFor(row), row);
  }
  for (const row of currentRows) {
    merged.set(keyFor(row), row);
  }
  return [...merged.values()];
}

export function applyHistoricalOverrides(
  data,
  historicalOverrides,
  raterOverrides = {},
) {
  const season = historicalOverrides[data.metadata.slug];
  if (!season) {
    return data;
  }

  const overrideRatings = [];
  const overrideSummaries = [];
  const overriddenPlayerWeeks = new Set();
  for (const historicalPlayer of season.players ?? []) {
    const player = {
      season: data.metadata.slug,
      player_id: historicalPlayer.player_id,
      first_name: historicalPlayer.first_name,
      last_name: historicalPlayer.last_name,
      nickname: historicalPlayer.nickname,
      slug: historicalPlayer.slug,
      status: historicalPlayer.status,
      eviction_week: historicalPlayer.eviction_week,
      image_url: historicalPlayer.image_url,
    };
    data.players = mergeRows(
      [player],
      data.players,
      (item) => String(item.player_id),
    );

    for (const weekly of historicalPlayer.weeks ?? []) {
      overriddenPlayerWeeks.add(`${weekly.week}:${player.player_id}`);
      const values = [];
      for (const [userIdText, rawRating] of Object.entries(weekly.ratings ?? {})) {
        const userId = Number(userIdText);
        const rating = finiteNumber(
          rawRating,
          `Historical rating for player ${player.player_id}, week ${weekly.week}`,
        );
        const [raterName, raterRole] = identifyRater(
          userId,
          data.metadata.slug,
          weekly.week,
          raterOverrides,
        );
        values.push(rating);
        overrideRatings.push({
          season: data.metadata.slug,
          week: weekly.week,
          player_id: player.player_id,
          player_slug: player.slug,
          player_name: playerName(player),
          rater_id: userId,
          rater_name: raterName,
          rater_role: raterRole,
          rating,
          recorded_at: null,
        });
      }

      if (values.length > 0) {
        const average =
          values.reduce((sum, value) => sum + value, 0) / values.length;
        overrideSummaries.push({
          season: data.metadata.slug,
          week: weekly.week,
          player_id: player.player_id,
          player_slug: player.slug,
          player_name: playerName(player),
          average_rating: average.toFixed(2),
          rounded_rating: Math.round(average),
          rating_count: values.length,
          price: weekly.price === null || weekly.price === undefined
            ? ""
            : weekly.price === ""
              ? ""
              : finiteNumber(weekly.price, "Historical price").toFixed(2),
        });
      }
    }
  }

  data.ratings = mergeRows(
    overrideRatings,
    data.ratings.filter(
      (row) => !overriddenPlayerWeeks.has(playerWeekKey(row)),
    ),
    ratingKey,
  );
  data.summaries = mergeRows(overrideSummaries, data.summaries, playerWeekKey);
  sortPlayers(data.players);
  sortRatings(data.ratings);
  sortPlayerWeeks(data.prices);
  sortPlayerWeeks(data.summaries);
  return data;
}

export function sourceCompletenessIssues(
  current,
  previous,
  maximumMissingPlayers = null,
) {
  if (!previous) {
    return [];
  }

  const currentPlayerIds = new Set(
    current.players.map((player) => player.player_id),
  );
  const previouslyActivePlayers = (previous.players ?? []).filter(
    (player) =>
      player.status === "active" && player.eviction_week === null,
  );
  const missingPlayers = previouslyActivePlayers.filter(
    (player) => !currentPlayerIds.has(player.player_id),
  );
  const allowedMissingPlayers =
    maximumMissingPlayers ??
    Math.max(2, Math.floor(previouslyActivePlayers.length * 0.25));

  if (missingPlayers.length <= allowedMissingPlayers) {
    return [];
  }

  return [
    {
      severity: "error",
      type: "implausible_player_drop",
      expected_maximum: allowedMissingPlayers,
      actual: missingPlayers.length,
      player_ids: missingPlayers.map((player) => player.player_id),
    },
  ];
}

export function preserveEvictedPlayers(current, previous) {
  if (!previous) {
    return current;
  }

  const currentPlayers = new Map(
    current.players.map((player) => [player.player_id, player]),
  );
  for (const previousPlayer of previous.players ?? []) {
    const currentPlayer = currentPlayers.get(previousPlayer.player_id);
    if (currentPlayer) {
      currentPlayer.eviction_week =
        currentPlayer.eviction_week ?? previousPlayer.eviction_week ?? null;
      continue;
    }

    const lastScoredWeek = Math.max(
      0,
      ...(previous.summaries ?? [])
        .filter((row) => row.player_id === previousPlayer.player_id)
        .map((row) => row.week),
    );
    current.players.push({
      ...previousPlayer,
      status: "evicted",
      eviction_week: previousPlayer.eviction_week ?? lastScoredWeek,
    });
  }

  current.ratings = mergeRows(
    current.ratings,
    previous.ratings ?? [],
    ratingKey,
  );
  current.prices = mergeRows(
    current.prices,
    previous.prices ?? [],
    playerWeekKey,
  );
  current.summaries = mergeRows(
    current.summaries,
    previous.summaries ?? [],
    playerWeekKey,
  );

  sortPlayers(current.players);
  sortRatings(current.ratings);
  sortPlayerWeeks(current.prices);
  sortPlayerWeeks(current.summaries);
  return current;
}

function issue(issues, type, details = {}, severity = "error") {
  issues.push({ severity, type, ...details });
}

function validWeek(value) {
  return Number.isInteger(value) && value > 0;
}

function numericValue(value) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

export function validate(data, initialIssues = []) {
  const issues = [...initialIssues];
  const playerIds = new Set();

  for (const player of data.players) {
    if (playerIds.has(player.player_id)) {
      issue(issues, "duplicate_player", { player_id: player.player_id });
    }
    playerIds.add(player.player_id);
    if (
      player.eviction_week !== null &&
      player.eviction_week !== 0 &&
      (!validWeek(player.eviction_week) ||
        (Number.isInteger(data.metadata.current_week) &&
          player.eviction_week > data.metadata.current_week))
    ) {
      issue(issues, "invalid_eviction_week", {
        player_id: player.player_id,
        eviction_week: player.eviction_week,
      });
    }
  }

  const seenRatings = new Set();
  const counts = new Map();
  const ratingGroups = new Map();
  for (const row of data.ratings) {
    const key = ratingKey(row);
    if (seenRatings.has(key)) {
      issue(issues, "duplicate_rating", {
        week: row.week,
        player_id: row.player_id,
        rater_id: row.rater_id,
      });
    }
    seenRatings.add(key);
    if (!playerIds.has(row.player_id)) {
      issue(issues, "orphan_rating", {
        week: row.week,
        player_id: row.player_id,
      });
    }
    if (!validWeek(row.week)) {
      issue(issues, "invalid_rating_week", {
        week: row.week,
        player_id: row.player_id,
      });
    }
    const rating = numericValue(row.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
      issue(issues, "rating_out_of_range", {
        week: row.week,
        player_id: row.player_id,
        rating: row.rating,
      });
    }
    const groupKey = playerWeekKey(row);
    counts.set(groupKey, (counts.get(groupKey) ?? 0) + 1);
    const values = ratingGroups.get(groupKey) ?? [];
    if (Number.isFinite(rating)) values.push(rating);
    ratingGroups.set(groupKey, values);
  }

  for (const [key, count] of counts) {
    if (count !== 4) {
      const [week, playerId] = key.split(":").map(Number);
      issue(
        issues,
        "unexpected_rating_count",
        { week, player_id: playerId, expected: 4, actual: count },
        "warning",
      );
    }
  }

  const seenPrices = new Set();
  for (const row of data.prices) {
    const key = playerWeekKey(row);
    if (seenPrices.has(key)) {
      issue(issues, "duplicate_price", {
        week: row.week,
        player_id: row.player_id,
      });
    }
    seenPrices.add(key);
    if (!playerIds.has(row.player_id)) {
      issue(issues, "orphan_price", {
        week: row.week,
        player_id: row.player_id,
      });
    }
    if (!validWeek(row.week)) {
      issue(issues, "invalid_price_week", {
        week: row.week,
        player_id: row.player_id,
      });
    }
    if (!Number.isFinite(numericValue(row.price))) {
      issue(issues, "invalid_price", {
        week: row.week,
        player_id: row.player_id,
        price: row.price,
      });
    }
  }

  const seenSummaries = new Set();
  for (const row of data.summaries) {
    const key = playerWeekKey(row);
    if (seenSummaries.has(key)) {
      issue(issues, "duplicate_summary", {
        week: row.week,
        player_id: row.player_id,
      });
    }
    seenSummaries.add(key);
    if (!playerIds.has(row.player_id)) {
      issue(issues, "orphan_summary", {
        week: row.week,
        player_id: row.player_id,
      });
    }
    if (!validWeek(row.week)) {
      issue(issues, "invalid_summary_week", {
        week: row.week,
        player_id: row.player_id,
      });
    }
    const price = numericValue(row.price);
    if (row.price !== "" && !Number.isFinite(price)) {
      issue(issues, "invalid_summary_price", {
        week: row.week,
        player_id: row.player_id,
        price: row.price,
      });
    }
    const values = ratingGroups.get(key) ?? [];
    const expectedAverage =
      values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null;
    const average = numericValue(row.average_rating);
    if (
      expectedAverage === null ||
      !Number.isFinite(average) ||
      row.rating_count !== values.length ||
      Math.abs(average - expectedAverage) >= 0.0051 ||
      row.rounded_rating !== Math.round(expectedAverage)
    ) {
      issue(issues, "inconsistent_summary", {
        week: row.week,
        player_id: row.player_id,
      });
    }
  }

  const errors = issues.filter((item) => item.severity === "error").length;
  const warnings = issues.filter((item) => item.severity === "warning").length;
  return {
    valid: errors === 0,
    player_count: data.players.length,
    rating_count: data.ratings.length,
    price_count: data.prices.length,
    weeks: [...new Set(data.ratings.map((row) => row.week))]
      .filter(validWeek)
      .sort((a, b) => a - b),
    errors,
    warnings,
    issues,
  };
}
