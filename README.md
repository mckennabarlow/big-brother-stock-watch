# Big Brother Stock Watch Data

This project extracts weekly RHAP Big Brother Stock Watch ratings and prices
from the structured season data embedded in
[Reality Stock Watch](https://realitystockwatch.com/trades).

## Run

Requires Node.js 20 or newer and no third-party packages.

```powershell
node .\scripts\extract-stock-watch.mjs
```

The command saves the retrieved HTML under `data/raw/` and writes normalized
files under `data/processed/<season>/`:

- `season.json`: season metadata and extraction provenance
- `players.csv`: houseguest identities, status, and source image URLs
- `ratings.csv`: one row per houseguest, week, and rater
- `prices.csv`: one row per houseguest and week
- `weekly_summary.csv`: averaged rating and price by player/week
- `validation.json`: completeness and data-quality checks

To reprocess a saved page without making a network request:

```powershell
node .\scripts\extract-stock-watch.mjs --input .\data\raw\<snapshot>.html
```

## Rater identities

The Reality Stock Watch source identifies the persistent accounts as:

| User ID | Role |
| --- | --- |
| 1 | Audience |
| 4 | Taran Armstrong |
| 9 | Melissa Deni |
| Other | Weekly guest |

The guest account does not identify the person appearing on a particular
episode. Add verified week-specific names to `config\rater-overrides.json`;
the extractor will apply them on its next run.

## Data policy

Raw snapshots are retained so every processed value can be traced back to its
source. Player images are not downloaded: `players.csv` stores source URLs
until image licensing and publication requirements are settled.
