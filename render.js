function byId(id) {
  return document.getElementById(id);
}

function formatScore(value) {
  return Number(value).toFixed(2);
}

function setStatus(message, isError = false) {
  const status = byId("appStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

let actionToastTimer = null;

function showActionToast(message, tone = "success") {
  const toast = byId("actionToast");
  const icon = byId("actionToastIcon");
  const text = byId("actionToastText");
  if (!toast || !icon || !text) return;
  window.clearTimeout(actionToastTimer);
  toast.className = `action-toast action-toast-${tone}`;
  icon.textContent = tone === "error" ? "!" : tone === "warning" ? "i" : "✓";
  text.textContent = message;
  actionToastTimer = window.setTimeout(() => toast.classList.add("hidden"), 4200);
}

const cloudUiMetaKey = "badmintonPlayerRating.v2.cloudUiMeta";

function readCloudUiMeta() {
  try {
    return JSON.parse(localStorage.getItem(cloudUiMetaKey) || "{}") || {};
  } catch (_error) {
    return {};
  }
}

function updateCloudFacts(level, metrics = {}) {
  const sourceNode = byId("cloudSourceValue");
  const lastSyncNode = byId("cloudLastSyncValue");
  const remoteNode = byId("cloudRemoteValue");
  const localNode = byId("cloudLocalValue");
  const pendingNode = byId("cloudPendingValue");
  const balance = byId("cloudBalance");
  const balanceRemote = byId("cloudBalanceRemote");
  const balanceLocal = byId("cloudBalanceLocal");
  const balanceSymbol = byId("cloudBalanceSymbol");
  const balanceStatus = byId("cloudBalanceStatus");
  if (!sourceNode || !lastSyncNode || !remoteNode || !localNode || !pendingNode) return;

  const stored = readCloudUiMeta();
  const next = { ...stored };
  if (Number.isFinite(metrics.cloudPlayers)) next.cloudPlayers = metrics.cloudPlayers;
  if (Number.isFinite(metrics.cloudMatches)) next.cloudMatches = metrics.cloudMatches;
  if (Number.isFinite(metrics.pendingPlayers)) next.pendingPlayers = metrics.pendingPlayers;
  if (Number.isFinite(metrics.pendingMatches)) next.pendingMatches = metrics.pendingMatches;
  if (metrics.markSuccess) next.lastSuccessAt = new Date().toISOString();
  if (metrics.markSuccess || Object.keys(metrics).length) {
    localStorage.setItem(cloudUiMetaKey, JSON.stringify(next));
  }

  const localPlayers = typeof state !== "undefined" && Array.isArray(state.players) ? state.players.length : 0;
  const localMatches = typeof state !== "undefined" && Array.isArray(state.matches) ? state.matches.length : 0;
  const sources = {
    ok: "雲端＋本機保護",
    checking: "正在核對",
    error: "本機暫存",
    local: "只在本機"
  };
  sourceNode.textContent = sources[level] || sources.checking;
  localNode.textContent = `${localPlayers} 位／${localMatches} 場`;
  remoteNode.textContent = Number.isFinite(next.cloudPlayers) && Number.isFinite(next.cloudMatches)
    ? `${next.cloudPlayers} 位／${next.cloudMatches} 場`
    : "未檢查";
  lastSyncNode.textContent = next.lastSuccessAt
    ? new Date(next.lastSuccessAt).toLocaleString("zh-HK", { dateStyle: "short", timeStyle: "short" })
    : "未有記錄";

  const pendingPlayers = Number.isFinite(next.pendingPlayers) ? next.pendingPlayers : 0;
  const pendingMatches = Number.isFinite(next.pendingMatches) ? next.pendingMatches : 0;
  if (level === "error") pendingNode.textContent = "需要重新同步";
  else if (level === "checking") pendingNode.textContent = "檢查中";
  else if (level === "local") pendingNode.textContent = "未連接雲端";
  else if (pendingPlayers || pendingMatches) pendingNode.textContent = `待確認 ${pendingPlayers} 位／${pendingMatches} 場`;
  else pendingNode.textContent = "已完成";

  if (balance && balanceRemote && balanceLocal && balanceSymbol && balanceStatus) {
    const remoteKnown = Number.isFinite(next.cloudPlayers) && Number.isFinite(next.cloudMatches);
    const sameCounts = remoteKnown && next.cloudPlayers === localPlayers && next.cloudMatches === localMatches;
    balanceRemote.textContent = remoteKnown ? `${next.cloudPlayers} 位／${next.cloudMatches} 場` : "未檢查";
    balanceLocal.textContent = `${localPlayers} 位／${localMatches} 場`;
    if (level === "error") {
      balance.className = "cloud-balance cloud-balance-error";
      balanceSymbol.textContent = "!";
      balanceStatus.textContent = "連線失敗，本機資料仍然保留";
    } else if (sameCounts) {
      balance.className = "cloud-balance cloud-balance-ok";
      balanceSymbol.textContent = "=";
      balanceStatus.textContent = "兩邊記錄數量一致";
    } else if (remoteKnown) {
      balance.className = "cloud-balance cloud-balance-warning";
      balanceSymbol.textContent = "≠";
      balanceStatus.textContent = "數量不同，請重新同步核對";
    } else {
      balance.className = "cloud-balance cloud-balance-checking";
      balanceSymbol.textContent = "↔";
      balanceStatus.textContent = "正在比較兩邊資料";
    }
  }
}

function setCloudHealth(level, title, text = "", detail = "", metrics = {}) {
  const panel = byId("cloud");
  const badge = byId("cloudHealthBadge");
  const titleNode = byId("cloudHealthTitle");
  const textNode = byId("cloudHealthText");
  const detailNode = byId("cloudHealthDetail");
  if (!panel || !badge || !titleNode || !textNode || !detailNode) return;

  const safeLevel = ["ok", "checking", "error", "local"].includes(level) ? level : "checking";
  const labels = {
    ok: "已連接",
    checking: "檢查中",
    error: "連不到",
    local: "本機"
  };

  panel.className = `section cloud-health cloud-${safeLevel}`;
  badge.textContent = labels[safeLevel];
  titleNode.textContent = title;
  textNode.textContent = text;
  detailNode.textContent = detail;
  updateCloudFacts(safeLevel, metrics);
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

function canRenderEditorActions() {
  return typeof isEditor === "function" && isEditor();
}

function playerHasMatchHistory(playerId) {
  return state.matches.some((match) => [...match.teamAIds, ...match.teamBIds].includes(playerId));
}

function matchDates() {
  return [...new Set(state.matches.map((match) => match.date).filter(Boolean))].sort().reverse();
}

function ensureSelectedDate(currentDate, dates) {
  if (!dates.length) return "";
  return currentDate && dates.includes(currentDate) ? currentDate : dates[0];
}

function playersForDate(date) {
  if (!date) return [];
  let players = state.players.map(createStats);
  state.matches
    .filter((match) => match.date === date)
    .forEach((match) => {
      players = applyMatch(players, match).players;
    });
  return players.filter((player) => player.wins + player.losses > 0);
}

function leaderboardPlayers() {
  if (leaderboardMode !== "day") return computedPlayers();

  const dates = matchDates();
  selectedLeaderboardDate = ensureSelectedDate(selectedLeaderboardDate, dates);
  return playersForDate(selectedLeaderboardDate);
}

function sortedPlayers() {
  const query = byId("searchInput").value.trim().toLowerCase();
  const sort = byId("sortSelect").value;
  return leaderboardPlayers()
    .filter((player) => player.name.toLowerCase().includes(query))
    .sort((a, b) => {
      if (sort === "winRate") return winRate(b) - winRate(a);
      if (sort === "matches") return b.wins + b.losses - (a.wins + a.losses);
      if (sort === "recent") return new Date(b.recent || 0) - new Date(a.recent || 0);
      return b.rating - a.rating;
    });
}

function renderLeaderboardControls(rows) {
  const dates = matchDates();
  selectedLeaderboardDate = ensureSelectedDate(selectedLeaderboardDate, dates);
  const dateInput = byId("leaderboardDate");
  const allButton = byId("leaderboardAllButton");
  const dayButton = byId("leaderboardDayButton");
  const playedPlayers = rows.filter((player) => player.wins + player.losses > 0);
  const topPlayer = rows[0];

  if (dateInput) {
    dateInput.value = selectedLeaderboardDate;
    dateInput.disabled = leaderboardMode !== "day" || !dates.length;
    dateInput.closest(".leaderboard-date-field")?.classList.toggle("is-inactive", leaderboardMode !== "day");
  }
  if (allButton) allButton.classList.toggle("active", leaderboardMode === "all");
  if (dayButton) dayButton.classList.toggle("active", leaderboardMode === "day");

  byId("leaderboardSummary").innerHTML = `
    <article>
      <span>${leaderboardMode === "day" ? selectedLeaderboardDate || "未有日期" : "總分數"}</span>
      <p>${leaderboardMode === "day" ? "單日排名" : "全部比賽"}</p>
    </article>
    <article>
      <span>${playedPlayers.length}</span>
      <p>有出賽選手</p>
    </article>
    <article>
      <span>${topPlayer ? formatScore(topPlayer.rating) : formatScore(initialRating)}</span>
      <p>最高分</p>
    </article>
    <article>
      <span>${topPlayer ? topPlayer.name : "-"}</span>
      <p>目前第一</p>
    </article>
  `;
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

function renderDayOverview() {
  const container = byId("dayOverview");
  if (!container) return;
  const dates = matchDates();
  container.innerHTML = dates.length
    ? dates
        .map((date) => {
          const matches = state.matches.filter((match) => match.date === date);
          const players = playersForDate(date).sort((a, b) => b.rating - a.rating);
          const playerIds = new Set(matches.flatMap((match) => [...match.teamAIds, ...match.teamBIds]));
          const summary = summarizeHistory(matches);
          const topPlayer = players[0];
          const locations = [...new Set(matches.map((match) => match.location).filter(Boolean))];
          return `
            <article class="day-card">
              <div>
                <span class="tag">${date}</span>
                <h3>${matches.length} 場比賽</h3>
                <p class="meta">${locations.length ? locations.join(" / ") : "未填場地"}</p>
              </div>
              <div class="day-metrics">
                <span><strong>${playerIds.size}</strong><small>出賽選手</small></span>
                <span><strong>${summary.totalPoints}</strong><small>總得分</small></span>
                <span><strong>${topPlayer ? topPlayer.name : "-"}</strong><small>當日第一</small></span>
              </div>
              <button class="mini-action" type="button" onclick="return handleOpenDayClick(event, '${date}')">查看當日</button>
            </article>
          `;
        })
        .join("")
    : `<p class="meta">未有比賽日紀錄。</p>`;
}

function renderLeaderboard() {
  const rows = sortedPlayers();
  const canEdit = canRenderEditorActions();
  renderLeaderboardControls(rows);
  const mobileLeaderboard = byId("mobileLeaderboard");
  if (mobileLeaderboard) {
    mobileLeaderboard.innerHTML = rows.length
      ? rows
          .map((player, index) => {
            const pointDiff = player.pointsFor - player.pointsAgainst;
            return `
              <details class="mobile-leaderboard-item">
                <summary>
                  <span class="rank">${index + 1}</span>
                  <span class="mobile-player-name">
                    <strong>${player.name}</strong>
                    <small>${player.gender}</small>
                  </span>
                  <span class="score-pill">${formatScore(player.rating)}</span>
                  <span class="mobile-detail-indicator" aria-hidden="true"></span>
                </summary>
                <div class="mobile-player-details">
                  <span><small>勝率</small><strong>${winRate(player)}%</strong></span>
                  <span><small>戰績</small><strong>${player.wins} 勝 ${player.losses} 敗</strong></span>
                  <span><small>得失分</small><strong>${player.pointsFor}:${player.pointsAgainst} (${pointDiff >= 0 ? "+" : ""}${pointDiff})</strong></span>
                  <span><small>最近比賽</small><strong>${player.recent || "-"}</strong></span>
                </div>
                ${
                  canEdit
                    ? `<div class="mobile-player-actions">
                        <button class="mini-action" type="button" onclick="return handleRenamePlayerClick(event, '${player.id}')">改名</button>
                        ${!playerHasMatchHistory(player.id) ? `<button class="mini-danger" type="button" onclick="return handleDeletePlayerClick(event, '${player.id}')">刪除</button>` : ""}
                      </div>`
                    : ""
                }
              </details>
            `;
          })
          .join("")
      : `<p class="mobile-leaderboard-empty">未有選手資料。</p>`;
  }
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
              <td>${canEdit ? `<div class="action-cell">
                <button class="mini-action" type="button" onclick="return handleRenamePlayerClick(event, '${player.id}')">改名</button>
                ${!playerHasMatchHistory(player.id) ? `<button class="mini-danger" type="button" onclick="return handleDeletePlayerClick(event, '${player.id}')">刪除</button>` : ""}
              </div>` : ""}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="8">未有選手資料。</td></tr>`;
}

function renderPlayers() {
  const players = computedPlayers();
  const canEdit = canRenderEditorActions();
  byId("playerList").innerHTML = players
    .map(
      (player) => `
      <article class="player-card ${player.id === selectedPlayerId ? "active" : ""}" data-player="${player.id}" role="button" tabindex="0">
        <span class="avatar">${player.name.slice(0, 1)}</span>
        <strong>${player.name}</strong>
        <span class="meta">${player.gender} · ${formatScore(player.rating)} 分 · ${player.wins + player.losses} 場</span>
        <span class="meta">得失分：${player.pointsFor}:${player.pointsAgainst}</span>
        ${canEdit ? `<span class="card-actions">
          <button class="mini-action" type="button" onclick="return handleRenamePlayerClick(event, '${player.id}')">改名</button>
          ${!playerHasMatchHistory(player.id) ? `<button class="mini-danger" type="button" onclick="return handleDeletePlayerClick(event, '${player.id}')">刪除</button>` : ""}
        </span>` : ""}
      </article>
    `
    )
    .join("");

  document.querySelectorAll(".player-card").forEach((card) => {
    const selectPlayer = () => {
      selectedPlayerId = card.dataset.player;
      renderPlayers();
      renderPlayerDetail();
    };
    card.addEventListener("click", selectPlayer);
    card.addEventListener("keydown", (event) => {
      if (event.target !== card || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      selectPlayer();
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

function historyDates() {
  return [...new Set(state.matches.map((match) => match.date).filter(Boolean))].sort().reverse();
}

function ensureHistoryDate(dates) {
  if (!dates.length) {
    selectedHistoryDate = "";
    return "";
  }
  if (!selectedHistoryDate || !dates.includes(selectedHistoryDate)) {
    selectedHistoryDate = dates[0];
  }
  return selectedHistoryDate;
}

function summarizeHistory(matches) {
  const totalPoints = matches.reduce((sum, match) => sum + Number(match.scoreA) + Number(match.scoreB), 0);
  const biggestMargin = matches.reduce((max, match) => Math.max(max, Math.abs(Number(match.scoreA) - Number(match.scoreB))), 0);
  const dates = new Set(matches.map((match) => match.date).filter(Boolean));
  const aWins = matches.filter((match) => Number(match.scoreA) > Number(match.scoreB)).length;
  const bWins = matches.length - aWins;

  return { totalPoints, biggestMargin, dateCount: dates.size, aWins, bWins };
}

function renderHistoryControls(dates, visibleMatches) {
  const dateInput = byId("historyDate");
  const allButton = byId("historyAllButton");
  const dayButton = byId("historyDayButton");
  const summary = summarizeHistory(visibleMatches);
  const selectedDate = ensureHistoryDate(dates);

  if (dateInput) {
    dateInput.value = selectedDate;
    dateInput.disabled = historyMode !== "day" || !dates.length;
    dateInput.closest(".history-date-field")?.classList.toggle("is-inactive", historyMode !== "day");
  }

  if (allButton) allButton.classList.toggle("active", historyMode === "all");
  if (dayButton) dayButton.classList.toggle("active", historyMode === "day");

  const rangeLabel = historyMode === "day" ? selectedDate || "未有日期" : `全部 ${summary.dateCount} 日`;
  byId("historySummary").innerHTML = `
    <article>
      <span>${rangeLabel}</span>
      <p>${historyMode === "day" ? "單日記錄" : "總記錄"}</p>
    </article>
    <article>
      <span>${visibleMatches.length}</span>
      <p>比賽場次</p>
    </article>
    <article>
      <span>${summary.totalPoints}</span>
      <p>總得分</p>
    </article>
    <article>
      <span>${summary.biggestMargin}</span>
      <p>最大分差</p>
    </article>
    <article>
      <span>${summary.aWins}:${summary.bWins}</span>
      <p>A 隊勝 : B 隊勝</p>
    </article>
  `;
}

function renderHistory() {
  recompute();
  const canEdit = canRenderEditorActions();
  const dates = historyDates();
  const selectedDate = ensureHistoryDate(dates);
  const visibleMatches = historyMode === "day"
    ? matchSummaries.filter((match) => match.date === selectedDate)
    : matchSummaries;
  const orderedMatches = [...visibleMatches].reverse();
  const compactLimit = window.matchMedia("(max-width: 640px)").matches ? 3 : 8;
  const displayedMatches = historyExpanded ? orderedMatches : orderedMatches.slice(0, compactLimit);

  renderHistoryControls(dates, visibleMatches);

  byId("historyBody").innerHTML = displayedMatches.length
    ? displayedMatches
        .map((match) => {
          const changedNames = [...match.teamAIds, ...match.teamBIds]
            .map((id) => `${playerName(id)} ${match.playerChanges[id] >= 0 ? "+" : ""}${match.playerChanges[id].toFixed(2)}`)
            .join("<br>");
          const matchMeta = [match.location, match.note].filter(Boolean).join(" · ");
          return `
            <tr class="history-row">
              <td>${match.date}</td>
              <td>${match.location || ""}</td>
              <td>${match.note || ""}</td>
              <td>${teamLabel(match.teamAIds)}</td>
              <td>${teamLabel(match.teamBIds)}</td>
              <td><strong>${match.scoreA}:${match.scoreB}</strong></td>
              <td class="meta">
                <details class="match-details">
                  <summary>
                    <span>${match.scoreA}:${match.scoreB}</span>
                    <small>${matchMeta || "詳細資料"}</small>
                  </summary>
                  <div class="match-detail-grid">
                    <span>日期</span><strong>${match.date}</strong>
                    <span>場地</span><strong>${match.location || ""}</strong>
                    <span>備註</span><strong>${match.note || ""}</strong>
                    <span>A 隊</span><strong>${teamLabel(match.teamAIds)}</strong>
                    <span>B 隊</span><strong>${teamLabel(match.teamBIds)}</strong>
                    <span>分數變動</span><strong>${changedNames}</strong>
                  </div>
                </details>
              </td>
              <td class="action-cell">
                ${canEdit ? `
                <button class="mini-action" type="button" onclick="return handleEditMatchClick(event, '${match.id}')">編輯</button>
                <button class="mini-danger" type="button" onclick="return handleDeleteMatchClick(event, '${match.id}')">刪除</button>
                ` : ""}
              </td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="8">未有比賽紀錄。</td></tr>`;

  const mobileHistory = byId("mobileHistory");
  if (mobileHistory) {
    mobileHistory.innerHTML = displayedMatches.length
      ? displayedMatches
          .map((match) => {
            const changedNames = [...match.teamAIds, ...match.teamBIds]
              .map((id) => `${playerName(id)} ${match.playerChanges[id] >= 0 ? "+" : ""}${match.playerChanges[id].toFixed(2)}`)
              .join("<br>");
            return `
              <details class="mobile-history-item">
                <summary>
                  <span class="mobile-history-date">${match.date}</span>
                  <span class="mobile-history-teams">
                    <strong>${teamLabel(match.teamAIds)}</strong>
                    <small>對 ${teamLabel(match.teamBIds)}</small>
                  </span>
                  <span class="mobile-history-score">${match.scoreA}:${match.scoreB}</span>
                  <span class="mobile-detail-indicator" aria-hidden="true"></span>
                </summary>
                <div class="mobile-history-details">
                  <span><small>場地</small><strong>${match.location || "未填"}</strong></span>
                  <span><small>備註</small><strong>${match.note || "未填"}</strong></span>
                  <span class="wide"><small>分數變動</small><strong>${changedNames}</strong></span>
                </div>
                ${
                  canEdit
                    ? `<div class="mobile-player-actions">
                        <button class="mini-action" type="button" onclick="return handleEditMatchClick(event, '${match.id}')">編輯</button>
                        <button class="mini-danger" type="button" onclick="return handleDeleteMatchClick(event, '${match.id}')">刪除</button>
                      </div>`
                    : ""
                }
              </details>
            `;
          })
          .join("")
      : `<p class="mobile-leaderboard-empty">未有比賽紀錄。</p>`;
  }

  const moreButton = byId("historyMoreButton");
  if (moreButton) {
    moreButton.classList.toggle("hidden", orderedMatches.length <= compactLimit);
    moreButton.textContent = historyExpanded
      ? "收起比賽紀錄"
      : `顯示更多（尚有 ${orderedMatches.length - displayedMatches.length} 場）`;
  }
}

function formatLogTime(value) {
  try {
    return new Date(value).toLocaleString("zh-Hant", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (error) {
    return value || "";
  }
}

function renderActivityLog() {
  const container = byId("activityLog");
  if (!container) return;
  const logs = typeof readActivityLog === "function" ? readActivityLog() : [];
  const compactLimit = window.matchMedia("(max-width: 640px)").matches ? 3 : 6;
  const displayedLogs = activityExpanded ? logs : logs.slice(0, compactLimit);
  container.innerHTML = displayedLogs.length
    ? displayedLogs
        .map(
          (log) => `
            <article class="activity-item">
              <span>${formatLogTime(log.at)}</span>
              <strong>${log.action}</strong>
              <p class="meta">${log.detail || ""}</p>
            </article>
          `
        )
        .join("")
    : `<p class="meta">暫時未有操作紀錄。</p>`;

  const moreButton = byId("activityMoreButton");
  if (moreButton) {
    moreButton.classList.toggle("hidden", logs.length <= compactLimit);
    moreButton.textContent = activityExpanded
      ? "收起操作紀錄"
      : `顯示更多（尚有 ${logs.length - displayedLogs.length} 項）`;
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
        <h3>得失分修正</h3>
        <p class="meta">每 1 分得失分約影響 0.035 分，所以長期 156:140 會比 153:149 更有優勢。</p>
        <div class="bar"><span style="width: 78%"></span></div>
        <strong>分差會直接影響個人分數</strong>
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
