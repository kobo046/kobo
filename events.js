function selectedPlayerIds() {
  return [
    byId("teamAPlayer1").value,
    byId("teamAPlayer2").value,
    byId("teamBPlayer1").value,
    byId("teamBPlayer2").value
  ];
}

let lastSavedConfirmationDate = "";

function setActionBusy(button, isBusy, busyLabel = "處理中…") {
  if (!button) return;
  if (isBusy) {
    if (!button.dataset.originalLabel) button.dataset.originalLabel = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
    button.classList.add("is-busy");
    return;
  }
  button.disabled = false;
  button.classList.remove("is-busy");
  if (button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
  }
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

function playerNameValidationMessage(name, currentPlayerId = "") {
  if (!name) return "請輸入選手姓名。";
  if (name.length > 30) return "選手姓名最多 30 個字。";
  if (/[<>]/.test(name)) return "選手姓名不可包含 < 或 > 符號。";
  const duplicate = state.players.some(
    (player) => player.id !== currentPlayerId && player.name.toLocaleLowerCase() === name.toLocaleLowerCase()
  );
  return duplicate ? `${name} 已經存在。` : "";
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function hideSaveConfirmation() {
  const overlay = byId("saveConfirmOverlay");
  if (overlay) overlay.classList.add("hidden");
}

function showSaveConfirmation(match, syncResult, wasEditing) {
  const overlay = byId("saveConfirmOverlay");
  if (!overlay || !match) return;
  const title = syncResult && syncResult.cloud
    ? wasEditing ? "比賽更新成功" : "比賽儲存成功"
    : syncResult && syncResult.error
      ? "已儲存本機，雲端未同步"
      : "比賽已儲存到本機";
  const cloudText = syncResult && syncResult.cloud
    ? "雲端同步成功，其他裝置重新整理後會見到。"
    : syncResult && syncResult.message
      ? syncResult.message
      : "資料已儲存在這部裝置。";
  const tone = syncResult && syncResult.cloud ? "success" : syncResult && syncResult.error ? "warning" : "local";
  const detailRows = [
    ["日期", match.date],
    ["A 隊", teamLabel(match.teamAIds)],
    ["B 隊", teamLabel(match.teamBIds)],
    ["比分", `${match.scoreA}:${match.scoreB}`],
    ["場地", match.location || "未填"],
    ["備註", match.note || "未填"]
  ];

  overlay.className = `save-confirm-overlay save-confirm-${tone}`;
  byId("saveConfirmTitle").textContent = title;
  byId("saveConfirmCloud").textContent = cloudText;
  byId("saveConfirmDetails").innerHTML = detailRows
    .map(([label, value]) => `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>`)
    .join("");
  byId("saveConfirmOverlay").classList.remove("hidden");
  lastSavedConfirmationDate = match.date || "";
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
  const saveButton = byId("saveMatchButton");
  if (saveButton && saveButton.disabled) return;
  const match = renderPreview();
  if (!match) return;
  setActionBusy(saveButton, true, "正在儲存…");
  const wasEditing = Boolean(editingMatchId);
  const logDetail = `${match.date} ${teamLabel(match.teamAIds)} ${match.scoreA}:${match.scoreB} ${teamLabel(match.teamBIds)}`;
  const savedMatch = { ...match, updatedAt: new Date().toISOString() };

  try {
    if (editingMatchId) {
      state.matches = state.matches.map((item) => (item.id === editingMatchId ? { ...savedMatch, id: editingMatchId } : item));
      setStatus("比賽已更新，排行榜已重新計算。");
    } else {
      state.matches.push(savedMatch);
      setStatus(`比賽已儲存。目前共有 ${state.matches.length} 場比賽。`);
    }

    editingMatchId = "";
    const syncResult = await saveState({
      changedPlayerIds: [],
      changedMatchIds: [savedMatch.id],
      backupReason: wasEditing ? "編輯比賽前" : "新增比賽前"
    });
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
    showSaveConfirmation(savedMatch, syncResult, wasEditing);
  } finally {
    setActionBusy(saveButton, false);
    if (saveButton) saveButton.textContent = editingMatchId ? "更新比賽" : "儲存比賽";
  }
}

async function addPlayer(event) {
  if (event) event.preventDefault();
  if (!guardEditorAction("新增選手")) return;
  const nameInput = byId("newPlayerName");
  const name = nameInput.value.trim();
  const validationMessage = playerNameValidationMessage(name);
  if (validationMessage) {
    setStatus(validationMessage, true);
    return;
  }

  const player = {
    id: `p-${Date.now()}`,
    name,
    gender: byId("newPlayerGender").value,
    updatedAt: new Date().toISOString()
  };
  state.players.push(player);
  selectedPlayerId = player.id;
  nameInput.value = "";
  await saveState({ changedPlayerIds: [player.id], changedMatchIds: [] });
  if (typeof recordActivity === "function") recordActivity("新增選手", player.name);
  renderAll();
  setStatus(`已新增選手：${player.name}，初始分數 ${formatScore(initialRating)}。`);
}

async function renamePlayer(playerId) {
  if (!guardEditorAction("修改選手姓名")) return;
  const player = basePlayer(playerId);
  if (!player) return;
  const enteredName = window.prompt("輸入新的選手姓名", player.name);
  if (enteredName === null) return;
  const nextName = enteredName.trim();
  const validationMessage = playerNameValidationMessage(nextName, playerId);
  if (validationMessage) {
    setStatus(validationMessage, true);
    return;
  }
  if (nextName === player.name) {
    setStatus("姓名沒有變更。");
    return;
  }

  const previousName = player.name;
  state.players = state.players.map((item) =>
    item.id === playerId ? { ...item, name: nextName, updatedAt: new Date().toISOString() } : item
  );
  await saveState({ changedPlayerIds: [playerId], changedMatchIds: [], backupReason: "修改選手姓名前" });
  if (typeof recordActivity === "function") recordActivity("修改選手姓名", `${previousName} → ${nextName}`);
  renderAll();
  setStatus(`已將選手「${previousName}」改名為「${nextName}」，過往比賽紀錄保持不變。`);
}

async function deletePlayer(playerId) {
  if (!guardEditorAction("刪除選手")) return;
  const player = basePlayer(playerId);
  if (!player) return;
  const relatedMatches = state.matches.filter((match) => [...match.teamAIds, ...match.teamBIds].includes(playerId)).length;
  if (relatedMatches > 0) {
    setStatus(`不能刪除「${player.name}」：這位選手有 ${relatedMatches} 場歷史比賽。請到比賽歷史編輯或刪除個別一場。`, true);
    return;
  }
  const confirmed = window.confirm(`確定刪除未有比賽紀錄的選手「${player.name}」？`);
  if (!confirmed) return;
  state.players = state.players.filter((item) => item.id !== playerId);
  if (selectedPlayerId === playerId) selectedPlayerId = state.players.length ? state.players[0].id : "";
  await saveState({
    changedPlayerIds: [],
    changedMatchIds: [],
    deletedPlayerIds: [playerId],
    deletedMatchIds: [],
    backupReason: "刪除選手前"
  });
  if (typeof recordActivity === "function") recordActivity("刪除未出賽選手", player.name);
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
  const confirmed = window.confirm(
    `只刪除以下一場比賽？\n\n${match.date}\n${teamLabel(match.teamAIds)} ${match.scoreA}:${match.scoreB} ${teamLabel(match.teamBIds)}\n\n其他比賽和選手不會刪除。`
  );
  if (!confirmed) return;
  state.matches = state.matches.filter((item) => item.id !== matchId);
  if (editingMatchId === matchId) clearMatchEditingUi();
  await saveState({
    changedPlayerIds: [],
    changedMatchIds: [],
    deletedMatchIds: [matchId],
    backupReason: "刪除比賽前"
  });
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
  const resetState = normalizeState(clone(seedData));
  const resetPlayerIds = new Set(resetState.players.map((player) => player.id));
  const deletedPlayerIds = state.players.map((player) => player.id).filter((id) => !resetPlayerIds.has(id));
  const deletedMatchIds = state.matches.map((match) => match.id);
  state = resetState;
  selectedPlayerId = state.players[0].id;
  clearMatchEditingUi();
  await saveState({
    changedPlayerIds: state.players.map((player) => player.id),
    changedMatchIds: [],
    deletedPlayerIds,
    deletedMatchIds,
    backupReason: "重設資料前"
  });
  if (typeof recordActivity === "function") recordActivity("重設資料", "回復示範資料");
  renderAll();
  setStatus("已重設示範資料。");
}

function bindEvents() {
  if (!byId("matchDate").value) byId("matchDate").value = new Date().toISOString().slice(0, 10);
  byId("searchInput").addEventListener("input", renderLeaderboard);
  byId("sortSelect").addEventListener("change", renderLeaderboard);
  byId("mobileLeaderboardToolsButton").addEventListener("click", toggleMobileLeaderboardTools);
  byId("leaderboardAllButton").addEventListener("click", () => setLeaderboardMode("all"));
  byId("leaderboardDayButton").addEventListener("click", () => setLeaderboardMode("day"));
  byId("leaderboardDate").addEventListener("change", (event) => setLeaderboardDate(event.target.value));
  byId("historyAllButton").addEventListener("click", () => setHistoryMode("all"));
  byId("historyDayButton").addEventListener("click", () => setHistoryMode("day"));
  byId("historyDate").addEventListener("change", (event) => setHistoryDate(event.target.value));
  byId("historyMoreButton").addEventListener("click", toggleHistoryRecords);
  byId("activityMoreButton").addEventListener("click", toggleActivityRecords);
  byId("previewButton").addEventListener("click", () => renderPreview());
  byId("matchForm").addEventListener("submit", saveMatch);
  byId("playerForm").addEventListener("submit", addPlayer);
  byId("resetButton").addEventListener("click", resetData);
}

function toggleMobileLeaderboardTools() {
  const tools = byId("leaderboardTools");
  const button = byId("mobileLeaderboardToolsButton");
  const isOpen = tools.classList.toggle("mobile-open");
  button.setAttribute("aria-expanded", String(isOpen));
  button.textContent = isOpen ? "收起搜尋／排序" : "搜尋／排序";
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
  historyExpanded = false;
  renderHistory();
}

function setHistoryDate(date) {
  selectedHistoryDate = date;
  historyMode = "day";
  historyExpanded = false;
  renderHistory();
}

function toggleHistoryRecords() {
  historyExpanded = !historyExpanded;
  renderHistory();
}

function toggleActivityRecords() {
  activityExpanded = !activityExpanded;
  renderActivityLog();
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

function adjustScore(targetId, delta) {
  if (!guardEditorAction("調整比分")) return;
  const input = byId(targetId);
  if (!input || !["scoreA", "scoreB"].includes(targetId)) return;
  const minimum = Number(input.min || 0);
  const maximum = Number(input.max || 99);
  const current = Number(input.value || 0);
  input.value = Math.min(maximum, Math.max(minimum, current + delta));
  input.dispatchEvent(new Event("input", { bubbles: true }));
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

async function handleRenamePlayerClick(event, playerId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  try {
    await renamePlayer(playerId);
  } catch (error) {
    setStatus(`修改選手姓名失敗：${error.message}`, true);
    console.error(error);
  }
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
  const button = event && event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null;
  if (button && button.disabled) return false;
  setActionBusy(button, true, "正在上傳…");
  try {
    const uploaded = await uploadLocalStateToCloud();
    if (uploaded) showActionToast("本機資料已上傳並完成核對");
  } catch (error) {
    setStatus(`上傳雲端失敗：${error.message}`, true);
    showActionToast("上傳失敗，本機資料仍然保留", "error");
    console.error(error);
  } finally {
    setActionBusy(button, false);
  }
  return false;
}

async function handleCloudSyncNowClick(event) {
  if (event) event.preventDefault();
  const button = event && event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null;
  if (button && button.disabled) return false;
  setActionBusy(button, true, "正在同步…");
  try {
    if (canEditData()) {
      await uploadLocalStateToCloud();
      setStatus("重新同步完成，本機與雲端資料已合併及核對。");
      showActionToast("同步完成，雲端與本機已核對");
    } else {
      state = await loadState();
      selectedPlayerId = state.players.length ? state.players[0].id : "";
      renderAll();
      setStatus("已重新讀取雲端資料；只讀模式不會上傳或修改資料。");
      showActionToast("已重新讀取雲端，沒有修改任何資料");
    }
  } catch (error) {
    if (typeof setCloudHealth === "function") {
      setCloudHealth("error", "重新同步失敗", "資料仍保留在這部裝置。", error.message);
    }
    setStatus(`重新同步失敗：${error.message}`, true);
    showActionToast("同步失敗，本機資料仍然保留", "error");
    console.warn(error);
  } finally {
    setActionBusy(button, false);
  }
  return false;
}

async function handleCloudCheckClick(event) {
  if (event) event.preventDefault();
  const button = event && event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null;
  if (button && button.disabled) return false;
  setActionBusy(button, true, "檢查中…");
  try {
    if (!window.cloudSync || !window.cloudSync.testConnection) {
      if (typeof setCloudHealth === "function") {
        setCloudHealth("local", "本機模式", "同步程式未載入。", "請檢查 supabase-config.js 和 cloud-storage.js。");
      }
      setStatus("雲端檢查失敗：同步程式未載入。", true);
      return false;
    }
    if (typeof setCloudHealth === "function") {
      setCloudHealth("checking", "正在檢查雲端", "正在讀取 Supabase 資料。", "");
    }
    const result = await window.cloudSync.testConnection();
    if (typeof setCloudHealth === "function") {
      setCloudHealth("ok", "雲端讀取正常", `雲端有 ${result.players} 位選手、${result.matches} 場比賽。`, `連線方式：${result.transport}`, {
        cloudPlayers: result.players,
        cloudMatches: result.matches,
        pendingPlayers: 0,
        pendingMatches: 0,
        markSuccess: true
      });
    }
    setStatus(`雲端讀取正常：${result.players} 位選手、${result.matches} 場比賽（${result.transport}）。`);
    showActionToast(`連線正常：${result.players} 位選手、${result.matches} 場比賽`);
  } catch (error) {
    if (typeof setCloudHealth === "function") {
      setCloudHealth("error", "雲端連不到", "暫時請以本機資料或備份操作。", error.message);
    }
    setStatus(`雲端檢查失敗：${error.message}`, true);
    showActionToast("雲端暫時連不到，現正使用本機資料", "warning");
    console.warn(error);
  } finally {
    if (button) {
      const label = button.dataset.originalLabel || "重新檢查";
      setActionBusy(button, false);
      button.textContent = label;
    }
  }
  return false;
}

async function handleRestoreAutomaticBackupClick(event) {
  if (event) event.preventDefault();
  if (!guardEditorAction("還原本機備份")) return false;
  const button = event && event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null;
  const confirmed = window.confirm("會將這部裝置最完整的自動備份與現有資料合併，不會刪除雲端已有記錄。確定繼續？");
  if (!confirmed) return false;
  setActionBusy(button, true, "正在還原…");
  try {
    const result = await restoreMostCompleteAutomaticBackup();
    if (!result.ok) {
      setStatus(result.message, true);
      return false;
    }
    selectedPlayerId = state.players.length ? state.players[0].id : "";
    renderAll();
    setStatus(`${result.message} 備份時間：${new Date(result.backup.createdAt).toLocaleString("zh-HK")}。`);
  } finally {
    setActionBusy(button, false);
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

function handleScoreAdjustClick(event, targetId, delta) {
  if (event) event.preventDefault();
  adjustScore(targetId, Number(delta));
  return false;
}

function handleClearActivityLogClick(event) {
  if (event) event.preventDefault();
  if (!guardEditorAction("清除操作紀錄")) return false;
  clearActivityLog();
  setStatus("操作紀錄已清除。");
  return false;
}

function handleSaveConfirmCloseClick(event) {
  if (event) event.preventDefault();
  hideSaveConfirmation();
  return false;
}

function handleSaveConfirmHistoryClick(event) {
  if (event) event.preventDefault();
  hideSaveConfirmation();
  if (lastSavedConfirmationDate) {
    selectedHistoryDate = lastSavedConfirmationDate;
    historyMode = "day";
    renderHistory();
  }
  location.hash = "#history";
  return false;
}

window.handleAddPlayerClick = handleAddPlayerClick;
window.handlePreviewClick = handlePreviewClick;
window.handleSaveMatchClick = handleSaveMatchClick;
window.handleCancelEditClick = handleCancelEditClick;
window.handleEditMatchClick = handleEditMatchClick;
window.handleDeleteMatchClick = handleDeleteMatchClick;
window.handleDeletePlayerClick = handleDeletePlayerClick;
window.handleRenamePlayerClick = handleRenamePlayerClick;
window.handleResetClick = handleResetClick;
window.handleExportClick = handleExportClick;
window.handleUploadCloudClick = handleUploadCloudClick;
window.handleCloudCheckClick = handleCloudCheckClick;
window.handleImportFileChange = handleImportFileChange;
window.handleOpenDayClick = handleOpenDayClick;
window.handleUseLastMatchClick = handleUseLastMatchClick;
window.handleSwapTeamsClick = handleSwapTeamsClick;
window.handleResetScoresClick = handleResetScoresClick;
window.handleScoreAdjustClick = handleScoreAdjustClick;
window.handleClearActivityLogClick = handleClearActivityLogClick;
window.handleSaveConfirmCloseClick = handleSaveConfirmCloseClick;
window.handleSaveConfirmHistoryClick = handleSaveConfirmHistoryClick;
window.handleRestoreAutomaticBackupClick = handleRestoreAutomaticBackupClick;
window.addEventListener("error", (event) => {
  setStatus(`程式錯誤：${event.message}`, true);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideSaveConfirmation();
});
