import { test, expect } from "@playwright/test";

const fixture = {
  players: ["Kobo", "Him", "Tim", "Anson", "大Tom", "亮", "Anson y"].map((name, i) => ({ id: `p${i + 1}`, name, gender: "男" })),
  matches: Array.from({ length: 12 }, (_, i) => ({ id: `m-${String(i).padStart(2, "0")}`, date: i < 5 ? "2026-08-01" : "2026-08-02", teamAIds: ["p1", "p2"], teamBIds: ["p3", "p4"], scoreA: i % 2 ? 17 : 21, scoreB: i % 2 ? 21 : 17, location: "天水圍體育館", note: "友誼賽" }))
};

async function setup(page, editor = true) {
  await page.route("**/*.supabase.co/**", (route) => route.abort());
  await page.route("**/supabase-config.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.route("**/cloud-storage.js*", (route) => route.fulfill({ contentType: "application/javascript", body: "window.cloudSync = {isConfigured: () => false};" }));
  await page.addInitScript(({ fixture, editor }) => {
    if (!localStorage.getItem("badmintonPlayerRating.v2")) localStorage.setItem("badmintonPlayerRating.v2", JSON.stringify(fixture));
    if (editor) localStorage.setItem("badmintonAdminAccess.v2", "unlocked");
  }, { fixture, editor });
  await page.goto("/");
  await expect(page.locator("body")).toHaveClass(/shell-ready/);
}

async function fillMatch(page) {
  await page.locator('.mobile-dock a[href="#match"]').click();
  for (const [id, value] of [["teamAPlayer1", "p1"], ["teamAPlayer2", "p2"], ["teamBPlayer1", "p3"], ["teamBPlayer2", "p4"]]) await page.locator(`#${id}`).selectOption(value);
  await page.locator("#scoreA").fill("21");
  await page.locator("#scoreB").fill("12");
}

test("mobile tabs, draft, compact entry and honest local save", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.screenshot({ path: testInfo.outputPath("home-mobile.png"), fullPage: true });
  await expect(page.locator("#leaderboard")).toBeHidden();
  await expect(page.locator(".mobile-dock a")).toHaveCount(5);
  await expect(page.locator(".mobile-dock svg")).toHaveCount(5);
  await fillMatch(page);
  const a = await page.locator(".flexible-team").first().boundingBox();
  const b = await page.locator(".flexible-team").last().boundingBox();
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  expect((await page.locator("#scoreA").boundingBox()).width).toBeGreaterThan(45);
  await page.locator('.mobile-dock a[href="#leaderboard"]').click();
  await expect(page.locator("#match")).toBeHidden();
  await page.locator("#leaderboardDayButton").click();
  await page.locator("#leaderboardDate").fill("2026-08-01");
  await page.locator("#leaderboardDate").dispatchEvent("change");
  await page.screenshot({ path: testInfo.outputPath("ranking-mobile.png"), fullPage: true });
  await page.locator('.mobile-dock a[href="#match"]').click();
  await expect(page.locator("#scoreB")).toHaveValue("12");
  await page.reload();
  await expect(page.locator("#scoreB")).toHaveValue("12");
  await page.locator("#previewButton").click();
  await expect(page.locator("#ratingPreview")).toContainText("總排名");
  await page.screenshot({ path: testInfo.outputPath("entry-mobile.png"), fullPage: true });
  await page.locator("#saveMatchButton").click();
  await expect(page.locator("#saveConfirmTitle")).toHaveText("比賽已儲存到本機");
  await expect(page.locator("#saveConfirmDetails")).toContainText("21:12");
  await page.screenshot({ path: testInfo.outputPath("saved-mobile.png"), fullPage: true });
  await page.locator("#nextMatchButton").click();
  await expect(page.locator("#scoreA")).toHaveValue("");
  await expect(page.locator("#teamAPlayer1")).toHaveValue("p1");
  const count = await page.evaluate(() => JSON.parse(localStorage.getItem("badmintonPlayerRating.v2")).matches.length);
  expect(count).toBe(13);
  await page.locator("#saveMatchButton").click();
  await expect(page.locator("#appStatus")).toContainText("請輸入兩隊得分");
  expect(errors).toEqual([]);
});

test("viewer navigation and no horizontal overflow at narrow/mobile/desktop sizes", async ({ page }, testInfo) => {
  await setup(page, false);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["home", "leaderboard", "match", "history", "more", "players", "days", "cloud", "backup", "analytics", "access"]) {
      await page.evaluate((route) => { location.hash = `#${route}`; }, route);
      await expect(page.locator("body")).toHaveAttribute("data-page", route);
      if (route !== "match") await expect(page.locator("#matchGate")).toBeHidden();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      expect(overflow, `${route} at ${width}px`).toBe(false);
    }
  }
  await page.goto("/#match");
  await expect(page.locator("#matchGate")).toBeVisible();
  await expect(page.locator("#matchForm")).toBeHidden();
  await page.goto("/#home");
  await page.screenshot({ path: testInfo.outputPath("home-desktop.png"), fullPage: true });
});

test("editing changes only the selected match, and local storage errors keep the draft", async ({ page }) => {
  await setup(page);
  await page.evaluate(() => editMatch("m-00"));
  await page.locator("#teamAPlayer2").selectOption("p5");
  await page.locator("#scoreB").fill("8");
  await page.locator("#saveMatchButton").click();
  await expect(page.locator("#saveConfirmTitle")).toContainText("本機");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("badmintonPlayerRating.v2")));
  expect(saved.matches.length).toBe(12);
  expect(saved.matches.find((m) => m.id === "m-00").teamAIds).toEqual(["p1", "p5"]);
  expect(saved.matches.find((m) => m.id === "m-01").scoreB).toBe(21);
  await page.locator("#nextMatchButton").click();
  await page.locator("#scoreA").fill("21");
  await page.locator("#scoreB").fill("4");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "badmintonPlayerRating.v2") throw new Error("Storage full");
      return original.call(this, key, value);
    };
  });
  await page.locator("#saveMatchButton").click();
  await expect(page.locator("#appStatus")).toContainText("儲存比賽失敗");
  await expect(page.locator("#scoreB")).toHaveValue("4");
  expect(await page.evaluate(() => state.matches.length)).toBe(12);
});

test("failed cloud verification preserves the locally saved match", async ({ page }) => {
  await setup(page);
  await fillMatch(page);
  await page.evaluate(() => { window.cloudSync = { isConfigured: () => true, saveStateToCloud: async () => {}, loadStateFromCloud: async () => ({ players: [], matches: [] }) }; });
  await page.locator("#saveMatchButton").click();
  await expect(page.locator("#saveConfirmTitle")).toHaveText("已儲存本機，雲端未同步");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("badmintonPlayerRating.v2")).matches.length)).toBe(13);
});
