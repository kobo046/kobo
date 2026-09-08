const appShell = (() => {
  const labels = { home: "首頁", leaderboard: "排行榜", match: "記分", history: "比賽記錄", more: "更多", players: "選手與戰績", access: "管理員模式", cloud: "雲端連線", backup: "備份與還原", analytics: "計分規則", activity: "操作紀錄", days: "比賽日" };
  const fields = ["teamAPlayer1", "teamAPlayer2", "teamBPlayer1", "teamBPlayer2", "scoreA", "scoreB", "matchDate", "matchLocation", "matchNote"];
  const draftKey = "badminton.matchDraft.v1";
  const scrolls = new Map();
  let current = "";
  let ready = false;
  let lastFocus = null;
  let pendingDraft = null;

  function route() {
    const next = Object.hasOwn(labels, location.hash.slice(1)) ? location.hash.slice(1) : "home";
    if (current) scrolls.set(current, window.scrollY);
    current = next;
    document.body.dataset.page = next;
    document.querySelector(".hero").hidden = next !== "home";
    document.querySelectorAll("main > section").forEach((section) => {
      const page = ["homeRecent", "homeLeaders", "homeShortcuts"].includes(section.id) || section.classList.contains("stats-band") ? "home" : section.id === "matchGate" ? "match" : section.id;
      section.hidden = page !== next;
    });
    const primary = ["home", "leaderboard", "match", "history", "more"].includes(next);
    byId("shellTitle").textContent = labels[next];
    byId("shellBack").hidden = primary;
    byId("shellBack").href = next === "days" ? "#history" : "#more";
    const tab = primary ? next : next === "days" ? "history" : "more";
    document.querySelectorAll(".mobile-dock a, .nav-links a").forEach((link) => {
      if (link.hash === `#${tab}`) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    requestAnimationFrame(() => window.scrollTo({ top: scrolls.get(next) || 0, behavior: "instant" }));
    document.title = `${labels[next]} · 羽盟`;
  }

  function updateMatch() {
    const ids = fields.slice(0, 4).map((id) => byId(id).value);
    fields.slice(0, 4).forEach((id) => {
      const select = byId(id);
      [...select.options].forEach((option) => { option.disabled = Boolean(option.value && option.value !== select.value && ids.includes(option.value)); });
    });
    const name = (id) => state.players.find((player) => player.id === id)?.name || "未選";
    byId("matchCheck").textContent = `${ids.slice(0, 2).map(name).join(" / ")}　${byId("scoreA").value || "–"} : ${byId("scoreB").value || "–"}　${ids.slice(2).map(name).join(" / ")}`;
  }

  function saveDraft() {
    if (!ready) return;
    updateMatch();
    try {
      localStorage.setItem(draftKey, JSON.stringify({ editingMatchId, values: Object.fromEntries(fields.map((id) => [id, byId(id).value])) }));
    } catch (_error) {
      byId("matchCheck").textContent += " · 草稿未能暫存，請勿關閉此頁";
    }
  }

  function refresh() {
    const latest = chronologicalMatches(state.matches).at(-1);
    const container = byId("homeRecentContent");
    if (latest) {
      const matches = state.matches.filter((match) => match.date === latest.date);
      const count = new Set(matches.flatMap((match) => [...match.teamAIds, ...match.teamBIds])).size;
      const top = playersForDate(latest.date)[0];
      container.innerHTML = `<p class="home-day">${escapeHtml(latest.date)}<span>${matches.length} 場 · ${count} 位選手</span></p><div class="home-highlight"><span>當日最高分</span><strong>${escapeHtml(top.name)}</strong><b>${formatScore(top.rating)}</b></div><p class="home-caption">最後一場${latest.location ? ` · ${escapeHtml(latest.location)}` : ""}</p><div class="home-result"><span>${escapeHtml(teamLabel(latest.teamAIds))}</span><strong>${latest.scoreA} : ${latest.scoreB}</strong><span>${escapeHtml(teamLabel(latest.teamBIds))}</span></div><a class="home-link" href="#history">查看比賽記錄 →</a>`;
    } else {
      container.innerHTML = '<p class="meta">未有比賽紀錄。</p><a class="secondary-action" href="#match">記錄第一場比賽</a>';
    }
    const leaders = computedPlayers().filter((player) => player.wins + player.losses > 0).sort((a, b) => b.rating - a.rating).slice(0, 3);
    byId("homeLeadersContent").innerHTML = leaders.length ? leaders.map((player, index) => `<a class="home-leader" href="#leaderboard"><span class="home-position">${index + 1}</span><strong>${escapeHtml(player.name)}</strong><small>${player.provisional ? "暫定評級" : "正式評級"}</small><b>${formatScore(player.rating)}</b></a>`).join("") : '<p class="meta">完成比賽後，這裡會顯示最新排名。</p>';
    if (pendingDraft) {
      const draft = pendingDraft;
      fields.forEach((id) => {
        if (typeof draft.values?.[id] === "string") byId(id).value = draft.values[id];
      });
      if (draft.editingMatchId && state.matches.some((match) => match.id === draft.editingMatchId)) {
        editingMatchId = draft.editingMatchId;
        byId("matchFormTitle").textContent = "編輯比賽紀錄";
        byId("saveMatchButton").textContent = "更新比賽";
        byId("cancelEditButton").classList.remove("hidden");
      } else if (draft.editingMatchId) {
        // A missing edited record must not become an accidental new match.
        byId("scoreA").value = "";
        byId("scoreB").value = "";
      }
      pendingDraft = null;
    }
    updateMatch();
    cloudStatus();
  }

  function cloudStatus() {
    const level = typeof cloudConnectionState !== "undefined" ? cloudConnectionState : "checking";
    byId("shellCloud").textContent = { ok: "雲端已連線", error: "連線有問題", local: "本機模式", checking: "正在連線" }[level] || "正在連線";
    byId("shellCloud").dataset.level = level;
  }

  function modal(open) {
    const overlay = byId("saveConfirmOverlay");
    if (open) lastFocus = document.activeElement;
    document.querySelectorAll("body > header, body > main, body > nav, body > footer").forEach((node) => { node.inert = open; });
    document.body.classList.toggle("modal-open", open);
    if (open) overlay.querySelector("button").focus();
    else if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  function init() {
    try { pendingDraft = JSON.parse(localStorage.getItem(draftKey)); } catch (_error) { /* Invalid drafts do not block startup. */ }
    ready = true;
    document.body.classList.add("shell-ready");
    window.lucide?.createIcons();
    refresh();
    route();
    window.addEventListener("hashchange", route);
    byId("matchForm").addEventListener("input", saveDraft);
    byId("matchForm").addEventListener("change", saveDraft);
    window.addEventListener("pagehide", saveDraft);
    new MutationObserver(cloudStatus).observe(byId("cloudHealthTitle"), { childList: true, characterData: true, subtree: true });
    byId("saveConfirmOverlay").addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const buttons = [...byId("saveConfirmOverlay").querySelectorAll("button")];
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  return { init, refresh, saveDraft, modal };
})();
