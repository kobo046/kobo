let state = normalizeState(clone(seedData));
let selectedPlayerId = state.players.length ? state.players[0].id : "";
let editingMatchId = "";
let matchSummaries = [];
let historyMode = "all";
let selectedHistoryDate = "";
let leaderboardMode = "all";
let selectedLeaderboardDate = "";
let historyExpanded = false;
let activityExpanded = false;
let appInitialized = false;

function renderAll() {
  renderStats();
  renderLeaderboard();
  renderDayOverview();
  renderPlayers();
  renderPlayerDetail();
  renderPlayerOptions();
  renderHistory();
  renderActivityLog();
  renderRuleCards();
  if (typeof appShell !== "undefined") appShell.refresh();
  if (typeof updateCloudFacts === "function" && typeof cloudConnectionState !== "undefined") {
    updateCloudFacts(cloudConnectionState);
  }
}

async function initializeApp() {
  if (typeof initializeAuth === "function") {
    await initializeAuth();
  }
  state = loadLocalState();
  selectedPlayerId = state.players.length ? state.players[0].id : "";
  bindEvents();
  renderAll();
  if (typeof appShell !== "undefined") appShell.init();
  if (typeof updateAuthUi === "function") updateAuthUi();
  setStatus(window.cloudSync && window.cloudSync.isConfigured() ? "正在連接雲端，畫面先顯示本機資料。" : storageModeLabel());

  state = await loadState();
  selectedPlayerId = state.players.length ? state.players[0].id : "";
  renderAll();
  if (typeof updateAuthUi === "function") updateAuthUi();
  subscribeToStateChanges(() => {
    if (!state.players.some((player) => player.id === selectedPlayerId)) {
      selectedPlayerId = state.players.length ? state.players[0].id : "";
    }
    renderAll();
    if (typeof updateAuthUi === "function") updateAuthUi();
    setStatus("雲端資料已更新，排行榜已同步。");
  });
  setStatus(storageModeLabel(), typeof isCloudConnectionError === "function" && isCloudConnectionError());
  appInitialized = true;
}

initializeApp().catch((error) => {
  console.error(error);
  setStatus(`系統載入失敗：${error.message}`, true);
});
