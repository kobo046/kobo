const storageKey = "badmintonPlayerRating.v2";
const minRating = 0;
const initialRating = 5;
const maxRating = 10;
const baseK = 0.45;

const seedData = {
  players: [
    { id: "p1", name: "林柏辰", gender: "男" },
    { id: "p2", name: "陳昱安", gender: "男" },
    { id: "p3", name: "王品妤", gender: "女" },
    { id: "p4", name: "張筱涵", gender: "女" },
    { id: "p5", name: "黃子豪", gender: "男" },
    { id: "p6", name: "吳佳蓉", gender: "女" }
  ],
  matches: []
};

let state = loadState();
let selectedPlayerId = state.players.length ? state.players[0].id : "";
let editingMatchId = "";
let matchSummaries = [];

function byId(id) {
  return document.getElementById(id);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatScore(value) {
  return Number(value).toFixed(2);
}

function createStats(player) {
  return {
    id: String(player.id),
    name: String(player.name),
    gender: player.gender === "女" ? "女" : "男",
    rating: initialRating,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    recent: "-"
  };
}

function normalizeState(input) {
  const rawPlayers = Array.isArray(input.players) ? input.players : [];
  const players = rawPlayers
    .filter((player) => player && player.id && player.name)
    .map((player) => ({
      id: String(player.id),
      name: String(player.name),
      gender: player.gender === "女" ? "女" : "男"
    }));

  const playerIds = new Set(players.map((player) => player.id));
  const rawMatches = Array.isArray(input.matches) ? input.matches : [];
  const matches = rawMatches
    .filter((match) => {
      const ids = [...(match.teamAIds || []), ...(match.teamBIds || [])];
      return (
        match &&
        match.id &&
        Array.isArray(match.teamAIds) &&
        Array.isArray(match.teamBIds) &&
        match.teamAIds.length === 2 &&
        match.teamBIds.length === 2 &&
        ids.every((id) => playerIds.has(id)) &&
        new Set(ids).size === 4 &&
        Number(match.scoreA) !== Number(match.scoreB)
      );
    })
    .map((match) => ({
      id: String(match.id),
      date: match.date || new Date().toISOString().slice(0, 10),
      teamAIds: match.teamAIds.map(String),
      teamBIds: match.teamBIds.map(String),
      scoreA: Number(match.scoreA),
      scoreB: Number(match.scoreB)
    }));

  return {
    players: players.length ? players : clone(seedData.players),
    matches
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && saved.players) return normalizeState(saved);
  } catch (error) {
    localStorage.removeItem(storageKey);
  }
  return normalizeState(clone(seedData));
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function setStatus(message, isError = false) {
  const status = byId("appStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function basePlayer(id) {
  return state.players.find((player) => player.id === id);
}

function currentPlayer(id) {
  return computedPlayers().find((player) => player.id === id);
}

function playerName(id) {
  const player = basePlayer(id);
  return player ? player.name : "未知選手";
}

function teamLabel(ids) {
  return ids.map(playerName).join(" / ");
}

function selectedPlayerIds() {
  return [
    byId("teamAPlayer1").value,
    byId("teamAPlayer2").value,
    byId("teamBPlayer1").value,
    byId("teamBPlayer2").value
  ];
}

function expectedWinRate(teamRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - teamRating) / 4));
}

function averageRating(ids, players) {
  const total = ids.reduce((sum, id) => sum + players.find((player) => player.id === id).rating, 0);
  return total / ids.length;
}

function calculateMatchChange(teamAIds, teamBIds, scoreA, scoreB, players) {
  const teamARating = averageRating(teamAIds, players);
  const teamBRating = averageRating(teamBIds, players);
  const expectedA = expectedWinRate(teamARating, teamBRating);
  const actualA = scoreA > scoreB ? 1 : 0;
  const pointDiff = Math.abs(scoreA - scoreB);
  const winnerScore = Math.max(scoreA, scoreB, 1);
  const marginRatio = Math.min(pointDiff / winnerScore, 0.75);
  const marginMultiplier = 1 + marginRatio;
  const rawChangeA = baseK * marginMultiplier * (actualA - expectedA);
  const changeA = clamp(rawChangeA, -0.9, 0.9);

  return {
    actualA,
    expectedA,
    marginMultiplier,
    changeA,
    changeB: -changeA
  };
}

