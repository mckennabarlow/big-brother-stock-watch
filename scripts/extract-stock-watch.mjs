#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_URL = "https://realitystockwatch.com/trades";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "..");
const RATER_ROLES = new Map([
  [1, ["Audience", "audience"]],
  [4, ["Taran Armstrong", "host"]],
  [9, ["Melissa Deni", "host"]],
]);

function parseArgs(argv) {
  const result = {
    url: DEFAULT_URL,
    input: null,
    outputRoot: join(PROJECT_ROOT, "data"),
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
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  if (result.input && argv.includes("--url")) {
    throw new Error("--input and --url cannot be used together");
  }
  return result;
}

function decodeHtmlEntities(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function extractSeason(page) {
  const match = page.match(
    /<guest-trade-panel\b[^>]*\s:season=(["'])(?<data>.*?)\1/s,
  );
  if (!match?.groups?.data) {
    throw new Error("Could not find the guest-trade-panel season attribute");
  }
  return JSON.parse(decodeHtmlEntities(match.groups.data));
}

async function loadOverrides() {
  const path = join(PROJECT_ROOT, "config", "rater-overrides.json");
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function identifyRater(userId, seasonSlug, week, overrides) {
  if (RATER_ROLES.has(userId)) {
    return RATER_ROLES.get(userId);
  }
  const override = overrides[seasonSlug]?.[String(week)]?.[String(userId)];
  return [override ?? `Guest (user ${userId})`, "guest"];
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function writeCsv(path, fieldNames, rows) {
  const lines = [
    fieldNames.map(csvCell).join(","),
    ...rows.map((row) => fieldNames.map((field) => csvCell(row[field])).join(",")),
  ];
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${lines.join("\r\n")}\r\n`, "utf8");
}

function normalize(season, source, extractedAt, overrides) {
  const seasonSlug = season.short_name;
  const players = [];
  const ratings = [];
  const prices = [];

  for (const player of season.houseguests) {
    players.push({
      season: seasonSlug,
      player_id: player.id,
      first_name: player.first_name,
      last_name: player.last_name ?? "",
      nickname: player.nickname ?? "",
      slug: player.slug,
      status: player.status,
      eviction_week: null,
      image_url: new URL(player.image_url, DEFAULT_URL).href,
    });

    for (const item of player.ratings ?? []) {
      const [raterName, raterRole] = identifyRater(
        item.user_id,
        seasonSlug,
        item.week,
        overrides,
      );
      ratings.push({
        season: seasonSlug,
        week: item.week,
        player_id: player.id,
        player_slug: player.slug,
        player_name: player.nickname || player.first_name,
        rater_id: item.user_id,
        rater_name: raterName,
        rater_role: raterRole,
        rating: item.rating,
        recorded_at: item.created_at,
      });
    }

    for (const item of player.prices ?? []) {
      prices.push({
        season: seasonSlug,
        week: item.week,
        player_id: player.id,
        player_slug: player.slug,
        player_name: player.nickname || player.first_name,
        price: Number(item.price).toFixed(2),
        recorded_at: item.created_at,
      });
    }
  }

  players.sort((left, right) =>
    (left.nickname || left.first_name).localeCompare(
      right.nickname || right.first_name,
      "en",
      { sensitivity: "base" },
    ),
  );
  ratings.sort(
    (left, right) =>
      left.week - right.week ||
      left.player_name.localeCompare(right.player_name) ||
      left.rater_id - right.rater_id,
  );
  prices.sort(
    (left, right) =>
      left.week - right.week || left.player_name.localeCompare(right.player_name),
  );

  const groupedRatings = new Map();
  for (const row of ratings) {
    const key = `${row.week}:${row.player_id}`;
    const values = groupedRatings.get(key) ?? [];
    values.push(row.rating);
    groupedRatings.set(key, values);
  }
  const priceLookup = new Map(
    prices.map((row) => [`${row.week}:${row.player_id}`, row.price]),
  );
  const playerLookup = new Map(players.map((row) => [row.player_id, row]));

  const summaries = [...groupedRatings.entries()]
    .map(([key, values]) => {
      const [week, playerId] = key.split(":").map(Number);
      const player = playerLookup.get(playerId);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      return {
        season: seasonSlug,
        week,
        player_id: playerId,
        player_slug: player.slug,
        player_name: player.nickname || player.first_name,
        average_rating: average.toFixed(2),
        rounded_rating: Math.round(average),
        rating_count: values.length,
        price: priceLookup.get(key) ?? "",
      };
    })
    .sort(
      (left, right) =>
        left.week - right.week || left.player_name.localeCompare(right.player_name),
    );

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

async function loadExistingDataset(outputDirectory) {
  try {
    return JSON.parse(
      await readFile(join(outputDirectory, "dataset.json"), "utf8"),
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function mergeRows(currentRows, previousRows, keyFor) {
  const merged = new Map(previousRows.map((row) => [keyFor(row), row]));
  for (const row of currentRows) {
    merged.set(keyFor(row), row);
  }
  return [...merged.values()];
}

function preserveEvictedPlayers(current, previous) {
  if (!previous) {
    return current;
  }

  const currentPlayers = new Map(
    current.players.map((player) => [player.player_id, player]),
  );
  for (const previousPlayer of previous.players ?? []) {
    const currentPlayer = currentPlayers.get(previousPlayer.player_id);
    if (currentPlayer) {
      currentPlayer.eviction_week = previousPlayer.eviction_week ?? null;
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
    (row) => `${row.week}:${row.player_id}:${row.rater_id}`,
  );
  current.prices = mergeRows(
    current.prices,
    previous.prices ?? [],
    (row) => `${row.week}:${row.player_id}`,
  );
  current.summaries = mergeRows(
    current.summaries,
    previous.summaries ?? [],
    (row) => `${row.week}:${row.player_id}`,
  );

  current.players.sort((left, right) =>
    (left.nickname || left.first_name).localeCompare(
      right.nickname || right.first_name,
      "en",
      { sensitivity: "base" },
    ),
  );
  current.ratings.sort(
    (left, right) =>
      left.week - right.week ||
      left.player_name.localeCompare(right.player_name) ||
      left.rater_id - right.rater_id,
  );
  current.prices.sort(
    (left, right) =>
      left.week - right.week || left.player_name.localeCompare(right.player_name),
  );
  current.summaries.sort(
    (left, right) =>
      left.week - right.week || left.player_name.localeCompare(right.player_name),
  );
  return current;
}

function validate(data) {
  const issues = [];
  const seenRatings = new Set();
  const counts = new Map();

  for (const row of data.ratings) {
    const key = `${row.week}:${row.player_id}:${row.rater_id}`;
    if (seenRatings.has(key)) {
      issues.push({
        severity: "error",
        type: "duplicate_rating",
        week: row.week,
        player_id: row.player_id,
        rater_id: row.rater_id,
      });
    }
    seenRatings.add(key);
    const playerWeek = `${row.week}:${row.player_id}`;
    counts.set(playerWeek, (counts.get(playerWeek) ?? 0) + 1);
    if (row.rating < 1 || row.rating > 10) {
      issues.push({
        severity: "error",
        type: "rating_out_of_range",
        week: row.week,
        player_id: row.player_id,
        rating: row.rating,
      });
    }
  }

  for (const [key, count] of counts) {
    if (count !== 4) {
      const [week, playerId] = key.split(":").map(Number);
      issues.push({
        severity: "warning",
        type: "unexpected_rating_count",
        week,
        player_id: playerId,
        expected: 4,
        actual: count,
      });
    }
  }

  const seenPrices = new Set();
  for (const row of data.prices) {
    const key = `${row.week}:${row.player_id}`;
    if (seenPrices.has(key)) {
      issues.push({
        severity: "error",
        type: "duplicate_price",
        week: row.week,
        player_id: row.player_id,
      });
    }
    seenPrices.add(key);
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return {
    valid: errors === 0,
    player_count: data.players.length,
    rating_count: data.ratings.length,
    price_count: data.prices.length,
    weeks: [...new Set(data.ratings.map((row) => row.week))].sort((a, b) => a - b),
    errors,
    warnings,
    issues,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const extractedAt = new Date().toISOString();
  let page;
  let source;

  if (args.input) {
    page = await readFile(args.input, "utf8");
    source = args.input;
  } else {
    const response = await fetch(args.url, {
      headers: { "User-Agent": "big-brother-stock-watch-data/0.1" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
    page = await response.text();
    source = args.url;
  }

  const season = extractSeason(page);
  const timestamp = new Date()
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
  const rawDirectory = join(args.outputRoot, "raw");
  await mkdir(rawDirectory, { recursive: true });
  if (!args.input) {
    await writeFile(
      join(rawDirectory, `${season.short_name}-${timestamp}.html`),
      page,
      "utf8",
    );
  }

  const outputDirectory = join(
    args.outputRoot,
    "processed",
    season.short_name,
  );
  const data = preserveEvictedPlayers(
    normalize(
      season,
      source,
      extractedAt,
      await loadOverrides(),
    ),
    await loadExistingDataset(outputDirectory),
  );
  const validation = validate(data);
  await mkdir(outputDirectory, { recursive: true });

  await Promise.all([
    writeFile(
      join(outputDirectory, "dataset.json"),
      `${JSON.stringify(data, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      join(outputDirectory, "season.json"),
      `${JSON.stringify(data.metadata, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      join(outputDirectory, "validation.json"),
      `${JSON.stringify(validation, null, 2)}\n`,
      "utf8",
    ),
    writeCsv(
      join(outputDirectory, "players.csv"),
      [
        "season",
        "player_id",
        "first_name",
        "last_name",
        "nickname",
        "slug",
        "status",
        "eviction_week",
        "image_url",
      ],
      data.players,
    ),
    writeCsv(
      join(outputDirectory, "ratings.csv"),
      [
        "season",
        "week",
        "player_id",
        "player_slug",
        "player_name",
        "rater_id",
        "rater_name",
        "rater_role",
        "rating",
        "recorded_at",
      ],
      data.ratings,
    ),
    writeCsv(
      join(outputDirectory, "prices.csv"),
      [
        "season",
        "week",
        "player_id",
        "player_slug",
        "player_name",
        "price",
        "recorded_at",
      ],
      data.prices,
    ),
    writeCsv(
      join(outputDirectory, "weekly_summary.csv"),
      [
        "season",
        "week",
        "player_id",
        "player_slug",
        "player_name",
        "average_rating",
        "rounded_rating",
        "rating_count",
        "price",
      ],
      data.summaries,
    ),
  ]);

  console.log(
    `Extracted ${validation.player_count} players, ` +
      `${validation.rating_count} ratings, and ${validation.price_count} prices ` +
      `for ${season.short_name} weeks ${validation.weeks.join(", ")}.`,
  );
  console.log(
    `Validation: ${validation.errors} errors, ${validation.warnings} warnings. ` +
      `Output: ${outputDirectory}`,
  );
  process.exitCode = validation.valid ? 0 : 1;
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
});
