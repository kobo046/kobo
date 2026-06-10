let state = normalizeState(clone(seedData));
let selectedPlayerId = state.players.length ? state.players[0].id : "";
let editingMatchId = "";
let matchSummaries = [];
let historyMode = "all";
let selectedHistoryDate = "";
let leaderboardMode = "all";
let selectedLeaderboardDate = "";

function renderAll() {
  renderStats();
  renderLeaderboard();
  renderPlayers();
  renderPlayerDetail();
  renderPlayerOptions();
  renderHistory();
  renderRuleCards();
}

async function initializeApp() {
  if (typeof initializeAuth === "function") {
    await initializeAuth();
  }
  state = await loadState();
  selectedPlayerId = state.players.length ? state.players[0].id : "";
  bindEvents();
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
  setStatus(storageModeLabel());
}

initializeApp().catch((error) => {
  console.error(error);
  setStatus(`系統載入失敗：${error.message}`, true);
});
