const storageKey = "badmintonPlayerRating.v1";
const minRating = 0;
const initialRating = 5;
const maxRating = 10;
const baseK = 0.45;

const seedData = {
  players: [
    { id: "p1", name: "林柏辰", gender: "男", rating: 5, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, recent: "-" },
    { id: "p2", name: "陳昱安", gender: "男", rating: 5, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, recent: "-" },
    { id: "p3", name: "王品妤", gender: "女", rating: 5, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, recent: "-" },
    { id: "p4", name: "張筱涵", gender: "女", rating: 5, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, recent: "-" },
    { id: "p5", name: "黃子豪", gender: "男", rating: 5, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, recent: "-" },
    { id: "p6", name: "吳佳蓉", gender: "女", rating: 5, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, recent: "-" }
  ],
  matchesRecorded: 0
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byId(id) {
  return document.getElementById(id);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatScore(value) {
  return Number(value).toFixed(2);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && saved.players && saved.players.length) return normalizeState(saved);
  } catch (error) {
    localStorage.removeItem(storageKey);
  }
  return normalizeState(clone(seedData));
}

function normalizeState(input) {
  const players = Array.isArray(input.players) ? input.players : [];
  const normalizedPlayers = players
    .filter((player) => player && player.id && player.name)
    .map((player) => ({
      id: String(player.id),
      name: String(player.name),
      gender: player.gender === "女" ? "女" : "男",
      rating: clamp(Number(player.rating || initialRating), minRating, maxRating),
      wins: Number(player.wins || 0),
      losses: Number(player.losses || 0),
      pointsFor: Number(player.pointsFor || 0),
      pointsAgainst: Number(player.pointsAgainst || 0),
      recent: player.recent || "-"
    }));

  return {
    players: normalizedPlayers.length ? normalizedPlayers : clone(seedData.players),
    matchesRecorded: Number(input.matchesRecorded || 0)
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

let state = loadState();
let selectedPlayerId = state.players.length ? state.players[0].id : "";

function setStatus(message, isError = false) {
  const status = byId("appStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function getPlayer(id) {
  return state.players.find((player) => player.id === id);
}

function selectedPlayerIds() {
  return [
    byId("teamAPlayer1").value,
    byId("teamAPlayer2").value,
    byId("teamBPlayer1").value,
    byId("teamBPlayer2").value
  ];
}

function averageRating(ids) {
  const total = ids.reduce((sum, id) => sum + getPlayer(id).rating, 0);
  return total / ids.length;
}

function expectedWinRate(teamRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - teamRating) / 4));
}

function calculateMatchChange(teamAIds, teamBIds, scoreA, scoreB) {
  const teamARating = averageRating(teamAIds);
  const teamBRating = averageRating(teamBIds);
  const expectedA = expectedWinRate(teamARating, teamBRating);
  const actualA = scoreA > scoreB ? 1 : 0;
  const pointDiff = Math.abs(scoreA - scoreB);
  const winnerScore = Math.max(scoreA, scoreB, 1);
  const marginRatio = Math.min(pointDiff / winnerScore, 0.75);
  const marginMultiplier = 1 + marginRatio;
  const rawChangeA = baseK * marginMultiplier * (actualA - expectedA);
  const changeA = clamp(rawChangeA, -0.9, 0.9);
  const changeB = -changeA;

  return {
    actualA,
    expectedA,
    expectedB: 1 - expectedA,
    marginMultiplier,
    changeA,
    changeB
  };
}

function winRate(player) {
  const played = player.wins + player.losses;
  return played ? Math.round((player.wins / played) * 100) : 0;
}

function sortedPlayers() {
  const query = byId("searchInput").value.trim().toLowerCase();
  const sort = byId("sortSelect").value;
  return [...state.players]
    .filter((player) => player.name.toLowerCase().includes(query))
    .sort((a, b) => {
      if (sort === "winRate") return winRate(b) - winRate(a);
      if (sort === "matches") return b.wins + b.losses - (a.wins + a.losses);
      if (sort === "recent") return new Date(b.recent || 0) - new Date(a.recent || 0);
      return b.rating - a.rating;
    });
}

