import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  applyHistoricalOverrides,
  csvCell,
  extractSeason,
  normalize,
  parseArgs,
  preserveEvictedPlayers,
  sourceCompletenessIssues,
  validate,
} from "./extract-stock-watch-core.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "..");

async function optionalJson(read, path) {
  try {
    return JSON.parse(await read(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeCsv(path, fieldNames, rows, dependencies) {
  const lines = [
    fieldNames.map(csvCell).join(","),
    ...rows.map((row) => fieldNames.map((field) => csvCell(row[field])).join(",")),
  ];
  await dependencies.mkdir(dirname(path), { recursive: true });
  await dependencies.writeFile(path, `${lines.join("\r\n")}\r\n`, "utf8");
}

export async function runExtraction(options, injected = {}) {
  const dependencies = {
    readFile,
    writeFile,
    mkdir,
    fetch: globalThis.fetch,
    now: () => new Date(),
    ...injected,
  };
  const extractedAt = dependencies.now().toISOString();
  let page;
  let source;

  if (options.input) {
    page = await dependencies.readFile(options.input, "utf8");
    source = options.input;
  } else {
    const response = await dependencies.fetch(options.url, {
      headers: { "User-Agent": "big-brother-stock-watch-data/0.1" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
    page = await response.text();
    source = options.url;
  }

  const season = extractSeason(page);
  const timestamp = dependencies
    .now()
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
  const rawDirectory = join(options.outputRoot, "raw");
  await dependencies.mkdir(rawDirectory, { recursive: true });
  if (!options.input) {
    await dependencies.writeFile(
      join(rawDirectory, `${season.short_name}-${timestamp}.html`),
      page,
      "utf8",
    );
  }

  const outputDirectory = join(options.outputRoot, "processed", season.short_name);
  const raterOverrides =
    injected.raterOverrides ??
    (await optionalJson(
      dependencies.readFile,
      join(PROJECT_ROOT, "config", "rater-overrides.json"),
    )) ??
    {};
  const historicalOverrides =
    injected.historicalOverrides ??
    (await optionalJson(
      dependencies.readFile,
      join(PROJECT_ROOT, "config", "historical-overrides.json"),
    )) ??
    {};
  const previous = await optionalJson(
    dependencies.readFile,
    join(outputDirectory, "dataset.json"),
  );
  const current = applyHistoricalOverrides(
    normalize(season, source, extractedAt, raterOverrides),
    historicalOverrides,
    raterOverrides,
  );
  const completenessIssues = sourceCompletenessIssues(
    current,
    previous,
    options.maxMissingPlayers,
  );
  const data = completenessIssues.length
    ? current
    : preserveEvictedPlayers(current, previous);
  const validation = validate(data, completenessIssues);
  if (!validation.valid) {
    return {
      exitCode: 1,
      data,
      validation,
      outputDirectory,
    };
  }

  await dependencies.mkdir(outputDirectory, { recursive: true });

  const jsonFiles = [
    ["dataset.json", data],
    ["season.json", data.metadata],
    ["validation.json", validation],
  ];
  const csvFiles = [
    ["players.csv", ["season", "player_id", "first_name", "last_name", "nickname", "slug", "status", "eviction_week", "image_url"], data.players],
    ["ratings.csv", ["season", "week", "player_id", "player_slug", "player_name", "rater_id", "rater_name", "rater_role", "rating", "recorded_at"], data.ratings],
    ["prices.csv", ["season", "week", "player_id", "player_slug", "player_name", "price", "recorded_at"], data.prices],
    ["weekly_summary.csv", ["season", "week", "player_id", "player_slug", "player_name", "average_rating", "rounded_rating", "rating_count", "price"], data.summaries],
  ];
  await Promise.all([
    ...jsonFiles.map(([name, value]) =>
      dependencies.writeFile(
        join(outputDirectory, name),
        `${JSON.stringify(value, null, 2)}\n`,
        "utf8",
      ),
    ),
    ...csvFiles.map(([name, fields, rows]) =>
      writeCsv(join(outputDirectory, name), fields, rows, dependencies),
    ),
  ]);

  return {
    exitCode: validation.valid ? 0 : 1,
    data,
    validation,
    outputDirectory,
  };
}

export async function main(argv = process.argv.slice(2)) {
  return runExtraction(parseArgs(argv, PROJECT_ROOT));
}

const isDirectExecution =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  main()
    .then((result) => {
      console.log(
        `Extracted ${result.validation.player_count} players, ` +
          `${result.validation.rating_count} ratings, and ` +
          `${result.validation.price_count} prices for ` +
          `${result.data.metadata.slug} weeks ${result.validation.weeks.join(", ")}.`,
      );
      console.log(
        `Validation: ${result.validation.errors} errors, ` +
          `${result.validation.warnings} warnings. Output: ${result.outputDirectory}`,
      );
      if (!result.validation.valid) {
        console.error(JSON.stringify(result.validation.issues, null, 2));
      }
      process.exitCode = result.exitCode;
    })
    .catch((error) => {
      console.error(`error: ${error.message}`);
      process.exitCode = 1;
    });
}
