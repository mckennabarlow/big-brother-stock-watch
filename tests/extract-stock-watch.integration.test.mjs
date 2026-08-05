import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { runExtraction } from "../scripts/extract-stock-watch.mjs";
import { extractSeason } from "../scripts/extract-stock-watch-core.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const firstSnapshot = join(
  repositoryRoot,
  "data",
  "raw",
  "bb28-20260803T213033Z.html",
);
const laterSnapshot = join(
  repositoryRoot,
  "data",
  "raw",
  "bb28-20260804T183629Z.html",
);
const temporaryRoots = [];

async function temporaryRoot() {
  const root = await mkdtemp(join(tmpdir(), "stock-watch-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })
  ));
});

describe("extract-stock-watch CLI orchestration", () => {
  it("processes a local snapshot into only the temporary output root", async () => {
    const outputRoot = await temporaryRoot();

    const result = await runExtraction(
      { input: firstSnapshot, url: null, outputRoot },
      { now: () => new Date("2026-08-04T12:00:00.000Z") },
    );

    expect(result.exitCode).toBe(0);
    expect(result.validation).toMatchObject({
      valid: true,
      player_count: 17,
      rating_count: 192,
      price_count: 45,
      weeks: [1, 2, 3],
    });
    expect(result.data.players.find((player) => player.slug === "ashley"))
      .toMatchObject({ status: "evicted", eviction_week: 1 });
    expect((await readdir(result.outputDirectory)).sort()).toEqual([
      "dataset.json",
      "players.csv",
      "prices.csv",
      "ratings.csv",
      "season.json",
      "validation.json",
      "weekly_summary.csv",
    ]);
    expect(await readdir(join(outputRoot, "raw"))).toEqual([]);
    expect(JSON.parse(await readFile(
      join(result.outputDirectory, "dataset.json"),
      "utf8",
    )).metadata.source).toBe(firstSnapshot);
  });

  it("preserves a disappeared player and current rows across sequential snapshots", async () => {
    const outputRoot = await temporaryRoot();
    const dependencies = {
      now: () => new Date("2026-08-04T12:00:00.000Z"),
      historicalOverrides: {},
      raterOverrides: {},
    };
    const first = await runExtraction(
      { input: firstSnapshot, url: null, outputRoot },
      dependencies,
    );
    const currentJasonRating = first.data.ratings.find(
      (row) => row.player_id === 183 && row.week === 3,
    );

    const later = await runExtraction(
      { input: laterSnapshot, url: null, outputRoot },
      dependencies,
    );

    expect(later.data.players).toHaveLength(15);
    expect(later.data.players.find((player) => player.player_id === 183))
      .toMatchObject({ status: "evicted", eviction_week: 3 });
    expect(later.data.ratings).toContainEqual(currentJasonRating);
    expect(new Set(later.data.ratings.map(
      (row) => `${row.week}:${row.player_id}:${row.rater_id}`,
    )).size).toBe(later.data.ratings.length);
  });

  it("rejects a truncated payload without overwriting the last good dataset", async () => {
    const outputRoot = await temporaryRoot();
    const dependencies = {
      now: () => new Date("2026-08-04T12:00:00.000Z"),
      historicalOverrides: {},
      raterOverrides: {},
    };
    const first = await runExtraction(
      { input: firstSnapshot, url: null, outputRoot, maxMissingPlayers: null },
      dependencies,
    );
    const datasetPath = join(first.outputDirectory, "dataset.json");
    const lastGoodDataset = await readFile(datasetPath, "utf8");
    const sourceHtml = await readFile(firstSnapshot, "utf8");
    const truncatedSeason = extractSeason(sourceHtml);
    truncatedSeason.houseguests = truncatedSeason.houseguests.slice(0, 1);
    const encodedSeason = JSON.stringify(truncatedSeason)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;");
    const truncatedHtml =
      `<guest-trade-panel :season="${encodedSeason}"></guest-trade-panel>`;

    const result = await runExtraction(
      {
        input: null,
        url: "https://local.invalid/truncated",
        outputRoot,
        maxMissingPlayers: null,
      },
      {
        ...dependencies,
        fetch: async () => ({
          ok: true,
          text: async () => truncatedHtml,
        }),
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.validation.issues).toContainEqual(
      expect.objectContaining({
        type: "implausible_player_drop",
        actual: 14,
      }),
    );
    expect(await readFile(datasetPath, "utf8")).toBe(lastGoodDataset);
  });

  it("uses an injected fetch without network access and stores the raw response locally", async () => {
    const outputRoot = await temporaryRoot();
    const html = await readFile(firstSnapshot, "utf8");
    const calls = [];

    const result = await runExtraction(
      { input: null, url: "https://local.invalid/fixture", outputRoot },
      {
        fetch: async (url, options) => {
          calls.push({ url, userAgent: options.headers["User-Agent"] });
          return { ok: true, text: async () => html };
        },
        now: () => new Date("2026-08-04T12:34:56.000Z"),
      },
    );

    expect(result.exitCode).toBe(0);
    expect(calls).toEqual([{
      url: "https://local.invalid/fixture",
      userAgent: "big-brother-stock-watch-data/0.1",
    }]);
    expect(await readdir(join(outputRoot, "raw"))).toEqual([
      "bb28-20260804T123456Z.html",
    ]);
    expect(result.data.metadata.source).toBe("https://local.invalid/fixture");
  });

  it("returns a failing exit code when extracted output does not validate", async () => {
    const outputRoot = await temporaryRoot();
    const outputDirectory = join(outputRoot, "processed", "bb28");
    await import("node:fs/promises").then(({ mkdir, writeFile }) =>
      mkdir(outputDirectory, { recursive: true }).then(() =>
        writeFile(
          join(outputDirectory, "dataset.json"),
          JSON.stringify({ sentinel: "last-good-dataset" }),
          "utf8",
        ),
      ),
    );
    const result = await runExtraction(
      { input: firstSnapshot, url: null, outputRoot },
      {
        now: () => new Date("2026-08-04T12:00:00.000Z"),
        raterOverrides: {},
        historicalOverrides: {
          bb28: {
            players: [{
              player_id: 999,
              first_name: "Invalid",
              last_name: "Rating",
              nickname: "",
              slug: "invalid-rating",
              status: "evicted",
              eviction_week: 1,
              image_url: "",
              weeks: [{ week: 1, ratings: { 1: 11 }, price: 1 }],
            }],
          },
        },
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.validation.valid).toBe(false);
    expect(result.validation.issues).toContainEqual(
      expect.objectContaining({
        type: "rating_out_of_range",
        player_id: 999,
      }),
    );
    expect(JSON.parse(await readFile(
      join(outputDirectory, "dataset.json"),
      "utf8",
    ))).toEqual({ sentinel: "last-good-dataset" });
    expect(await readdir(outputDirectory)).toEqual(["dataset.json"]);
  });

  it.each([
    [{ ok: false, status: 503, statusText: "Unavailable" }, "Request failed: 503 Unavailable"],
    [new Error("local abort"), "local abort"],
  ])("propagates injected fetch failures without changing process.exitCode", async (outcome, message) => {
    const outputRoot = await temporaryRoot();
    const initialExitCode = process.exitCode;
    const fetch = async () => {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    };

    await expect(runExtraction(
      { input: null, url: "https://local.invalid/failure", outputRoot },
      { fetch, now: () => new Date("2026-08-04T12:00:00.000Z") },
    )).rejects.toThrow(message);
    expect(process.exitCode).toBe(initialExitCode);
  });
});
