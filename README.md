# Big Brother Stock Watch

An interactive season dashboard and data extractor for RHAP's weekly Big
Brother Stock Watch ratings and prices.

## View the dashboard

Requires Node.js 20 or newer.

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. The mobile-first dashboard includes:

- season-long rating and stock-price charts
- player portraits and selectable chart lines
- a week-by-week leaderboard
- individual RHAP panel and audience ratings
- movement since the previous week
- draft-team rosters, standings, trajectories, and insights
- independent rating and stock-price views for both dashboards

## Weekly update workflow

Run these commands after the new Reality Stock Watch data is available:

```powershell
git pull
npm run data:update
npm test
npm run build
```

Use `npm run dev` for a local preview, then open the URL printed by Vite.
The development server keeps the terminal busy until you press `Ctrl+C`.

Publish the update after reviewing it:

```powershell
git add .
git commit -m "Update Stock Watch for Week 5"
git push
```

GitHub Actions rebuilds and deploys the dashboard to GitHub Pages.

### What `data:update` does

The extractor saves the retrieved HTML under `data/raw/` and writes normalized
files under `data/processed/<season>/`:

- `dataset.json`: complete dashboard-ready dataset
- `season.json`: season metadata and extraction provenance
- `players.csv`: houseguest identities, status, and source image URLs
- `ratings.csv`: one row per houseguest, week, and rater
- `prices.csv`: one row per houseguest and week
- `weekly_summary.csv`: averaged rating and price by player/week
- `validation.json`: completeness and data-quality checks

Each refresh merges with the previous `dataset.json`. If a houseguest
disappears from the live source, their historical rows are retained, they are
marked evicted, and their chart line ends at their final scored week.

Validation errors cause the command to fail without replacing the last valid
processed dataset. The portrait step creates images only for players that do
not already have a local optimized WebP. Force a complete portrait refresh
with:

```powershell
npm run images:refresh
```

The extractor also rejects implausibly large player-count drops so a truncated
source response cannot be mistaken for a mass eviction. If you intentionally
skip several weeks containing multiple evictions, set an explicit allowance:

```powershell
node .\scripts\extract-stock-watch.mjs --allow-player-drop 4
node .\scripts\optimize-player-images.mjs
```

To reprocess a saved page without making a network request:

```powershell
node .\scripts\extract-stock-watch.mjs --input .\data\raw\<snapshot>.html
```

## Rater identities

| User ID | Role |
| --- | --- |
| 1 | Audience |
| 4 | Taran Armstrong |
| 9 | Melissa Deni |
| Other | Weekly guest |

Add verified week-specific guest names to `config\rater-overrides.json`, then
rerun the extractor.

Ratings for players removed from the live Reality Stock Watch payload can be
preserved in `config\historical-overrides.json`. Missing stock prices remain
blank rather than being estimated.

## Tests

The project uses Vitest, jsdom, and React Testing Library:

```powershell
npm test
```

The suite covers extraction and validation, historical overrides, eviction
behavior, weekly player pools, metric calculations, draft-team aggregation,
chart calculations, and stable component behavior. Tests are deterministic and
do not call the live Reality Stock Watch website.

Visual Studio Test Explorer does not automatically discover these Node/Vitest
tests when the repository is opened as a folder. Run them from the integrated
terminal with `npm test`.

## Data policy

Raw snapshots are retained so every processed value can be traced back to its
source. The update command creates resized WebP portraits under `public/players`
for fast mobile delivery while retaining source URLs as browser fallbacks.
