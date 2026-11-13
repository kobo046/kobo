import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

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

async function expectPageTop(page, target) {
  await expect(page.locator(".brand")).toBeInViewport();
  await expect.poll(() => page.evaluate((selector) => {
    const heading = document.querySelector(".shell-heading").getBoundingClientRect();
    const section = document.querySelector(selector).getBoundingClientRect();
    return Math.abs(section.top - heading.bottom);
  }, target)).toBeLessThan(24);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
}

async function expectFullHero(page) {
  await expect(page.locator("body")).toHaveAttribute("data-page", "home");
  await expectPageTop(page, ".hero");
  await expect(page.locator("#hero-title")).toHaveText("每一場都打到飛起！");
  for (const selector of [".brand", "#hero-title", ".hero-visual svg", '.hero-actions a[href="#leaderboard"]']) {
    await expect(page.locator(selector)).toBeInViewport({ ratio: 1 });
  }
  await expect.poll(() => page.locator(".hero-copy").evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  await expect.poll(() => page.evaluate(() => {
    const hero = document.querySelector(".hero").getBoundingClientRect();
    const header = document.querySelector(".app-header").getBoundingClientRect();
    const shortcuts = document.querySelector("#homeShortcuts").getBoundingClientRect();
    return hero.height > 120 && hero.top >= header.bottom - 1 &&
      shortcuts.top >= hero.bottom && shortcuts.top - hero.bottom < 40;
  })).toBe(true);
  // A healthy screenshot alone cannot catch WebKit's intermittent compositing
  // failure. The clipping wrapper must never be observed or animated at all.
  expect(await page.evaluate(() => window.heroWrapperEffects)).toEqual([]);
  expect(await page.locator(".hero").evaluate((node) => ({
    transform: getComputedStyle(node).transform,
    opacity: getComputedStyle(node).opacity,
    animations: node.getAnimations().length
  }))).toEqual({ transform: "none", opacity: "1", animations: 0 });
}

for (const reducedMotion of ["no-preference", "reduce"]) {
  test(`390px home hero survives dock hide/show with ${reducedMotion} motion`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion });
    await page.addInitScript(() => {
      window.heroWrapperEffects = [];
      window.heroHeights = [];
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        if (this.matches(".hero")) window.heroWrapperEffects.push("animate");
        return animate.apply(this, args);
      };
      const observe = IntersectionObserver.prototype.observe;
      IntersectionObserver.prototype.observe = function (node) {
        if (node.matches(".hero")) window.heroWrapperEffects.push("observe");
        return observe.call(this, node);
      };
      function sample() {
        const hero = document.querySelector(".hero");
        if (document.body?.dataset.page === "home" && hero && !hero.hidden) {
          window.heroHeights.push(hero.getBoundingClientRect().height);
        }
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    await setup(page);
    await page.evaluate(() => document.fonts.ready);
    await expectFullHero(page);
    const initialHeight = await page.locator(".hero").evaluate((node) => node.offsetHeight);
    await page.screenshot({ path: testInfo.outputPath("hero-home-390.png"), animations: "disabled" });
    for (let visit = 0; visit < 3; visit++) {
      await page.evaluate(() => window.scrollTo(0, 420));
      await page.locator('.mobile-dock a[href="#match"]').click();
      await expect(page.locator(".hero")).toBeHidden();
      await expectPageTop(page, "#match");
      // Both team headings must remain below the shell after the scroll reset.
      await expect(page.locator(".flexible-team h3")).toHaveText(["A 隊", "B 隊"]);
      for (const heading of await page.locator(".flexible-team h3").all()) {
        await expect(heading).toBeInViewport({ ratio: 1 });
      }
      await page.evaluate(() => window.scrollTo(0, 420));
      await page.locator('.mobile-dock a[href="#home"]').click();
      await expectFullHero(page);
      expect(await page.locator(".hero").evaluate((node) => node.offsetHeight)).toBe(initialHeight);
    }
    // Interrupt entrances before the shell's pending frames complete.
    await page.evaluate(() => {
      for (const route of ["match", "home", "match", "home"]) {
        document.querySelector(`.mobile-dock a[href="#${route}"]`).click();
      }
    });
    await expectFullHero(page);
    expect(await page.locator(".hero").evaluate((node) => node.offsetHeight)).toBe(initialHeight);
    await page.screenshot({ path: testInfo.outputPath("hero-home-after-match-390.png"), animations: "disabled" });
    const heights = await page.evaluate(() => window.heroHeights);
    expect(heights.length).toBeGreaterThan(0);
    expect(Math.min(...heights)).toBeGreaterThan(120);
    if (reducedMotion === "reduce") {
      expect(await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length)).toBe(0);
    }
    const metricsPath = testInfo.outputPath("hero-layout.json");
    await writeFile(metricsPath, JSON.stringify({ initialHeight, minHeight: Math.min(...heights), maxHeight: Math.max(...heights), samples: heights.length }, null, 2));
    await testInfo.attach("hero-layout", { contentType: "application/json", path: metricsPath });
  });
}

