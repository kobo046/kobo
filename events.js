function selectedPlayerIds() {
  return [
    byId("teamAPlayer1").value,
    byId("teamAPlayer2").value,
    byId("teamBPlayer1").value,
    byId("teamBPlayer2").value
  ];
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
  const syncResult = await saveState();
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
  renderAll();
  setStatus(`已新增選手：${player.name}，初始分數 ${formatScore(initialRating)}。`);
}

async function deletePlayer(playerId) {
  const player = basePlayer(playerId);
  if (!player) return;
  const relatedMatches = state.matches.filter((match) => [...match.teamAIds, ...match.teamBIds].includes(playerId)).length;
  const confirmed = window.confirm(`確定刪除選手「${player.name}」？會同時刪除 ${relatedMatches} 場包含此選手的比賽紀錄。`);
  if (!confirmed) return;
  state.players = state.players.filter((item) => item.id !== playerId);
  state.matches = state.matches.filter((match) => ![...match.teamAIds, ...match.teamBIds].includes(playerId));
  if (selectedPlayerId === playerId) selectedPlayerId = state.players.length ? state.players[0].id : "";
  await saveState();
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
  const match = state.matches.find((item) => item.id === matchId);
  if (!match) return;
  const confirmed = window.confirm(`確定刪除 ${match.date} 的比賽紀錄 ${teamLabel(match.teamAIds)} ${match.scoreA}:${match.scoreB} ${teamLabel(match.teamBIds)}？`);
  if (!confirmed) return;
  state.matches = state.matches.filter((item) => item.id !== matchId);
  if (editingMatchId === matchId) clearMatchEditingUi();
  await saveState();
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
  const confirmed = window.confirm("會清除目前瀏覽器已儲存的比賽同選手資料，並回復示範資料。確定要繼續？");
  if (!confirmed) return;
  state = normalizeState(clone(seedData));
  selectedPlayerId = state.players[0].id;
  clearMatchEditingUi();
  await saveState();
  renderAll();
  setStatus("已重設示範資料。");
}

function bindEvents() {
  if (!byId("matchDate").value) byId("matchDate").value = new Date().toISOString().slice(0, 10);
  byId("searchInput").addEventListener("input", renderLeaderboard);
  byId("sortSelect").addEventListener("change", renderLeaderboard);
  byId("historyAllButton").addEventListener("click", () => setHistoryMode("all"));
  byId("historyDayButton").addEventListener("click", () => setHistoryMode("day"));
  byId("historyDate").addEventListener("change", (event) => setHistoryDate(event.target.value));
  byId("previewButton").addEventListener("click", () => renderPreview());
  byId("matchForm").addEventListener("submit", saveMatch);
  byId("playerForm").addEventListener("submit", addPlayer);
  byId("resetButton").addEventListener("click", resetData);
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
window.handleUploadCloudClick = handleUploadCloudClick;
window.handleCloudCheckClick = handleCloudCheckClick;
window.handleImportFileChange = handleImportFileChange;
window.addEventListener("error", (event) => {
  setStatus(`程式錯誤：${event.message}`, true);
});
