import { describe, expect, it } from "vitest";
import {
  DEFAULT_URL,
  applyHistoricalOverrides,
  csvCell,
  decodeHtmlEntities,
  extractSeason,
  identifyRater,
  mergeRows,
  normalize,
  parseArgs,
  preserveEvictedPlayers,
  sourceCompletenessIssues,
  validate,
} from "../scripts/extract-stock-watch-core.mjs";

const extractedAt = "2026-08-04T12:00:00.000Z";

function sourcePlayer(overrides = {}) {
  return {
    id: 2,
    first_name: "Zelda",
    last_name: null,
    nickname: "Zee",
    slug: "zee",
    status: "active",
    image_url: "/players/zee.png",
    ratings: [
      { week: 2, user_id: 9, rating: 8, created_at: "r9" },
      { week: 2, user_id: 1, rating: 6, created_at: "r1" },
    ],
    prices: [{ week: 2, price: "12.5", created_at: "p1" }],
    ...overrides,
  };
}

function season(houseguests = [sourcePlayer()]) {
  return {
    id: 28,
    name: "Big Brother 28",
    short_name: "bb28",
    status: "open",
    current_week: 2,
    closes_at: null,
    houseguests,
  };
}

function validData() {
  const player = {
    season: "bb28",
    player_id: 2,
    first_name: "Zelda",
    last_name: "Stone",
    nickname: "Zee",
    slug: "zee",
    status: "active",
    eviction_week: null,
    image_url: "https://example.test/zee.png",
  };
  const ratings = [1, 2, 3, 4].map((raterId, index) => ({
    season: "bb28",
    week: 1,
    player_id: 2,
    player_slug: "zee",
    player_name: "Zee",
    rater_id: raterId,
    rater_name: `Rater ${raterId}`,
    rater_role: "host",
    rating: [1, 4, 7, 10][index],
    recorded_at: null,
  }));
  return {
    metadata: {
      id: 28,
      name: "Big Brother 28",
      slug: "bb28",
      status: "open",
      current_week: 2,
      closes_at: null,
      source: "fixture",
      extracted_at: extractedAt,
    },
    players: [player],
    ratings,
    prices: [{
      season: "bb28",
      week: 1,
      player_id: 2,
      player_slug: "zee",
      player_name: "Zee",
      price: "11.00",
      recorded_at: null,
    }],
    summaries: [{
      season: "bb28",
      week: 1,
      player_id: 2,
      player_slug: "zee",
      player_name: "Zee",
      average_rating: "5.50",
      rounded_rating: 6,
      rating_count: 4,
      price: "11.00",
    }],
  };
}

describe("parseArgs", () => {
  it("uses production defaults relative to the supplied project root", () => {
    expect(parseArgs([], "C:\\repo")).toEqual({
      url: DEFAULT_URL,
      input: null,
      outputRoot: "C:\\repo\\data",
      maxMissingPlayers: null,
    });
  });

  it("parses every supported option and resolves paths", () => {
    const result = parseArgs([
      "--input", "./fixture.html",
      "--output-root", "./generated",
    ]);
    expect(result.input).toMatch(/fixture\.html$/);
    expect(result.outputRoot).toMatch(/generated$/);
    expect(result.url).toBe(DEFAULT_URL);
  });

  it("accepts an explicit URL when no input file is supplied", () => {
    expect(parseArgs(["--url", "https://example.test/stock"], "C:\\repo"))
      .toEqual({
        url: "https://example.test/stock",
        input: null,
        outputRoot: "C:\\repo\\data",
        maxMissingPlayers: null,
      });
  });

  it("accepts an explicit missing-player threshold", () => {
    expect(parseArgs(["--allow-player-drop", "4"]).maxMissingPlayers).toBe(4);
  });

  it.each([
    [["--wat"], "Unknown or incomplete argument"],
    [["--input"], "Unknown or incomplete argument"],
    [["--input", "one.html", "--url", "https://example.test"], "cannot be used together"],
    [["--allow-player-drop", "-1"], "non-negative integer"],
    [["--allow-player-drop", "1.5"], "non-negative integer"],
  ])("rejects invalid arguments %#", (argv, message) => {
    expect(() => parseArgs(argv)).toThrow(message);
  });
});