test("390px routes keep the brand and content together without native anchor gaps", async ({ page }, testInfo) => {
  // Ten full deep-link loads can each wait for external fonts in WebKit.
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.screenshot({ path: testInfo.outputPath("home-390.png"), animations: "disabled" });
  // Reproduce the real bottom-tab journey, including leaving a scrolled home.
  await page.evaluate(() => window.scrollTo(0, 420));
  await page.locator('.mobile-dock a[href="#leaderboard"]').click();
  await expect(page.locator("#leaderboard")).toBeVisible();
  await expectPageTop(page, "#leaderboard");
  await page.screenshot({ path: testInfo.outputPath("leaderboard-from-home-390.png"), animations: "disabled" });
  await page.goBack();
  await expect(page.locator("body")).toHaveAttribute("data-page", "home");
  await expectPageTop(page, ".hero");
  await page.goForward();
  await expectPageTop(page, "#leaderboard");
  // Revisiting a previously scrolled page must also start below the shell.
  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(page.locator(".brand")).toBeInViewport();
  await page.locator('.mobile-dock a[href="#home"]').click();
  await page.locator('.mobile-dock a[href="#leaderboard"]').click();
  await expectPageTop(page, "#leaderboard");
  // Existing programmatic hashes and direct deep links use the same policy.
  for (const route of ["match", "history", "more", "players", "days", "cloud", "backup", "analytics", "access", "activity"]) {
    await page.evaluate((route) => { location.hash = `#${route}`; }, route);
    await expect(page.locator("body")).toHaveAttribute("data-page", route);
    await expect(page.locator(`#${route}`)).toBeVisible();
    await expectPageTop(page, `#${route}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto(`/#${route}`);
    await expect(page.locator("body")).toHaveAttribute("data-page", route);
    await expectPageTop(page, `#${route}`);
  }
});

test("motion celebrates a real save, cleans up and respects reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  const initial = await page.locator(".court-shuttle").evaluate((node) => getComputedStyle(node).transform);
  await expect.poll(() => page.locator(".court-shuttle").evaluate((node) => getComputedStyle(node).transform)).not.toBe(initial);
  await fillMatch(page);
  await page.locator("#saveMatchButton").click();
  await expect(page.locator("#saveConfirmTitle")).toContainText("比賽已儲存");
  await expect(page.locator(".celebration-piece")).toHaveCount(24);
  expect(await page.locator(".celebration-layer").evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none");
  await expect(page.locator(".celebration-layer")).toHaveCount(0, { timeout: 2500 });
  await page.locator("#nextMatchButton").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator('.mobile-dock a[href="#home"]').click();
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length)).toBe(0);
  await fillMatch(page);
  await page.locator("#scoreB").fill("11");
  await page.locator("#saveMatchButton").click();
  await expect(page.locator("#saveConfirmTitle")).toContainText("比賽已儲存");
  await expect(page.locator(".celebration-layer")).toHaveCount(0);
  expect(await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length)).toBe(0);
});

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
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect((await page.locator("#previewButton").boundingBox()).height).toBeLessThanOrEqual(60);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
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

