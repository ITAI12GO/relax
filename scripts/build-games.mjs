import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const COVER_DIR = path.join(ROOT, "covers");

// Files which are NOT games
const EXCLUDED_FILES = new Set([
  "index.html"
]);

if (!fs.existsSync(COVER_DIR)) {
  fs.mkdirSync(COVER_DIR, { recursive: true });
}

function getMeta(html, name) {
  const re = new RegExp(
    `<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)["']`,
    "i"
  );

  const reverse = new RegExp(
    `<meta\\s+content=["']([^"']*)["']\\s+name=["']${name}["']`,
    "i"
  );

  const match = html.match(re) || html.match(reverse);

  return match ? match[1].trim() : "";
}

function getTitle(html, filename) {
  const gameTitle = getMeta(html, "game-title");

  if (gameTitle) {
    return gameTitle;
  }

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);

  if (titleMatch) {
    return titleMatch[1]
      .replace(/<[^>]+>/g, "")
      .trim();
  }

  return filename
    .replace(/\.html$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function cleanDescription(text) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 250);
}

function getDescription(html) {
  const custom = getMeta(html, "game-description");

  if (custom) {
    return cleanDescription(custom);
  }

  const standardDescription = getMeta(html, "description");

  if (standardDescription) {
    return cleanDescription(standardDescription);
  }

  return "Play this game.";
}

function getCategory(html) {
  return getMeta(html, "game-category") || "Game";
}

function getStatus(html) {
  const status = getMeta(html, "game-status").toLowerCase();

  if (["ready", "wip", "hidden"].includes(status)) {
    return status;
  }

  return "ready";
}

function getDelay(html) {
  const value = Number(getMeta(html, "game-cover-delay"));

  if (
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 10000
  ) {
    return value;
  }

  return 2500;
}

const htmlFiles = fs
  .readdirSync(ROOT)
  .filter(file =>
    file.toLowerCase().endsWith(".html") &&
    !EXCLUDED_FILES.has(file)
  )
  .sort();

console.log(`Found ${htmlFiles.length} game files.`);

const browser = await chromium.launch({
  headless: true
});

const games = [];

for (const filename of htmlFiles) {
  const fullPath = path.join(ROOT, filename);

  const html = fs.readFileSync(fullPath, "utf8");

  const title = getTitle(html, filename);
  const description = getDescription(html);
  const category = getCategory(html);
  const status = getStatus(html);
  const delay = getDelay(html);

  const baseName = filename.replace(/\.html$/i, "");

  const coverFile = `covers/${baseName}.webp`;

  console.log(`Processing: ${title}`);

  const page = await browser.newPage({
    viewport: {
      width: 1280,
      height: 800
    },
    deviceScaleFactor: 1
  });

  try {
    await page.goto(
      `file://${fullPath}`,
      {
        waitUntil: "load",
        timeout: 30000
      }
    );

    await page.waitForTimeout(delay);

    await page.screenshot({
      path: path.join(ROOT, coverFile),
      type: "webp",
      quality: 82,
      fullPage: false
    });

    console.log(`Created ${coverFile}`);

  } catch (error) {
    console.error(
      `Screenshot failed for ${filename}:`,
      error.message
    );
  } finally {
    await page.close();
  }

  games.push({
    title,
    url: filename,
    img: coverFile,
    desc: description,
    category,
    status
  });
}

await browser.close();

fs.writeFileSync(
  path.join(ROOT, "games.json"),
  JSON.stringify(games, null, 2) + "\n"
);

console.log("games.json generated.");