describe("HTML extraction", () => {
  it("decodes all supported entities at their intersection", () => {
    expect(decodeHtmlEntities("&quot;A&#039;s &lt;x&gt;&quot; &amp; &#39;y&#39;"))
      .toBe("\"A's <x>\" & 'y'");
  });

  it.each([
    [`<guest-trade-panel :season='{"id":28,"name":"BB"}'>`, 28],
    [`<guest-trade-panel class="x" :season="{&quot;id&quot;:29,&quot;name&quot;:&quot;BB&quot;}">`, 29],
  ])("extracts JSON from quoted season attributes", (html, id) => {
    expect(extractSeason(html)).toEqual({ id, name: "BB" });
  });

  it.each([
    ["<main>none</main>", "Could not find"],
    ["<guest-trade-panel :season='{bad}'>", "JSON"],
  ])("rejects unusable pages", (html, message) => {
    expect(() => extractSeason(html)).toThrow(message);
  });
});

describe("small formatting helpers", () => {
  it.each([
    [1, "bb28", 1, {}, ["Audience", "audience"]],
    [4, "bb28", 1, {}, ["Taran Armstrong", "host"]],
    [9, "bb28", 1, {}, ["Melissa Deni", "host"]],
    [7620, "bb28", 2, { bb28: { 2: { 7620: "Pooya" } } }, ["Pooya", "guest"]],
    [77, "bb28", 4, {}, ["Guest (user 77)", "guest"]],
  ])("identifies rater %i deterministically", (id, slug, week, overrides, expected) => {
    expect(identifyRater(id, slug, week, overrides)).toEqual(expected);
  });

  it.each([
    [null, ""],
    [undefined, ""],
    ["plain", "plain"],
    ["a,b", "\"a,b\""],
    ["say \"hi\"", "\"say \"\"hi\"\"\""],
    ["a\r\nb", "\"a\r\nb\""],
  ])("encodes CSV value %#", (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });
});

describe("normalize", () => {
  it("normalizes, computes and deterministically sorts realistic records", () => {
    const amy = sourcePlayer({
      id: 1,
      first_name: "Amy",
      nickname: "",
      slug: "amy",
      image_url: "https://cdn.test/amy.png",
      ratings: [
        { week: 1, user_id: 4, rating: 7, created_at: "a4" },
        { week: 1, user_id: 1, rating: 8, created_at: "a1" },
      ],
      prices: [{ week: 1, price: 9, created_at: "ap" }],
    });

    const result = normalize(season([sourcePlayer(), amy]), "local.html", extractedAt);

    expect(result.players.map((row) => row.slug)).toEqual(["amy", "zee"]);
    expect(result.ratings.map((row) => [row.week, row.player_name, row.rater_id]))
      .toEqual([[1, "Amy", 1], [1, "Amy", 4], [2, "Zee", 1], [2, "Zee", 9]]);
    expect(result.prices.map((row) => row.price)).toEqual(["9.00", "12.50"]);
    expect(result.summaries).toMatchObject([
      { week: 1, player_name: "Amy", average_rating: "7.50", rounded_rating: 8, rating_count: 2, price: "9.00" },
      { week: 2, player_name: "Zee", average_rating: "7.00", rounded_rating: 7, rating_count: 2, price: "12.50" },
    ]);
    expect(result.players[1].image_url).toBe("https://realitystockwatch.com/players/zee.png");
    expect(result.metadata).toMatchObject({ source: "local.html", extracted_at: extractedAt });
  });

  it("keeps a rating summary blank-priced and omits a price-only summary", () => {
    const rated = sourcePlayer({ prices: [] });
    const priceOnly = sourcePlayer({
      id: 3,
      first_name: "Price",
      nickname: "",
      slug: "price",
      ratings: [],
      prices: [{ week: 1, price: 0, created_at: "p" }],
    });
    const result = normalize(season([rated, priceOnly]), "fixture", extractedAt);

    expect(result.summaries).toHaveLength(1);
    expect(result.summaries[0]).toMatchObject({ player_id: 2, price: "" });
    expect(result.prices.find((row) => row.player_id === 3)?.price).toBe("0.00");
  });

  it.each([
    ["rating", sourcePlayer({ ratings: [{ week: 1, user_id: 1, rating: "NaN" }] })],
    ["price", sourcePlayer({ prices: [{ week: 1, price: "" }] })],
    ["price", sourcePlayer({ prices: [{ week: 1, price: Infinity }] })],
  ])("rejects malformed %s values", (kind, player) => {
    expect(() => normalize(season([player]), "fixture", extractedAt))
      .toThrow("must be a finite number");
  });
});

