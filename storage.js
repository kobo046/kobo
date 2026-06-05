const storageKey = "badmintonPlayerRating.v2";
const preCloudBackupKey = `${storageKey}.preCloudBackup`;

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
      location: match.location ? String(match.location) : "",
      note: match.note ? String(match.note) : "",
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

function loadLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && saved.players) return normalizeState(saved);
  } catch (error) {
    localStorage.removeItem(storageKey);
  }
  return normalizeState(clone(seedData));
}

function readSavedState(key = storageKey) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (error) {
    return null;
  }
}

function hasMeaningfulLocalData(value) {
  const saved = value && Array.isArray(value.players) && Array.isArray(value.matches) ? value : readSavedState();
  try {
    if (!saved || !Array.isArray(saved.players) || !Array.isArray(saved.matches)) return false;
    if (saved.matches.length > 0) return true;
    if (saved.players.length !== seedData.players.length) return true;
    const seedNames = new Set(seedData.players.map((player) => player.name));
    return saved.players.some((player) => !seedNames.has(player.name));
  } catch (error) {
    return false;
  }
}

function rememberLocalBeforeCloud(localState) {
  if (!hasMeaningfulLocalData(localState)) return;
  localStorage.setItem(preCloudBackupKey, JSON.stringify(localState));
}

function isEmptyCloudState(cloudState) {
  return (
    cloudState &&
    Array.isArray(cloudState.players) &&
    Array.isArray(cloudState.matches) &&
    cloudState.players.length === 0 &&
    cloudState.matches.length === 0
  );
}

async function loadState() {
  const localState = loadLocalState();
  if (!window.cloudSync || !window.cloudSync.isConfigured()) return localState;
  rememberLocalBeforeCloud(localState);

  try {
    const cloudState = await window.cloudSync.loadStateFromCloud();
    if (isEmptyCloudState(cloudState)) {
      const backupState = normalizeState(readSavedState(preCloudBackupKey) || {});
      const bootstrapState = hasMeaningfulLocalData(localState) ? localState : backupState;
      if (hasMeaningfulLocalData(bootstrapState)) {
        await window.cloudSync.saveStateToCloud(bootstrapState);
        localStorage.setItem(storageKey, JSON.stringify(bootstrapState));
        setStatus("雲端未有資料，已把這部機的本機資料上傳做共享資料。");
        return bootstrapState;
      }

      localStorage.setItem(storageKey, JSON.stringify(localState));
      setStatus("雲端未有資料。請在有舊分數的裝置按「上傳本機資料到雲端」。");
      return localState;
    }

    const nextState = normalizeState(cloudState || localState);
    localStorage.setItem(storageKey, JSON.stringify(nextState));
    return nextState;
  } catch (error) {
    console.error(error);
    setStatus(`雲端載入失敗，暫時使用本機資料：${error.message}`, true);
    return localState;
  }
}

async function saveState() {
  state = normalizeState(state || {});
  localStorage.setItem(storageKey, JSON.stringify(state));
  if (!window.cloudSync || !window.cloudSync.isConfigured()) return;

  try {
    await window.cloudSync.saveStateToCloud(state);
  } catch (error) {
    console.error(error);
    setStatus(`雲端儲存失敗，本機已暫存：${error.message}`, true);
  }
}

async function uploadLocalStateToCloud() {
  if (!window.cloudSync || !window.cloudSync.isConfigured()) {
    setStatus("未設定 Supabase，暫時未能上傳到雲端。", true);
    return false;
  }

  const currentState = normalizeState(state || {});
  const savedState = normalizeState(readSavedState() || {});
  const backupState = normalizeState(readSavedState(preCloudBackupKey) || {});
  const localState = hasMeaningfulLocalData(currentState)
    ? currentState
    : hasMeaningfulLocalData(savedState)
      ? savedState
      : backupState;

  if (!hasMeaningfulLocalData(localState)) {
    setStatus("這部機未找到可上傳的本機分數資料。請在有舊分數的裝置操作，或先匯入備份。", true);
    return false;
  }

  state = localState;
  await window.cloudSync.saveStateToCloud(state);
  localStorage.setItem(storageKey, JSON.stringify(state));
  localStorage.setItem(preCloudBackupKey, JSON.stringify(state));
  renderAll();
  setStatus("已把這部機的本機資料上傳到雲端，其他裝置重新整理後會同步。");
  return true;
}

function subscribeToStateChanges(onRemoteState) {
  if (!window.cloudSync || !window.cloudSync.isConfigured()) return;
  window.cloudSync.subscribe((remoteState) => {
    state = normalizeState(remoteState);
    localStorage.setItem(storageKey, JSON.stringify(state));
    onRemoteState(state);
  });
}

function storageModeLabel() {
  if (window.cloudSync && window.cloudSync.isConfigured()) {
    return `雲端同步模式：${window.cloudSync.clubId()}`;
  }
  return "本機模式：資料只會存在這部裝置。設定 Supabase 後，其他人先會見到同一份分數。";
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
  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      state = normalizeState(imported);
      selectedPlayerId = state.players.length ? state.players[0].id : "";
      clearMatchEditingUi();
      await saveState();
      renderAll();
      setStatus(window.cloudSync && window.cloudSync.isConfigured() ? "備份已匯入雲端，排行榜已重新計算。" : "備份已匯入，排行榜已重新計算。");
    } catch (error) {
      setStatus(`匯入失敗：${error.message}`, true);
    }
  };
  reader.readAsText(file);
}
