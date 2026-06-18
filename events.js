function selectedPlayerIds() {
  return [
    byId("teamAPlayer1").value,
    byId("teamAPlayer2").value,
    byId("teamBPlayer1").value,
    byId("teamBPlayer2").value
  ];
}

function canEditData() {
  return typeof isEditor === "function" && isEditor();
}

function guardEditorAction(actionName) {
  if (canEditData()) return true;
  if (typeof requireEditorAction === "function") return requireEditorAction(actionName);
  setStatus(`只有管理員可以${actionName}。`, true);
  return false;
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
    date: byId("matchDate").value || new Date().toISOString().slice(0, 10),
    location: byId("matchLocation").value.trim(),
    note: byId("matchNote").value.trim(),
    teamAIds: [byId("teamAPlayer1").value, byId("teamAPlayer2").value],
    teamBIds: [byId("teamBPlayer1").value, byId("teamBPlayer2").value],
    scoreA: Number(byId("scoreA").value),
    scoreB: Number(byId("scoreB").value)
  };
}

function setMatchFormFromMatch(match, options = {}) {
  if (!match) return;
  byId("teamAPlayer1").value = match.teamAIds[0];
  byId("teamAPlayer2").value = match.teamAIds[1];
  byId("teamBPlayer1").value = match.teamBIds[0];
  byId("teamBPlayer2").value = match.teamBIds[1];
  if (options.includeScore) {
    byId("scoreA").value = match.scoreA;
    byId("scoreB").value = match.scoreB;
  }
  if (options.includeMeta) {
    byId("matchDate").value = match.date || new Date().toISOString().slice(0, 10);
    byId("matchLocation").value = match.location || "";
    byId("matchNote").value = match.note || "";
  }
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
    <p class="meta">比分差距倍率：${result.marginMultiplier.toFixed(2)} · A 隊預期勝率：${Math.round(result.expectedA * 100)}% · 得失分修正：${result.scoreDiffA >= 0 ? "+" : ""}${result.scoreDiffA.toFixed(2)}</p>
    ${rows}
  `;
  setStatus("試算完成。按「儲存比賽」先會正式寫入。");
  return match;
}

async function saveMatch(event) {
  if (event) event.preventDefault();
  if (!guardEditorAction("儲存比賽")) return;
  const match = renderPreview();
  if (!match) return;
  const wasEditing = Boolean(editingMatchId);
  const logDetail = `${match.date} ${teamLabel(match.teamAIds)} ${match.scoreA}:${match.scoreB} ${teamLabel(match.teamBIds)}`;

  if (editingMatchId) {
    state.matches = state.matches.map((item) => (item.id === editingMatchId ? { ...match, id: editingMatchId } : item));
    setStatus("比賽已更新，排行榜已重新計算。");
  } else {
    state.matches.push(match);
    setStatus(`比賽已儲存。目前共有 ${state.matches.length} 場比賽。`);
  }

  editingMatchId = "";
  const syncResult = await saveState();
  if (typeof recordActivity === "function") recordActivity(wasEditing ? "編輯比賽" : "新增比賽", logDetail);
  clearMatchEditingUi();
  renderAll();
  byId("ratingPreview").className = "preview-box visible";
  byId("ratingPreview").innerHTML = "<strong>比賽已儲存，個人排行榜已更新。</strong>";
  if (syncResult && syncResult.cloud) {
    setStatus(`比賽已儲存，${syncResult.message}`);
  } else if (syncResult) {
    setStatus(`比賽已儲存，但${syncResult.message}`, Boolean(syncResult.error));
  }
}

async function addPlayer(event) {
  if (event) event.preventDefault();
  if (!guardEditorAction("新增選手")) return;
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
  await saveState();
  if (typeof recordActivity === "function") recordActivity("新增選手", player.name);
  renderAll();
  setStatus(`已新增選手：${player.name}，初始分數 ${formatScore(initialRating)}。`);
}

async function deletePlayer(playerId) {
  if (!guardEditorAction("刪除選手")) return;
  const player = basePlayer(playerId);
  if (!player) return;
  const relatedMatches = state.matches.filter((match) => [...match.teamAIds, ...match.teamBIds].includes(playerId)).length;
  const confirmed = window.confirm(`確定刪除選手「${player.name}」？會同時刪除 ${relatedMatches} 場包含此選手的比賽紀錄。`);
  if (!confirmed) return;
  state.players = state.players.filter((item) => item.id !== playerId);
  state.matches = state.matches.filter((match) => ![...match.teamAIds, ...match.teamBIds].includes(playerId));
  if (selectedPlayerId === playerId) selectedPlayerId = state.players.length ? state.players[0].id : "";
  await saveState();
  if (typeof recordActivity === "function") recordActivity("刪除選手", `${player.name}，連同 ${relatedMatches} 場比賽`);
  renderAll();
  setStatus(`已刪除選手：${player.name}`);
}

function editMatch(matchId) {
  if (!guardEditorAction("編輯比賽")) return;
  const match = state.matches.find((item) => item.id === matchId);
  if (!match) return;
  editingMatchId = matchId;
  byId("teamAPlayer1").value = match.teamAIds[0];
  byId("teamAPlayer2").value = match.teamAIds[1];
  byId("teamBPlayer1").value = match.teamBIds[0];
  byId("teamBPlayer2").value = match.teamBIds[1];
  byId("scoreA").value = match.scoreA;
  byId("scoreB").value = match.scoreB;
  byId("matchDate").value = match.date || new Date().toISOString().slice(0, 10);
  byId("matchLocation").value = match.location || "";
  byId("matchNote").value = match.note || "";
  byId("matchFormTitle").textContent = "編輯比賽紀錄";
  byId("saveMatchButton").textContent = "更新比賽";
  byId("cancelEditButton").classList.remove("hidden");
  setStatus("正在編輯舊比賽。修改後按「更新比賽」。");
  location.hash = "#match";
  renderPreview();
}

async function deleteMatch(matchId) {
  if (!guardEditorAction("刪除比賽")) return;
  const match = state.matches.find((item) => item.id === matchId);
  if (!match) return;
  const confirmed = window.confirm(`確定刪除 ${match.date} 的比賽紀錄 ${teamLabel(match.teamAIds)} ${match.scoreA}:${match.scoreB} ${teamLabel(match.teamBIds)}？`);
  if (!confirmed) return;
  state.matches = state.matches.filter((item) => item.id !== matchId);
  if (editingMatchId === matchId) clearMatchEditingUi();
  await saveState();
  if (typeof recordActivity === "function") recordActivity("刪除比賽", `${match.date} ${teamLabel(match.teamAIds)} ${match.scoreA}:${match.scoreB} ${teamLabel(match.teamBIds)}`);
  renderAll();
  setStatus("比賽已刪除，排行榜已重新計算。");
}

function clearMatchEditingUi() {
  editingMatchId = "";
  byId("matchFormTitle").textContent = "新增比賽紀錄";
  byId("saveMatchButton").textContent = "儲存比賽";
  byId("cancelEditButton").classList.add("hidden");
}

async function resetData() {
  if (!guardEditorAction("重設資料")) return;
  const confirmed = window.confirm("會清除目前瀏覽器已儲存的比賽同選手資料，並回復示範資料。確定要繼續？");
  if (!confirmed) return;
  state = normalizeState(clone(seedData));
  selectedPlayerId = state.players[0].id;
  clearMatchEditingUi();
  await saveState();
  if (typeof recordActivity === "function") recordActivity("重設資料", "回復示範資料");
  renderAll();
  setStatus("已重設示範資料。");
}

function bindEvents() {
  if (!byId("matchDate").value) byId("matchDate").value = new Date().toISOString().slice(0, 10);
  byId("searchInput").addEventListener("input", renderLeaderboard);
  byId("sortSelect").addEventListener("change", renderLeaderboard);
  byId("leaderboardAllButton").addEventListener("click", () => setLeaderboardMode("all"));
  byId("leaderboardDayButton").addEventListener("click", () => setLeaderboardMode("day"));
  byId("leaderboardDate").addEventListener("change", (event) => setLeaderboardDate(event.target.value));
  byId("historyAllButton").addEventListener("click", () => setHistoryMode("all"));
  byId("historyDayButton").addEventListener("click", () => setHistoryMode("day"));
  byId("historyDate").addEventListener("change", (event) => setHistoryDate(event.target.value));
  byId("previewButton").addEventListener("click", () => renderPreview());
  byId("matchForm").addEventListener("submit", saveMatch);
  byId("playerForm").addEventListener("submit", addPlayer);
  byId("resetButton").addEventListener("click", resetData);
}

function setLeaderboardMode(mode) {
  leaderboardMode = mode === "day" ? "day" : "all";
  renderLeaderboard();
}

function setLeaderboardDate(date) {
  selectedLeaderboardDate = date;
  leaderboardMode = "day";
  renderLeaderboard();
}

function setHistoryMode(mode) {
  historyMode = mode === "day" ? "day" : "all";
  renderHistory();
}

function setHistoryDate(date) {
  selectedHistoryDate = date;
  historyMode = "day";
  renderHistory();
}

function openMatchDay(date) {
  selectedLeaderboardDate = date;
  selectedHistoryDate = date;
  leaderboardMode = "day";
  historyMode = "day";
  renderLeaderboard();
  renderHistory();
  location.hash = "#leaderboard";
  setStatus(`已切換到 ${date} 的單日排名和比賽紀錄。`);
}

function useLastMatchPlayers() {
  if (!guardEditorAction("套用上一場選手")) return;
  const lastMatch = state.matches[state.matches.length - 1];
  if (!lastMatch) {
    setStatus("未有上一場比賽可以套用。", true);
    return;
  }
  setMatchFormFromMatch(lastMatch, { includeScore: false, includeMeta: false });
  byId("scoreA").value = 21;
  byId("scoreB").value = 17;
  renderPreview();
  setStatus("已套用上一場的 4 位選手。");
}

function swapTeams() {
  if (!guardEditorAction("交換 A / B 隊")) return;
  const a1 = byId("teamAPlayer1").value;
  const a2 = byId("teamAPlayer2").value;
  const b1 = byId("teamBPlayer1").value;
  const b2 = byId("teamBPlayer2").value;
  const scoreA = byId("scoreA").value;
  const scoreB = byId("scoreB").value;
  byId("teamAPlayer1").value = b1;
  byId("teamAPlayer2").value = b2;
  byId("teamBPlayer1").value = a1;
  byId("teamBPlayer2").value = a2;
  byId("scoreA").value = scoreB;
  byId("scoreB").value = scoreA;
  renderPreview();
  setStatus("已交換 A / B 隊。");
}

function resetScores() {
  if (!guardEditorAction("重設分數")) return;
  byId("scoreA").value = 21;
  byId("scoreB").value = 17;
  renderPreview();
  setStatus("已重設分數為 21:17。");
}

async function handleAddPlayerClick(event) {
  try {
    await addPlayer(event);
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

async function handleSaveMatchClick(event) {
  try {
    await saveMatch(event);
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

async function handleDeleteMatchClick(event, matchId) {
  if (event) event.preventDefault();
  await deleteMatch(matchId);
  return false;
}

async function handleDeletePlayerClick(event, playerId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  await deletePlayer(playerId);
  return false;
}

async function handleResetClick(event) {
  if (event) event.preventDefault();
  await resetData();
  return false;
}

function handleExportClick(event) {
  if (event) event.preventDefault();
  exportBackup();
  return false;
}

async function handleUploadCloudClick(event) {
  if (event) event.preventDefault();
  if (!guardEditorAction("上傳雲端資料")) return false;
  try {
    await uploadLocalStateToCloud();
  } catch (error) {
    setStatus(`上傳雲端失敗：${error.message}`, true);
    console.error(error);
  }
  return false;
}

async function handleCloudCheckClick(event) {
  if (event) event.preventDefault();
  if (!guardEditorAction("測試雲端寫入")) return false;
  try {
    if (!window.cloudSync || !window.cloudSync.testConnection) {
      setStatus("雲端檢查失敗：同步程式未載入。", true);
      return false;
    }
    const result = await window.cloudSync.testConnection();
    setStatus(`雲端連線正常，可以寫入 Supabase（${result.transport}）。`);
  } catch (error) {
    setStatus(`雲端檢查失敗：${error.message}`, true);
    console.error(error);
  }
  return false;
}

function handleImportFileChange(event) {
  if (!guardEditorAction("匯入備份")) {
    event.target.value = "";
    return false;
  }
  const file = event.target.files && event.target.files[0];
  if (file) importBackup(file);
  event.target.value = "";
  return false;
}

function handleOpenDayClick(event, date) {
  if (event) event.preventDefault();
  openMatchDay(date);
  return false;
}

function handleUseLastMatchClick(event) {
  if (event) event.preventDefault();
  useLastMatchPlayers();
  return false;
}

function handleSwapTeamsClick(event) {
  if (event) event.preventDefault();
  swapTeams();
  return false;
}

function handleResetScoresClick(event) {
  if (event) event.preventDefault();
  resetScores();
  return false;
}

function handleClearActivityLogClick(event) {
  if (event) event.preventDefault();
  if (!guardEditorAction("清除操作紀錄")) return false;
  clearActivityLog();
  setStatus("操作紀錄已清除。");
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
window.handleUploadCloudClick = handleUploadCloudClick;
window.handleCloudCheckClick = handleCloudCheckClick;
window.handleImportFileChange = handleImportFileChange;
window.handleOpenDayClick = handleOpenDayClick;
window.handleUseLastMatchClick = handleUseLastMatchClick;
window.handleSwapTeamsClick = handleSwapTeamsClick;
window.handleResetScoresClick = handleResetScoresClick;
window.handleClearActivityLogClick = handleClearActivityLogClick;
window.addEventListener("error", (event) => {
  setStatus(`程式錯誤：${event.message}`, true);
});
