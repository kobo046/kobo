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
                <button class="mini-action" type="button" onclick="return handleEditMatchClick(event, '${match.id}')">編輯</button>
                <button class="mini-danger" type="button" onclick="return handleDeleteMatchClick(event, '${match.id}')">刪除</button>
              </td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="8">未有比賽紀錄。</td></tr>`;
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