describe("historical overrides and merging", () => {
  it("inserts and replaces authoritative historical records without empty summaries", () => {
    const data = normalize(season(), "fixture", extractedAt);
    const overrides = {
      bb28: {
        players: [
          {
            player_id: 2,
            first_name: "Corrected",
            last_name: "Name",
            nickname: "Correct",
            slug: "correct",
            status: "evicted",
            eviction_week: 2,
            image_url: "https://example.test/correct.png",
            weeks: [{ week: 2, ratings: { 1: 10, 7620: 8 }, price: "" }],
          },
          {
            player_id: 3,
            first_name: "Empty",
            last_name: "History",
            nickname: "",
            slug: "empty",
            status: "evicted",
            eviction_week: 1,
            image_url: "https://example.test/empty.png",
            weeks: [],
          },
        ],
      },
    };

    const result = applyHistoricalOverrides(
      data,
      overrides,
      { bb28: { 2: { 7620: "Pooya" } } },
    );

    expect(result.players.map((row) => row.player_id)).toEqual([2, 3]);
    expect(result.players[0]).toMatchObject({ first_name: "Corrected", status: "evicted" });
    expect(result.ratings.filter((row) => row.player_id === 2)).toMatchObject([
      { rater_id: 1, rating: 10 },
      { rater_id: 7620, rating: 8, rater_name: "Pooya" },
    ]);
    expect(result.summaries).toEqual([
      expect.objectContaining({
        player_id: 2,
        average_rating: "9.00",
        rating_count: 2,
        price: "",
      }),
    ]);
  });

  it("returns the same data when the season has no override", () => {
    const data = normalize(season(), "fixture", extractedAt);
    const before = structuredClone(data);
    const result = applyHistoricalOverrides(data, {}, {});

    expect(result).toBe(data);
    expect(result).toEqual(before);
  });

  it("uses current precedence and collapses duplicates", () => {
    const previous = [{ id: 1, value: "old" }, { id: 2, value: "kept" }, { id: 1, value: "later old" }];
    const current = [{ id: 1, value: "new" }, { id: 1, value: "latest new" }];
    expect(mergeRows(current, previous, (row) => row.id)).toEqual([
      { id: 1, value: "latest new" },
      { id: 2, value: "kept" },
    ]);
  });
});

describe("preserveEvictedPlayers", () => {
  it("does not copy or alter data without a previous dataset", () => {
    const current = validData();
    const before = structuredClone(current);
    const result = preserveEvictedPlayers(current, null);

    expect(result).toBe(current);
    expect(result).toEqual(before);
  });

  describe("sourceCompletenessIssues", () => {
    it("allows normal single and double eviction drops", () => {
      const previous = {
        players: Array.from({ length: 10 }, (_, index) => ({
          player_id: index + 1,
          status: "active",
          eviction_week: null,
        })),
      };
      const current = {
        players: previous.players.slice(0, 8),
      };

      expect(sourceCompletenessIssues(current, previous)).toEqual([]);
    });

    it("rejects an implausibly truncated player payload", () => {
      const previous = {
        players: Array.from({ length: 16 }, (_, index) => ({
          player_id: index + 1,
          status: "active",
          eviction_week: null,
        })),
      };
      const current = { players: previous.players.slice(0, 1) };

      expect(sourceCompletenessIssues(current, previous)).toEqual([
        {
          severity: "error",
          type: "implausible_player_drop",
          expected_maximum: 4,
          actual: 15,
          player_ids: Array.from({ length: 15 }, (_, index) => index + 2),
        },
      ]);
    });

    it("honors an explicit player-drop threshold", () => {
      const previous = {
        players: Array.from({ length: 6 }, (_, index) => ({
          player_id: index + 1,
          status: "active",
          eviction_week: null,
        })),
      };
      const current = { players: previous.players.slice(0, 3) };

      expect(sourceCompletenessIssues(current, previous, 3)).toEqual([]);
      expect(sourceCompletenessIssues(current, previous, 2)[0]).toMatchObject({
        type: "implausible_player_drop",
        actual: 3,
      });
    });
  });

  it.each([
    [null, 1],
    [7, 7],
  ])("retains a disappeared player and selects eviction week %#", (explicitWeek, expectedWeek) => {
    const previous = validData();
    previous.players[0].eviction_week = explicitWeek;
    const current = {
      ...validData(),
      players: [],
      ratings: [],
      prices: [],
      summaries: [],
    };

    const result = preserveEvictedPlayers(current, previous);

    expect(result.players[0]).toMatchObject({ player_id: 2, status: "evicted", eviction_week: expectedWeek });
    expect(result.ratings).toHaveLength(4);
    expect(result.prices).toHaveLength(1);
    expect(result.summaries).toHaveLength(1);
  });

  it("uses week zero for a disappeared player without prior summaries", () => {
    const previous = validData();
    previous.ratings = [];
    previous.prices = [];
    previous.summaries = [];
    const current = { ...validData(), players: [], ratings: [], prices: [], summaries: [] };
    expect(preserveEvictedPlayers(current, previous).players[0].eviction_week).toBe(0);
  });

  it("retains prior eviction metadata and lets current keyed rows win", () => {
    const previous = validData();
    previous.players[0].eviction_week = 1;
    previous.ratings[0].rating = 2;
    const current = validData();
    current.ratings[0].rating = 9;

    const result = preserveEvictedPlayers(current, previous);

    expect(result.players[0].eviction_week).toBe(1);
    expect(result.ratings).toHaveLength(4);
    expect(result.ratings.find((row) => row.rater_id === 1).rating).toBe(9);
  });

  it("keeps a current eviction week instead of replacing it with older metadata", () => {
    const previous = validData();
    previous.players[0].eviction_week = 1;
    const current = validData();
    current.players[0].eviction_week = 2;

    expect(preserveEvictedPlayers(current, previous).players[0].eviction_week)
      .toBe(2);
  });
});

