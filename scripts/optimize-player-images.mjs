#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "..");
const datasetPath = join(
  PROJECT_ROOT,
  "data",
  "processed",
  "bb28",
  "dataset.json",
);
const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
const force = process.argv.includes("--force");
const outputDirectory = join(
  PROJECT_ROOT,
  "public",
  "players",
  dataset.metadata.slug,
);

await mkdir(outputDirectory, { recursive: true });

for (const player of dataset.players) {
  const outputPath = join(outputDirectory, `${player.slug}.webp`);
  if (!force) {
    try {
      await access(outputPath);
      console.log(`${player.nickname || player.first_name}: unchanged`);
      continue;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  const response = await fetch(player.image_url, {
    headers: { "User-Agent": "big-brother-stock-watch-data/0.1" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(
      `Could not download ${player.nickname || player.first_name}: ${response.status}`,
    );
  }

  const optimized = await sharp(Buffer.from(await response.arrayBuffer()))
    .resize(400, 400, {
      fit: "cover",
      position: "top",
      withoutEnlargement: true,
    })
    .webp({ quality: 78, effort: 5 })
    .toBuffer();

  await writeFile(
    outputPath,
    optimized,
  );
  console.log(
    `${player.nickname || player.first_name}: ${Math.round(optimized.length / 1024)} KB`,
  );
}
