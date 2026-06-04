let state = loadState();
let selectedPlayerId = state.players.length ? state.players[0].id : "";
let editingMatchId = "";
let matchSummaries = [];

function renderAll() {
  renderStats();
  renderLeaderboard();
  renderPlayers();
  renderPlayerDetail();
  renderPlayerOptions();
  renderHistory();
  renderRuleCards();
}

bindEvents();
renderAll();
setStatus("系統已載入，可以新增選手同比賽。");