test("home and total leaderboard share ranks, ties and eligibility across navigation and search", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  // Deliberately give a provisional player the highest score and an inactive player 5.00.
  await page.evaluate(() => {
    computedPlayers = () => state.players.map((player, index) => ({
      ...createStats(player), rating: [4, 9, 6, 6, 5, 5, 5][index],
      wins: index < 4 ? [10, 1, 5, 5][index] : 0,
      losses: index < 4 ? [0, 0, 5, 5][index] : 0,
      ratingMatches: index < 4 ? (index === 1 ? 1 : 10) : 0,
      ratingDays: index < 4 ? (index === 1 ? 1 : 3) : 0,
      ratingOpponents: index < 4 ? (index === 1 ? 2 : 5) : 0,
      provisional: index === 1 || index >= 4
    }));
    renderAll();
  });
  const names = ["Tim", "Anson", "Kobo"];
  await expect(page.locator("#homeLeadersContent .home-player strong")).toHaveText(names);
  await expect(page.locator("#homeLeadersContent .home-position")).toHaveText(["1", "1", "3"]);
  await expect(page.locator("#topScore")).toHaveText("6.00");
  await expect(page.locator("#avgScore")).toHaveText("6.25");
  await page.screenshot({ path: testInfo.outputPath("home-ranking-mobile.png"), fullPage: true });
  await page.locator('#homeLeaders .section-heading a').click();
  await expect(page.locator("#leaderboardAllButton")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#mobileLeaderboard .rank")).toHaveText(["1", "1", "3", "4", "–", "–", "–"]);
  const summary = await page.locator("#leaderboardSummary").textContent();
  await page.locator("#mobileLeaderboardToolsButton").click();
  await page.locator("#searchInput").fill("Kobo");
  await expect(page.locator("#mobileLeaderboard .rank")).toHaveText(["3"]);
  await expect(page.locator("#leaderboardSummary")).toHaveText(summary);
  await page.locator("#searchInput").fill("");
  await page.locator("#sortSelect").selectOption("winRate");
  await expect(page.locator("#mobileLeaderboard .rank").first()).toHaveText("3");
  await expect(page.locator("#leaderboardSummary")).toHaveText(summary);
  await page.locator("#leaderboardDayButton").click();
  await page.locator('.mobile-dock a[href="#home"]').click();
  await page.locator("#homeLeadersContent .home-leader").first().click();
  await expect(page.locator("#leaderboardAllButton")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#sortSelect")).toHaveValue("rating");
  await expect(page.locator("#searchInput")).toHaveValue("");
  await expect(page.locator("#mobileLeaderboard .mobile-player-name strong")).toHaveText([...names, "Him", "大Tom", "亮", "Anson y"]);
  await page.screenshot({ path: testInfo.outputPath("total-ranking-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator("#leaderboardBody .rank")).toHaveText(["1", "1", "3", "4", "–", "–", "–"]);
  await page.screenshot({ path: testInfo.outputPath("total-ranking-desktop.png"), fullPage: true });
});

test("journal menu keeps every secondary page reachable and controls touchable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await expect(page.locator('link[rel="stylesheet"][href^="styles.css"]')).toHaveCount(1);
  await expect(page.locator('link[rel="stylesheet"]:not([href^="https:"])')).toHaveCount(1);
  for (const route of ["players", "days", "access", "cloud", "backup", "analytics", "activity"]) {
    await page.locator('.mobile-dock a[href="#more"]').click();
    await expect(page.locator(`#more a[href="#${route}"]`)).toBeVisible();
    await page.locator(`#more a[href="#${route}"]`).click();
    await expect(page.locator("body")).toHaveAttribute("data-page", route);
    await expect(page.locator(`#${route}`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= 390)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${route}-mobile.png`), fullPage: true });
    // Full-page screenshots can trigger entrances for newly intersecting cards.
    // Check the same touch sizes once that temporary scale has settled.
    await expect.poll(() => page.locator('main button:visible, main input:visible, main select:visible, main summary:visible').evaluateAll((nodes) =>
      nodes.filter((node) => node.getBoundingClientRect().height < 44).map((node) => node.id || node.className)), { message: route }).toEqual([]);
  }
  await page.locator('.mobile-dock a[href="#more"]').click();
  await page.screenshot({ path: testInfo.outputPath("more-mobile.png"), fullPage: true });
  await page.locator('#more a[href="#cloud"]').click();
  await expect(page.locator("#cloudBalanceLocal")).toContainText("12");
  await page.locator("#cloudCheckButton").click();
  await expect(page.locator("#cloudHealthTitle")).toContainText("本機");
  await expect(page.locator("#cloudSyncNowButton")).toBeVisible();
  await page.locator("#shellBack").click();
  await page.locator('#more a[href="#backup"]').click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator('button[onclick="return handleExportClick(event)"]').click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.json$/);
});

test("viewer gate, login and logout retain permissions in the journal shell", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, false);
  await page.locator('.mobile-dock a[href="#match"]').click();
  await expect(page.locator("#matchGate")).toBeVisible();
  await page.locator('#matchGate a[href="#access"]').click();
  await page.locator("#adminPasscode").fill("0000");
  await page.locator("#loginButton").click();
  await expect(page.locator("body")).toHaveClass(/viewer-mode/);
  await page.locator("#adminPasscode").fill(await page.evaluate(() => adminPasscode));
  await page.locator("#loginButton").click();
  await expect(page.locator("body")).toHaveClass(/editor-mode/);
  await page.locator('.mobile-dock a[href="#match"]').click();
  await expect(page.locator("#matchGate")).toBeHidden();
  await expect(page.locator("#matchForm")).toBeVisible();
  for (const box of await page.locator(".score-adjust").all()) {
    const size = await box.boundingBox();
    expect(size.width).toBeGreaterThanOrEqual(44);
    expect(size.height).toBeGreaterThanOrEqual(44);
  }
  await page.locator('.mobile-dock a[href="#more"]').click();
  await page.locator('#more a[href="#access"]').click();
  await page.locator("#logoutButton").click();
  await expect(page.locator("body")).toHaveClass(/viewer-mode/);
  await page.locator('.mobile-dock a[href="#match"]').click();
  await expect(page.locator("#matchForm")).toBeHidden();
});
