// Screenshots of the running dev server for design review.
//   node scripts/shots.mjs <outDir> <path> [more paths...]
// Env: SHOT_THEME=light|dark, SHOT_LANG=en|he, SHOT_WIDTH, SHOT_HEIGHT, SHOT_TOKEN (access), SHOT_REFRESH
import { chromium } from "playwright-core";
import path from "path";

const [outDir, ...paths] = process.argv.slice(2);
const theme = process.env.SHOT_THEME ?? "light";
const lang = process.env.SHOT_LANG ?? "en";
const width = Number(process.env.SHOT_WIDTH ?? 1280);
const height = Number(process.env.SHOT_HEIGHT ?? 900);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: process.env.SHOT_MOTION === "reduce" ? "reduce" : "no-preference" });
await context.addInitScript(({ lang, theme, token, refresh }) => {
  localStorage.setItem("lang", lang);
  localStorage.setItem("theme", theme);
  if (token) {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("refreshToken", refresh ?? "");
  }
}, { lang, theme, token: process.env.SHOT_TOKEN, refresh: process.env.SHOT_REFRESH });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
for (const p of paths) {
  await page.goto(`http://localhost:5173${p}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(Number(process.env.SHOT_WAIT ?? 1200));
  const name = `${(p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home")}-${lang}-${theme}-${width}.png`;
  await page.screenshot({ path: path.join(outDir, name), fullPage: process.env.SHOT_FULL !== "0" });
  console.log(name);
}
if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
await browser.close();
