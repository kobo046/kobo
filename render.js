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
              <td>${canEdit ? `<button class="mini-danger" type="button" onclick="return handleDeletePlayerClick(event, '${player.id}')">刪除</button>` : ""}</td>
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
      <button class="player-card ${player.id === selectedPlayerId ? "active" : ""}" type="button" data-player="${player.id}">
        <span class="avatar">${player.name.slice(0, 1)}</span>
        <strong>${player.name}</strong>
        <span class="meta">${player.gender} · ${formatScore(player.rating)} 分 · ${player.wins + player.losses} 場</span>
        <span class="meta">得失分：${player.pointsFor}:${player.pointsAgainst}</span>
        ${canEdit ? `<span class="card-actions">
          <span class="mini-danger" onclick="return handleDeletePlayerClick(event, '${player.id}')">刪除</span>
        </span>` : ""}
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

  renderHistoryControls(dates, visibleMatches);

  byId("historyBody").innerHTML = visibleMatches.length
    ? [...visibleMatches]
        .reverse()
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
  container.innerHTML = logs.length
    ? logs
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
