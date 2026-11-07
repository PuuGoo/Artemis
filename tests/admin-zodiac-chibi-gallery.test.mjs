import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Script } from "node:vm";
import { getCampaignDetail } from "../lib/campaignCatalog.js";

const ui = fs.readFileSync(new URL("../public/admin-campaign.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/admin-campaign.css", import.meta.url), "utf8");
const gameArt = fs.readFileSync(new URL("../public/zodiac-chibi-bosses.js", import.meta.url), "utf8");
const signs = "aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces".split(" ");

test("admin zodiac gallery maps all twelve chapters to the real in-game SVG files", () => {
  for (let i = 0; i < signs.length; i++) {
    const chapter = i + 8;
    const bossType = "zodiac_" + signs[i];
    const asset = "/assets/boss-ch" + chapter + "-" + signs[i] + ".svg";
    assert.ok(fs.existsSync(new URL("../public" + asset, import.meta.url)), asset);
    assert.ok(gameArt.includes("asset: '" + asset + "'"), "Different game asset: " + asset);
    const campaign = getCampaignDetail(chapter);
    assert.ok(campaign && campaign.bosses.length > 0);
    assert.ok(campaign.bosses.every(b => b.type === bossType), "Wrong boss type for chapter " + chapter);
  }
});

test("admin offers chibi gallery, large boss art, sprite cards and SVG battle preview", () => {
  new Script(ui);
  assert.match(ui, /id="ccZodiacGallery"/);
  assert.match(ui, /function renderZodiacGallery\(/);
  assert.match(ui, /data-ch/);
  assert.match(ui, /function drawZodiacInArena\(/);
  assert.match(ui, /zodiac-chibi-bosses\.js/);
  assert.match(ui, /cc-zodiac-sprite/);
  assert.match(ui, /cc-boss-feature/);
  assert.match(ui, /api\.drawMonster\(ctx,e,now\)/, "Canvas fallback removed");
  for (const cls of [".cc-zodiac-grid", ".cc-zodiac-card", ".cc-zodiac-sprite", ".cc-boss-feature"]) {
    assert.ok(css.includes(cls), "Missing class " + cls);
  }
});
