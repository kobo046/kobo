const storageKey = "badmintonPlayerRating.v2";

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