function applyMatch(players, match) {
  const result = calculateMatchChange(match.teamAIds, match.teamBIds, match.scoreA, match.scoreB, players);
  const aWins = match.scoreA > match.scoreB;
  const playerChanges = {};

  const nextPlayers = players.map((player) => {
    const isA = match.teamAIds.includes(player.id);
    const isB = match.teamBIds.includes(player.id);
    if (!isA && !isB) return player;

    const change = isA ? result.changeA : result.changeB;
    const pointsFor = isA ? match.scoreA : match.scoreB;
    const pointsAgainst = isA ? match.scoreB : match.scoreA;
    const won = isA ? aWins : !aWins;
    playerChanges[player.id] = change;

    return {
      ...player,
      rating: clamp(player.rating + change, minRating, maxRating),
      wins: player.wins + (won ? 1 : 0),
      losses: player.losses + (won ? 0 : 1),
      pointsFor: player.pointsFor + pointsFor,
      pointsAgainst: player.pointsAgainst + pointsAgainst,
      recent: match.date
    };
  });

  return { players: nextPlayers, result, playerChanges };
}

function recompute() {
  let players = state.players.map(createStats);
  const summaries = [];

  state.matches.forEach((match) => {
    const before = clone(players);
    const applied = applyMatch(players, match);
    players = applied.players;
    summaries.push({
      ...match,
      result: applied.result,
      playerChanges: applied.playerChanges,
      before
    });
  });

  matchSummaries = summaries;
  return players;
}

function computedPlayers() {
  return recompute();
}

function winRate(player) {
  const played = player.wins + player.losses;
  return played ? Math.round((player.wins / played) * 100) : 0;
}

function sortedPlayers() {
  const query = byId("searchInput").value.trim().toLowerCase();
  const sort = byId("sortSelect").value;
  return computedPlayers()
    .filter((player) => player.name.toLowerCase().includes(query))
    .sort((a, b) => {
      if (sort === "winRate") return winRate(b) - winRate(a);
      if (sort === "matches") return b.wins + b.losses - (a.wins + a.losses);
      if (sort === "recent") return new Date(b.recent || 0) - new Date(a.recent || 0);
      return b.rating - a.rating;
    });
}

function renderStats() {
  const players = computedPlayers();
  const scores = players.map((player) => player.rating);
  const avg = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : initialRating;
  byId("totalPlayers").textContent = state.players.length;
  byId("totalMatches").textContent = state.matches.length;
  byId("topScore").textContent = formatScore(scores.length ? Math.max(...scores) : initialRating);
  byId("avgScore").textContent = formatScore(avg);
}

function renderLeaderboard() {
  const rows = sortedPlayers();
  byId("leaderboardBody").innerHTML = rows.length
    ? rows
        .map((player, index) => {
          const played = player.wins + player.losses;
          const pointDiff = player.pointsFor - player.pointsAgainst;
          return `
            <tr>
              <td><span class="rank">${index + 1}</span></td>
              <td>
                <div class="team-name">${player.name}</div>
                <div class="members">${player.gender}</div>
              </td>
              <td><span class="score-pill">${formatScore(player.rating)}</span></td>
              <td>${winRate(player)}%</td>
              <td>${player.wins} 勝 ${player.losses} 敗 <span class="meta">/ ${played} 場</span></td>
              <td>${player.pointsFor}:${player.pointsAgainst} <span class="meta">(${pointDiff >= 0 ? "+" : ""}${pointDiff})</span></td>
              <td>${player.recent}</td>
              <td><button class="mini-danger" type="button" onclick="return handleDeletePlayerClick(event, '${player.id}')">刪除</button></td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="8">未有選手資料。</td></tr>`;
}

function renderPlayers() {
  const players = computedPlayers();
  byId("playerList").innerHTML = players
    .map(
      (player) => `
      <button class="player-card ${player.id === selectedPlayerId ? "active" : ""}" type="button" data-player="${player.id}">
        <span class="avatar">${player.name.slice(0, 1)}</span>
        <strong>${player.name}</strong>
        <span class="meta">${player.gender} · ${formatScore(player.rating)} 分 · ${player.wins + player.losses} 場</span>
        <span class="meta">得失分：${player.pointsFor}:${player.pointsAgainst}</span>
        <span class="card-actions">
          <span class="mini-danger" onclick="return handleDeletePlayerClick(event, '${player.id}')">刪除</span>
        </span>
      </button>
    `
    )
    .join("");

  document.querySelectorAll(".player-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedPlayerId = card.dataset.player;
      renderPlayers();
      renderPlayerDetail();
    });
  });
}

