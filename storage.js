const storageKey = "badmintonPlayerRating.v2";
const preCloudBackupKey = `${storageKey}.preCloudBackup`;
const activityLogKey = `${storageKey}.activityLog`;
const maxActivityLogs = 40;
let cloudConnectionState = "local";
let lastCloudMessage = "";

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

function readActivityLog() {
  try {
    const logs = JSON.parse(localStorage.getItem(activityLogKey));
    return Array.isArray(logs) ? logs : [];
  } catch (error) {
    return [];
  }
}

function writeActivityLog(logs) {
  localStorage.setItem(activityLogKey, JSON.stringify(logs.slice(0, maxActivityLogs)));
}

function recordActivity(action, detail = "") {
  const logs = readActivityLog();
  logs.unshift({
    id: `log-${Date.now()}`,
    at: new Date().toISOString(),
    action,
    detail
  });
  writeActivityLog(logs);
  if (typeof renderActivityLog === "function") renderActivityLog();
}

function clearActivityLog() {
  localStorage.removeItem(activityLogKey);
  if (typeof renderActivityLog === "function") renderActivityLog();
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

function cloudDetail(message) {
  const projectUrl = window.BADMINTON_SUPABASE_CONFIG && window.BADMINTON_SUPABASE_CONFIG.url
    ? window.BADMINTON_SUPABASE_CONFIG.url
    : "未設定 Project URL";
  return `${message} Project：${projectUrl}`;
}

async function loadState() {
  const localState = loadLocalState();
  if (!window.cloudSync || !window.cloudSync.isConfigured()) {
    cloudConnectionState = "local";
    lastCloudMessage = "未設定 Supabase。";
    if (typeof setCloudHealth === "function") {
      setCloudHealth("local", "本機模式", "資料只會存在這部裝置。", "設定 Supabase 後才可多人同步。");
    }
    return localState;
  }
  rememberLocalBeforeCloud(localState);
  cloudConnectionState = "checking";
  lastCloudMessage = "正在連接 Supabase。";
  if (typeof setCloudHealth === "function") {
    setCloudHealth("checking", "正在連接雲端", "正在向 Supabase 讀取選手和比賽資料。", cloudDetail("如果停太耐，通常是 Project URL 或網絡問題。"));
  }

  try {
    const cloudState = await window.cloudSync.loadStateFromCloud();
    if (isEmptyCloudState(cloudState)) {
      cloudConnectionState = "ok";
      lastCloudMessage = "雲端已連接，但未有共享資料。";
      if (typeof setCloudHealth === "function") {
        setCloudHealth("ok", "雲端已連接", "Supabase 可讀取，但目前未有共享資料。", "如這部機有舊分數，管理員可上傳本機資料到雲端。");
      }
      if (typeof isEditor === "function" && !isEditor()) {
        localStorage.setItem(storageKey, JSON.stringify(localState));
        setStatus("雲端暫時未有資料；只讀模式不會自動上傳本機資料。");
        return localState;
      }
      const backupState = normalizeState(readSavedState(preCloudBackupKey) || {});
      const bootstrapState = hasMeaningfulLocalData(localState) ? localState : backupState;
      if (hasMeaningfulLocalData(bootstrapState)) {
        await window.cloudSync.saveStateToCloud(bootstrapState);
        localStorage.setItem(storageKey, JSON.stringify(bootstrapState));
        if (typeof setCloudHealth === "function") {
          setCloudHealth("ok", "雲端已建立共享資料", `${bootstrapState.players.length} 位選手，${bootstrapState.matches.length} 場比賽已上傳。`, "其他裝置重新整理後會同步。");
        }
        setStatus("雲端未有資料，已把這部機的本機資料上傳做共享資料。");
        return bootstrapState;
      }

      localStorage.setItem(storageKey, JSON.stringify(localState));
      setStatus("雲端未有資料。請在有舊分數的裝置按「上傳本機資料到雲端」。");
      return localState;
    }

    const nextState = normalizeState(cloudState || localState);
    localStorage.setItem(storageKey, JSON.stringify(nextState));
    cloudConnectionState = "ok";
    lastCloudMessage = `已讀取 ${nextState.players.length} 位選手、${nextState.matches.length} 場比賽。`;
    if (typeof setCloudHealth === "function") {
      setCloudHealth("ok", "雲端已連接", `已讀取 ${nextState.players.length} 位選手、${nextState.matches.length} 場比賽。`, `群組：${window.cloudSync.clubId()}（${window.cloudSync.transportLabel ? window.cloudSync.transportLabel() : "Supabase"}）`);
    }
    return nextState;
  } catch (error) {
    console.warn(error);
    cloudConnectionState = "error";
    lastCloudMessage = error.message;
    if (typeof setCloudHealth === "function") {
      setCloudHealth("error", "雲端連不到", "暫時使用這部裝置的本機資料。", cloudDetail(error.message));
    }
    setStatus(`雲端載入失敗，暫時使用本機資料：${error.message}`, true);
    return localState;
  }
}

async function saveState() {
  state = normalizeState(state || {});
  localStorage.setItem(storageKey, JSON.stringify(state));
  if (!window.cloudSync || !window.cloudSync.isConfigured()) {
    cloudConnectionState = "local";
    lastCloudMessage = "未設定 Supabase。";
    if (typeof setCloudHealth === "function") {
      setCloudHealth("local", "本機模式", "資料只儲存在這部裝置。", "未設定 Supabase。");
    }
    return {
      cloud: false,
      error: false,
      message: "只存本機：未連接 Supabase。"
    };
  }

  try {
    cloudConnectionState = "checking";
    if (typeof setCloudHealth === "function") {
      setCloudHealth("checking", "正在同步雲端", "正在把最新資料寫入 Supabase。", "");
    }
    await window.cloudSync.saveStateToCloud(state);
    const cloudState = await window.cloudSync.loadStateFromCloud();
    const cloudPlayers = Array.isArray(cloudState && cloudState.players) ? cloudState.players.length : 0;
    const cloudMatches = Array.isArray(cloudState && cloudState.matches) ? cloudState.matches.length : 0;

    if (cloudPlayers >= state.players.length && cloudMatches >= state.matches.length) {
      cloudConnectionState = "ok";
      lastCloudMessage = `已同步 ${cloudPlayers} 位選手、${cloudMatches} 場比賽。`;
      if (typeof setCloudHealth === "function") {
        setCloudHealth("ok", "雲端已同步", `已同步 ${cloudPlayers} 位選手、${cloudMatches} 場比賽。`, "其他裝置重新整理後會見到最新資料。");
      }
      return {
        cloud: true,
        error: false,
        message: `已同步到雲端（${cloudPlayers} 位選手，${cloudMatches} 場比賽）。`
      };
    }

    cloudConnectionState = "error";
    lastCloudMessage = `雲端只有 ${cloudPlayers} 位選手、${cloudMatches} 場比賽。`;
    if (typeof setCloudHealth === "function") {
      setCloudHealth("error", "雲端驗證未完成", `本機有 ${state.players.length} 位選手、${state.matches.length} 場比賽。`, lastCloudMessage);
    }
    return {
      cloud: false,
      error: true,
      message: `雲端同步未完成：本機有 ${state.players.length} 位選手、${state.matches.length} 場比賽，但雲端只有 ${cloudPlayers} 位選手、${cloudMatches} 場比賽。`
    };
  } catch (error) {
    console.warn(error);
    cloudConnectionState = "error";
    lastCloudMessage = error.message;
    if (typeof setCloudHealth === "function") {
      setCloudHealth("error", "雲端儲存失敗", "資料已先暫存在這部裝置。", cloudDetail(error.message));
    }
    setStatus(`雲端儲存失敗，本機已暫存：${error.message}`, true);
    return {
      cloud: false,
      error: true,
      message: `雲端儲存失敗，本機已暫存：${error.message}`
    };
  }
}

async function uploadLocalStateToCloud() {
  if (!window.cloudSync || !window.cloudSync.isConfigured()) {
    cloudConnectionState = "local";
    lastCloudMessage = "未設定 Supabase。";
    if (typeof setCloudHealth === "function") {
      setCloudHealth("local", "本機模式", "未能上傳到雲端。", "未設定 Supabase。");
    }
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
  const cloudState = await window.cloudSync.loadStateFromCloud();
  const cloudPlayers = Array.isArray(cloudState && cloudState.players) ? cloudState.players.length : 0;
  const cloudMatches = Array.isArray(cloudState && cloudState.matches) ? cloudState.matches.length : 0;
  localStorage.setItem(storageKey, JSON.stringify(state));
  localStorage.setItem(preCloudBackupKey, JSON.stringify(state));
  renderAll();
  if (cloudPlayers >= state.players.length && cloudMatches >= state.matches.length) {
    cloudConnectionState = "ok";
    lastCloudMessage = `已上傳 ${cloudPlayers} 位選手、${cloudMatches} 場比賽。`;
    if (typeof setCloudHealth === "function") {
      setCloudHealth("ok", "雲端已同步", lastCloudMessage, "其他裝置重新整理後會同步。");
    }
    setStatus(`已把本機資料上傳到雲端（${cloudPlayers} 位選手，${cloudMatches} 場比賽），其他裝置重新整理後會同步。`);
  } else {
    cloudConnectionState = "error";
    lastCloudMessage = `雲端只有 ${cloudPlayers} 位選手、${cloudMatches} 場比賽。`;
    if (typeof setCloudHealth === "function") {
      setCloudHealth("error", "上傳後驗證未完成", `本機有 ${state.players.length} 位選手、${state.matches.length} 場比賽。`, lastCloudMessage);
    }
    setStatus(`上傳後驗證未完成：本機有 ${state.players.length} 位選手、${state.matches.length} 場比賽，但雲端只有 ${cloudPlayers} 位選手、${cloudMatches} 場比賽。`, true);
  }
  return true;
}

function subscribeToStateChanges(onRemoteState) {
  if (!window.cloudSync || !window.cloudSync.isConfigured()) return;
  if (cloudConnectionState === "error") return;
  window.cloudSync.subscribe((remoteState) => {
    state = normalizeState(remoteState);
    localStorage.setItem(storageKey, JSON.stringify(state));
    onRemoteState(state);
  });
}

function isCloudConnectionError() {
  return cloudConnectionState === "error";
}

function storageModeLabel() {
  if (window.cloudSync && window.cloudSync.isConfigured()) {
    if (cloudConnectionState === "error") {
      return `雲端目前連不到，暫時使用本機資料：${lastCloudMessage}`;
    }
    if (cloudConnectionState === "checking") {
      return "正在連接雲端，請稍等。";
    }
    const transport = window.cloudSync.transportLabel ? window.cloudSync.transportLabel() : "Supabase";
    return `雲端同步模式：${window.cloudSync.clubId()}（${transport}）`;
  }
  return "本機模式：資料只會存在這部裝置。設定 Supabase 後，其他人先會見到同一份分數。";
}

function exportBackup() {
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    players: state.players,
    matches: state.matches,
    activityLog: readActivityLog()
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
      if (Array.isArray(imported.activityLog)) writeActivityLog(imported.activityLog);
      recordActivity("匯入備份", `${state.players.length} 位選手，${state.matches.length} 場比賽`);
      renderAll();
      setStatus(window.cloudSync && window.cloudSync.isConfigured() ? "備份已匯入雲端，排行榜已重新計算。" : "備份已匯入，排行榜已重新計算。");
    } catch (error) {
      setStatus(`匯入失敗：${error.message}`, true);
    }
  };
  reader.readAsText(file);
}