describe("validate", () => {
  it("accepts exact rating bounds and a blank summary price", () => {
    const data = validData();
    data.summaries[0].price = "";
    expect(validate(data)).toMatchObject({
      valid: true,
      errors: 0,
      warnings: 0,
      weeks: [1],
    });
  });

  it.each([
    ["duplicate_rating", (data) => data.ratings.push({ ...data.ratings[0] })],
    ["duplicate_price", (data) => data.prices.push({ ...data.prices[0] })],
    ["duplicate_player", (data) => data.players.push({ ...data.players[0] })],
    ["duplicate_summary", (data) => data.summaries.push({ ...data.summaries[0] })],
    ["rating_out_of_range", (data) => { data.ratings[0].rating = 0.99; }],
    ["rating_out_of_range", (data) => { data.ratings[0].rating = 10.01; }],
    ["rating_out_of_range", (data) => { data.ratings[0].rating = "bad"; }],
    ["orphan_rating", (data) => { data.ratings[0].player_id = 99; }],
    ["orphan_price", (data) => { data.prices[0].player_id = 99; }],
    ["orphan_summary", (data) => { data.summaries[0].player_id = 99; }],
    ["invalid_rating_week", (data) => { data.ratings[0].week = 0; }],
    ["invalid_price_week", (data) => { data.prices[0].week = 0; }],
    ["invalid_summary_week", (data) => { data.summaries[0].week = 0; }],
    ["invalid_price", (data) => { data.prices[0].price = "Infinity"; }],
    ["invalid_summary_price", (data) => { data.summaries[0].price = "bad"; }],
    ["inconsistent_summary", (data) => { data.summaries[0].average_rating = "5.40"; }],
    ["inconsistent_summary", (data) => { data.summaries[0].rating_count = 3; }],
    ["inconsistent_summary", (data) => { data.summaries[0].rounded_rating = 5; }],
    ["invalid_eviction_week", (data) => { data.players[0].eviction_week = 3; }],
    ["invalid_eviction_week", (data) => { data.players[0].eviction_week = -1; }],
    ["invalid_eviction_week", (data) => { data.players[0].eviction_week = 1.5; }],
  ])("reports %s", (type, mutate) => {
    const data = validData();
    mutate(data);
    const result = validate(data);
    expect(result.valid).toBe(false);
    expect(result.issues.map((item) => item.type)).toContain(type);
  });

  it("warns for non-four-rater groups without treating the warning as an error", () => {
    const data = validData();
    data.ratings.pop();
    data.summaries[0] = {
      ...data.summaries[0],
      average_rating: "4.00",
      rounded_rating: 4,
      rating_count: 3,
    };
    expect(validate(data)).toMatchObject({
      valid: true,
      errors: 0,
      warnings: 1,
      issues: [expect.objectContaining({ type: "unexpected_rating_count", actual: 3 })],
    });
  });

  it("reports exact totals and sorted unique valid weeks for combined issues", () => {
    const data = validData();
    data.ratings.push({ ...data.ratings[0] });
    data.prices.push({ ...data.prices[0], week: 2, price: "bad" });
    data.ratings.push({ ...data.ratings[1], week: 2, rating: 8 });

    const result = validate(data);

    expect(result.weeks).toEqual([1, 2]);
    expect(result.errors).toBe(3);
    expect(result.warnings).toBe(2);
    expect(result.issues).toHaveLength(5);
  });
});