function renderPlayerDetail() {
  const player = currentPlayer(selectedPlayerId);
  if (!player) {
    byId("playerDetail").innerHTML = "<p>請先新增選手。</p>";
    return;
  }
  const played = player.wins + player.losses;
  byId("playerDetail").innerHTML = `
    <span class="avatar">${player.name.slice(0, 1)}</span>
    <h3>${player.name}</h3>
    <p class="meta">${player.gender}</p>
    <div class="partner-row"><strong>目前分數</strong><span class="score-pill">${formatScore(player.rating)}</span></div>
    <div class="partner-row"><strong>勝率</strong><span>${winRate(player)}%</span></div>
    <div class="partner-row"><strong>戰績</strong><span>${player.wins} 勝 ${player.losses} 敗</span></div>
    <div class="partner-row"><strong>得失分</strong><span>${player.pointsFor}:${player.pointsAgainst}</span></div>
    <p class="meta">${played ? `最近比賽：${player.recent}` : "尚未有比賽紀錄。"}</p>
  `;
}

function renderPlayerOptions() {
  const options = state.players.map((player) => `<option value="${player.id}">${player.name}</option>`).join("");
  const selectIds = ["teamAPlayer1", "teamAPlayer2", "teamBPlayer1", "teamBPlayer2"];
  const previousValues = selectIds.map((id) => byId(id).value);

  selectIds.forEach((id, index) => {
    const select = byId(id);
    const previous = previousValues[index];
    select.innerHTML = options;
    if (previous && state.players.some((player) => player.id === previous)) select.value = previous;
  });

  if (state.players.length >= 4) {
    const values = selectIds.map((id) => byId(id).value);
    if (new Set(values).size !== 4 || values.some((value) => !value)) {
      byId("teamAPlayer1").value = state.players[0].id;
      byId("teamAPlayer2").value = state.players[1].id;
      byId("teamBPlayer1").value = state.players[2].id;
      byId("teamBPlayer2").value = state.players[3].id;
    }
  }
}

