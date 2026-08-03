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

## Refresh the data

```powershell
npm run data:update
```

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

To reprocess a saved page without making a network request:

```powershell
node .\scripts\extract-stock-watch.mjs --input .\data\raw\<snapshot>.html
```

Commit and push after refreshing the data. GitHub Actions rebuilds and deploys
the dashboard to GitHub Pages.

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

## Data policy

Raw snapshots are retained so every processed value can be traced back to its
source. The update command creates resized WebP portraits under `public/players`
for fast mobile delivery while retaining source URLs as browser fallbacks.