function renderStats() {
  const scores = state.players.map((player) => player.rating);
  const avg = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : initialRating;
  byId("totalPlayers").textContent = state.players.length;
  byId("totalMatches").textContent = state.matchesRecorded;
  byId("topScore").textContent = formatScore(scores.length ? Math.max(...scores) : initialRating);
  byId("avgScore").textContent = formatScore(avg);
}

function renderLeaderboard() {
  const body = byId("leaderboardBody");
  const rows = sortedPlayers();
  body.innerHTML = rows.length
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
  const list = byId("playerList");
  list.innerHTML = state.players
    .map((player) => `
      <button class="player-card ${player.id === selectedPlayerId ? "active" : ""}" type="button" data-player="${player.id}">
        <span class="avatar">${player.name.slice(0, 1)}</span>
        <strong>${player.name}</strong>
        <span class="meta">${player.gender} · ${formatScore(player.rating)} 分 · ${player.wins + player.losses} 場</span>
        <span class="meta">得失分：${player.pointsFor}:${player.pointsAgainst}</span>
        <span class="card-actions">
          <span class="mini-danger" onclick="return handleDeletePlayerClick(event, '${player.id}')">刪除</span>
        </span>
      </button>
    `)
    .join("");

  list.querySelectorAll(".player-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedPlayerId = card.dataset.player;
      renderPlayers();
      renderPlayerDetail();
    });
  });
}