function renderHistory() {
  recompute();
  byId("historyBody").innerHTML = matchSummaries.length
    ? [...matchSummaries]
        .reverse()
        .map((match) => {
          const changedNames = [...match.teamAIds, ...match.teamBIds]
            .map((id) => `${playerName(id)} ${match.playerChanges[id] >= 0 ? "+" : ""}${match.playerChanges[id].toFixed(2)}`)
            .join("<br>");
          return `
            <tr>
              <td>${match.date}</td>
              <td>${teamLabel(match.teamAIds)}</td>
              <td>${teamLabel(match.teamBIds)}</td>
              <td><strong>${match.scoreA}:${match.scoreB}</strong></td>
              <td class="meta">${changedNames}</td>
              <td class="action-cell">
                <button class="mini-action" type="button" onclick="return handleEditMatchClick(event, '${match.id}')">編輯</button>
                <button class="mini-danger" type="button" onclick="return handleDeleteMatchClick(event, '${match.id}')">刪除</button>
              </td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="6">未有比賽紀錄。</td></tr>`;
}

function renderRuleCards() {
  byId("ruleCards").innerHTML = `
    <article class="team-card">
      <h3>基本分</h3>
      <p class="meta">每位新選手由 5.00 分開始，最低 0 分，最高 10 分。</p>
      <div class="bar"><span style="width: 50%"></span></div>
      <strong>新手起點：5.00 / 10</strong>
    </article>
    <article class="team-card">
      <h3>比分差距</h3>
      <p class="meta">贏得愈大，例如 21:8，勝方加分更多，敗方扣分更多；21:20 則變動較小。</p>
      <div class="bar"><span style="width: 72%"></span></div>
      <strong>分差會放大加扣分</strong>
    </article>
    <article class="team-card">
      <h3>爆冷修正</h3>
      <p class="meta">高分隊輸給低分隊會扣更多；低分隊打贏高分隊會加更多。</p>
      <div class="bar"><span style="width: 86%"></span></div>
      <strong>用類 Elo 預期勝率計算</strong>
    </article>
    <article class="team-card">
      <h3>歷史重算</h3>
      <p class="meta">編輯或刪除舊比賽後，系統會由第一場開始重新計算所有人的分數。</p>
      <div class="bar"><span style="width: 64%"></span></div>
      <strong>修正錯誤更可靠</strong>
    </article>
  `;
}

function validateMatchSelection() {
  if (state.players.length < 4) return "至少需要 4 位選手才可以新增雙打比賽。";
  const ids = selectedPlayerIds();
  if (ids.some((id) => !id)) return "請選齊 4 位選手。";
  if (new Set(ids).size !== 4) return "同一場比賽必須選 4 位不同選手。";
  return "";
}

function readMatchForm() {
  return {
    id: editingMatchId || `m-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    teamAIds: [byId("teamAPlayer1").value, byId("teamAPlayer2").value],
    teamBIds: [byId("teamBPlayer1").value, byId("teamBPlayer2").value],
    scoreA: Number(byId("scoreA").value),
    scoreB: Number(byId("scoreB").value)
  };
}

function renderPreview() {
  const preview = byId("ratingPreview");
  const error = validateMatchSelection();
  if (error) {
    preview.className = "preview-box visible";
    preview.innerHTML = `<strong>${error}</strong>`;
    setStatus(error, true);
    return null;
  }

  const match = readMatchForm();
  if (match.scoreA === match.scoreB) {
    preview.className = "preview-box visible";
    preview.innerHTML = "<strong>比分不能平手，請確認比賽結果。</strong>";
    setStatus("比分不能平手，請確認比賽結果。", true);
    return null;
  }

  const previewPlayers = computedPlayers();
  const result = calculateMatchChange(match.teamAIds, match.teamBIds, match.scoreA, match.scoreB, previewPlayers);
  const winners = result.actualA === 1 ? match.teamAIds : match.teamBIds;
  const rows = [...match.teamAIds, ...match.teamBIds]
    .map((id) => {
      const player = previewPlayers.find((item) => item.id === id);
      const change = match.teamAIds.includes(id) ? result.changeA : result.changeB;
      return `<p class="meta">${player.name}：${formatScore(player.rating)} → ${formatScore(clamp(player.rating + change, minRating, maxRating))} (${change >= 0 ? "+" : ""}${change.toFixed(2)})</p>`;
    })
    .join("");

  preview.className = "preview-box visible";
  preview.innerHTML = `
    <strong>${winners.map(playerName).join(" / ")} 勝出</strong>
    <p class="meta">比分差距倍率：${result.marginMultiplier.toFixed(2)} · A 隊預期勝率：${Math.round(result.expectedA * 100)}%</p>
    ${rows}
  `;
  setStatus("試算完成。按「儲存比賽」先會正式寫入。");
  return match;
}

function saveMatch(event) {
  if (event) event.preventDefault();
  const match = renderPreview();
  if (!match) return;

  if (editingMatchId) {
    state.matches = state.matches.map((item) => (item.id === editingMatchId ? { ...match, id: editingMatchId } : item));
    setStatus("比賽已更新，排行榜已重新計算。");
  } else {
    state.matches.push(match);
    setStatus(`比賽已儲存。目前共有 ${state.matches.length} 場比賽。`);
  }

  editingMatchId = "";
  saveState();
  clearMatchEditingUi();
  renderAll();
  byId("ratingPreview").className = "preview-box visible";
  byId("ratingPreview").innerHTML = "<strong>比賽已儲存，個人排行榜已更新。</strong>";
}

function addPlayer(event) {
  if (event) event.preventDefault();
  const nameInput = byId("newPlayerName");
  const name = nameInput.value.trim();
  if (!name) {
    setStatus("請先輸入選手姓名。", true);
    return;
  }
  if (state.players.some((player) => player.name === name)) {
    setStatus(`${name} 已經存在。`, true);
    return;
  }

  const player = {
    id: `p-${Date.now()}`,
    name,
    gender: byId("newPlayerGender").value
  };
  state.players.push(player);
  selectedPlayerId = player.id;
  nameInput.value = "";
  saveState();
  renderAll();
  setStatus(`已新增選手：${player.name}，初始分數 ${formatScore(initialRating)}。`);
}

function deletePlayer(playerId) {
  const player = basePlayer(playerId);
  if (!player) return;
  const relatedMatches = state.matches.filter((match) => [...match.teamAIds, ...match.teamBIds].includes(playerId)).length;
  const confirmed = window.confirm(`確定刪除選手「${player.name}」？會同時刪除 ${relatedMatches} 場包含此選手的比賽紀錄。`);
  if (!confirmed) return;
  state.players = state.players.filter((item) => item.id !== playerId);
  state.matches = state.matches.filter((match) => ![...match.teamAIds, ...match.teamBIds].includes(playerId));
  if (selectedPlayerId === playerId) selectedPlayerId = state.players.length ? state.players[0].id : "";
  saveState();
  renderAll();
  setStatus(`已刪除選手：${player.name}`);
}

function editMatch(matchId) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match) return;
  editingMatchId = matchId;
  byId("teamAPlayer1").value = match.teamAIds[0];
  byId("teamAPlayer2").value = match.teamAIds[1];
  byId("teamBPlayer1").value = match.teamBIds[0];
  byId("teamBPlayer2").value = match.teamBIds[1];
  byId("scoreA").value = match.scoreA;
  byId("scoreB").value = match.scoreB;
  byId("matchFormTitle").textContent = "編輯比賽紀錄";
  byId("saveMatchButton").textContent = "更新比賽";
  byId("cancelEditButton").classList.remove("hidden");
  setStatus("正在編輯舊比賽。修改後按「更新比賽」。");
  location.hash = "#match";
  renderPreview();
}

function deleteMatch(matchId) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match) return;
  const confirmed = window.confirm(`確定刪除 ${match.date} 的比賽紀錄 ${teamLabel(match.teamAIds)} ${match.scoreA}:${match.scoreB} ${teamLabel(match.teamBIds)}？`);
  if (!confirmed) return;
  state.matches = state.matches.filter((item) => item.id !== matchId);
  if (editingMatchId === matchId) clearMatchEditingUi();
  saveState();
  renderAll();
  setStatus("比賽已刪除，排行榜已重新計算。");
}

function clearMatchEditingUi() {
  editingMatchId = "";
  byId("matchFormTitle").textContent = "新增比賽紀錄";
  byId("saveMatchButton").textContent = "儲存比賽";
  byId("cancelEditButton").classList.add("hidden");
}

function resetData() {
  const confirmed = window.confirm("會清除目前瀏覽器已儲存的比賽同選手資料，並回復示範資料。確定要繼續？");
  if (!confirmed) return;
  state = normalizeState(clone(seedData));
  selectedPlayerId = state.players[0].id;
  clearMatchEditingUi();
  saveState();
  renderAll();
  setStatus("已重設示範資料。");
}

function exportBackup() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    players: state.players,
    matches: state.matches
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `badminton-rating-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus("已匯出備份。");
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      state = normalizeState(imported);
      selectedPlayerId = state.players.length ? state.players[0].id : "";
      clearMatchEditingUi();
      saveState();
      renderAll();
      setStatus("備份已匯入，排行榜已重新計算。");
    } catch (error) {
      setStatus(`匯入失敗：${error.message}`, true);
    }
  };
  reader.readAsText(file);
}

function bindEvents() {
  byId("searchInput").addEventListener("input", renderLeaderboard);
  byId("sortSelect").addEventListener("change", renderLeaderboard);
  byId("previewButton").addEventListener("click", () => renderPreview());
  byId("matchForm").addEventListener("submit", saveMatch);
  byId("playerForm").addEventListener("submit", addPlayer);
  byId("resetButton").addEventListener("click", resetData);
}

function handleAddPlayerClick(event) {
  try {
    addPlayer(event);
  } catch (error) {
    setStatus(`新增選手失敗：${error.message}`, true);
    console.error(error);
  }
  return false;
}

function handlePreviewClick(event) {
  if (event) event.preventDefault();
  try {
    renderPreview();
  } catch (error) {
    setStatus(`試算失敗：${error.message}`, true);
    console.error(error);
  }
  return false;
}

function handleSaveMatchClick(event) {
  try {
    saveMatch(event);
  } catch (error) {
    setStatus(`儲存比賽失敗：${error.message}`, true);
    console.error(error);
  }
  return false;
}

function handleCancelEditClick(event) {
  if (event) event.preventDefault();
  clearMatchEditingUi();
  byId("ratingPreview").className = "preview-box";
  setStatus("已取消編輯。");
  return false;
}

function handleEditMatchClick(event, matchId) {
  if (event) event.preventDefault();
  editMatch(matchId);
  return false;
}

function handleDeleteMatchClick(event, matchId) {
  if (event) event.preventDefault();
  deleteMatch(matchId);
  return false;
}

function handleDeletePlayerClick(event, playerId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  deletePlayer(playerId);
  return false;
}

function handleResetClick(event) {
  if (event) event.preventDefault();
  resetData();
  return false;
}

function handleExportClick(event) {
  if (event) event.preventDefault();
  exportBackup();
  return false;
}

function handleImportFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (file) importBackup(file);
  event.target.value = "";
  return false;
}

window.handleAddPlayerClick = handleAddPlayerClick;
window.handlePreviewClick = handlePreviewClick;
window.handleSaveMatchClick = handleSaveMatchClick;
window.handleCancelEditClick = handleCancelEditClick;
window.handleEditMatchClick = handleEditMatchClick;
window.handleDeleteMatchClick = handleDeleteMatchClick;
window.handleDeletePlayerClick = handleDeletePlayerClick;
window.handleResetClick = handleResetClick;
window.handleExportClick = handleExportClick;
window.handleImportFileChange = handleImportFileChange;
window.addEventListener("error", (event) => {
  setStatus(`程式錯誤：${event.message}`, true);
});

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