function renderPlayerDetail() {
  const player = getPlayer(selectedPlayerId);
  if (!player) {
    byId("playerDetail").innerHTML = "<p>請先新增選手。</p>";
    return;
  }
  const played = player.wins + player.losses;
  byId("playerDetail").innerHTML = `
    <span class="avatar">${player.name.slice(0, 1)}</span>
    <h3>${player.name}</h3>
    <p class="meta">${player.gender}</p>
    <div class="partner-row">
      <strong>目前分數</strong>
      <span class="score-pill">${formatScore(player.rating)}</span>
    </div>
    <div class="partner-row">
      <strong>勝率</strong>
      <span>${winRate(player)}%</span>
    </div>
    <div class="partner-row">
      <strong>戰績</strong>
      <span>${player.wins} 勝 ${player.losses} 敗</span>
    </div>
    <div class="partner-row">
      <strong>得失分</strong>
      <span>${player.pointsFor}:${player.pointsAgainst}</span>
    </div>
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
      <h3>單場上限</h3>
      <p class="meta">單場每人最多約加或扣 0.90 分，避免一次比賽令排名失真。</p>
      <div class="bar"><span style="width: 45%"></span></div>
      <strong>穩定但有感</strong>
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

function renderPreview() {
  const preview = byId("ratingPreview");
  const error = validateMatchSelection();
  if (error) {
    preview.className = "preview-box visible";
    preview.innerHTML = `<strong>${error}</strong>`;
    setStatus(error, true);
    return null;
  }

  const scoreA = Number(byId("scoreA").value);
  const scoreB = Number(byId("scoreB").value);
  if (scoreA === scoreB) {
    preview.className = "preview-box visible";
    preview.innerHTML = "<strong>比分不能平手，請確認比賽結果。</strong>";
    setStatus("比分不能平手，請確認比賽結果。", true);
    return null;
  }

  const teamAIds = [byId("teamAPlayer1").value, byId("teamAPlayer2").value];
  const teamBIds = [byId("teamBPlayer1").value, byId("teamBPlayer2").value];
  const result = calculateMatchChange(teamAIds, teamBIds, scoreA, scoreB);
  const teamAChange = result.changeA;
  const teamBChange = result.changeB;
  const winners = result.actualA === 1 ? teamAIds : teamBIds;

  const rows = [...teamAIds, ...teamBIds]
    .map((id) => {
      const player = getPlayer(id);
      const change = teamAIds.includes(id) ? teamAChange : teamBChange;
      return `<p class="meta">${player.name}：${formatScore(player.rating)} → ${formatScore(clamp(player.rating + change, minRating, maxRating))} (${change >= 0 ? "+" : ""}${change.toFixed(2)})</p>`;
    })
    .join("");

  preview.className = "preview-box visible";
  preview.innerHTML = `
    <strong>${winners.map((id) => getPlayer(id).name).join(" / ")} 勝出</strong>
    <p class="meta">比分差距倍率：${result.marginMultiplier.toFixed(2)} · A 隊預期勝率：${Math.round(result.expectedA * 100)}%</p>
    ${rows}
  `;
  setStatus("試算完成。按「儲存比賽」先會正式寫入。");
  return { teamAIds, teamBIds, scoreA, scoreB, result };
}

function saveMatch(event) {
  if (event) event.preventDefault();
  const preview = renderPreview();
  if (!preview) return;

  const today = new Date().toISOString().slice(0, 10);
  const aWins = preview.scoreA > preview.scoreB;
  state.players = state.players.map((player) => {
    const isA = preview.teamAIds.includes(player.id);
    const isB = preview.teamBIds.includes(player.id);
    if (!isA && !isB) return player;

    const change = isA ? preview.result.changeA : preview.result.changeB;
    const pointsFor = isA ? preview.scoreA : preview.scoreB;
    const pointsAgainst = isA ? preview.scoreB : preview.scoreA;
    const won = isA ? aWins : !aWins;

    return {
      ...player,
      rating: clamp(player.rating + change, minRating, maxRating),
      wins: player.wins + (won ? 1 : 0),
      losses: player.losses + (won ? 0 : 1),
      pointsFor: player.pointsFor + pointsFor,
      pointsAgainst: player.pointsAgainst + pointsAgainst,
      recent: today
    };
  });

  state.matchesRecorded += 1;
  saveState();
  renderAll();
  byId("ratingPreview").className = "preview-box visible";
  byId("ratingPreview").innerHTML = "<strong>比賽已儲存，個人排行榜已更新。</strong>";
  setStatus(`比賽已儲存。目前共有 ${state.matchesRecorded} 場比賽。`);
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
    gender: byId("newPlayerGender").value,
    rating: initialRating,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    recent: "-"
  };
  state.players.push(player);
  selectedPlayerId = player.id;
  nameInput.value = "";
  saveState();
  renderAll();
  setStatus(`已新增選手：${player.name}，初始分數 ${formatScore(initialRating)}。`);
}

function deletePlayer(playerId) {
  const player = getPlayer(playerId);
  if (!player) return;
  const confirmed = window.confirm(`確定刪除選手「${player.name}」？此動作會移除此選手的分數與戰績。`);
  if (!confirmed) return;
  state.players = state.players.filter((item) => item.id !== playerId);
  if (selectedPlayerId === playerId) selectedPlayerId = state.players.length ? state.players[0].id : "";
  saveState();
  renderAll();
  setStatus(`已刪除選手：${player.name}`);
}

function resetData() {
  const confirmed = window.confirm("會清除目前瀏覽器已儲存的比賽同選手資料，並回復示範資料。確定要繼續？");
  if (!confirmed) return;
  state = normalizeState(clone(seedData));
  selectedPlayerId = state.players[0].id;
  saveState();
  renderAll();
  setStatus("已重設示範資料。");
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

function handleDeletePlayerClick(event, playerId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  try {
    deletePlayer(playerId);
  } catch (error) {
    setStatus(`刪除選手失敗：${error.message}`, true);
    console.error(error);
  }
  return false;
}

function handleResetClick(event) {
  if (event) event.preventDefault();
  try {
    resetData();
  } catch (error) {
    setStatus(`重設失敗：${error.message}`, true);
    console.error(error);
  }
  return false;
}

window.handleAddPlayerClick = handleAddPlayerClick;
window.handlePreviewClick = handlePreviewClick;
window.handleSaveMatchClick = handleSaveMatchClick;
window.handleDeletePlayerClick = handleDeletePlayerClick;
window.handleResetClick = handleResetClick;
window.addEventListener("error", (event) => {
  setStatus(`程式錯誤：${event.message}`, true);
});

function renderAll() {
  renderStats();
  renderLeaderboard();
  renderPlayers();
  renderPlayerDetail();
  renderPlayerOptions();
  renderRuleCards();
}

bindEvents();
renderAll();
setStatus("系統已載入，可以新增選手同比賽。");
